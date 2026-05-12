# Pro-Workflow 集成调研文档

> 调研时间: 2026-05-12
> 来源: https://github.com/rohitg00/pro-workflow v3.3.0
> 目的: 分析各模块能力、流程与技术实现，确定 tech-cc-hub 可集成范围

---

## 一、项目总览

Pro-Workflow 是一个 Claude Code 插件系统，核心理念：**使用单个 SQLite 数据库为每个 Session 提供自纠正学习 + 持久化知识库 + 质量门禁**。

| 维度 | 说明 |
|------|------|
| 语言 | TypeScript (Node.js) |
| 依赖 | `better-sqlite3` (唯一) |
| 存储 | `~/.pro-workflow/data.db` (SQLite + FTS5) |
| 规模 | 34 Skills / 8 Agents / 22 Commands / 37 Hook Scripts / 24 Event Types |

---

## 二、核心模块详解

### 模块 1: 自纠正学习循环 (Self-Correction Loop)

**功能:** 用户纠正 Claude 后，自动提取规则，持久化到 SQLite，后续 Session 自动加载。

#### 1.1 流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Self-Correction Loop                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User illustrates mistake                                           │
│         │                                                           │
│         ▼                                                           │
│  Claude acknowledges & proposes rule                                │
│         │                                                           │
│         ▼                                                           │
│  [LEARN] Category: Rule description                                │
│  Mistake: ...                                                       │
│  Correction: ...                                                    │
│         │                                                           │
│ ▼───────▼───────────────────────────────────────────┐               │
│ │  User approves       (或 /learn-rule 手动触发)     │               │
│ └───────────────────────────────────────────────────┘               │
│         │                                                           │
│         ▼                                                           │
│  Hook: learn-capture.js (Stop event)                                │
│         │                                                           │
│         ▼                                                           │
│  解析 [LEARN] blocks, 调用 store.addLearning()                     │
│         │                                                           │
│         ▼                                                           │
│  SQLite: learnings 表 + FTS5 索引                                   │
│         │                                                           │
│         ▼                                                           │
│  SessionStart hook: load learnings → 注入上下文                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 1.2 关键代码位置

| 文件 | 作用 |
|------|------|
| `src/db/store.ts:113-269` | Learning CRUD，SQLite 操作 |
| `src/db/store.ts:258-269` | `addLearning` 事务（含 wiki 关联） |
| `src/search/fts.ts` | FTS5 全文搜索封装 |
| `scripts/learn-capture.js` | Stop hook：从 AI 响应里提取 `[LEARN]` 块并存 DB |
| `scripts/prompt-submit.js` | UserPromptSubmit hook：检测纠正模式（正则匹配） |
| `scripts/session-start.js` | SessionStart hook：加载最近 learnings |
| `rules/self-correction.mdc` | Cursor 规则文件 |
| `skills/learn-rule/SKILL.md` | /learn-rule 命令的 Skill 定义 |

#### 1.3 技术要点

- **存储格式:** `[LEARN] Category: Rule\nMistake: ...\nCorrection: ...\nWiki: <slug>`（可选关联 wiki）
- **触发词:** "remember this", "add to rules", "don't do that again", "learn from this", `[LEARN]`
- **纠正检测:** 正则匹配 "no, that's wrong", "revert", "stop" 等模式
- **FTS5 搜索:** `BM25(learnings_fts, 1.0, 2.0, 1.0, 1.0)` + `snippet()` 高亮

---

### 模块 2: 质量门禁 (Quality Gates)

**功能:** 根据历史纠正率动态调整检查频率，在编辑/commit 时提供检查提醒。

#### 2.1 流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Quality Gate Flow                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Edit / Write (PreToolUse)                                       │
│         │                                                        │
│         ▼                                                        │
│  quality-gate.js                                                 │
│         │                                                        │
│         ├── 从 SQLite 获取历史纠正率                              │
│         │                                                        │
│         ▼                                                        │
│  计算自适应阈值:                                                  │
│  ┌──────────────────────────────────────┐                        │
│  │ 纠正率 > 25% → (3,6,6)  ← 更激进   │                        │
│  │ 纠正率 > 15% → (5,10,10)            │                        │
│  │ 纠正率 >  5% → (8,15,15)            │                        │
│  │ 否则        → (10,20,20) ← 宽松    │                        │
│  └──────────────────────────────────────┘                        │
│         │                                                        │
│         ▼                                                        │
│  count = session.edit_count + 1                                  │
│         │                                                        │
│  ┌──────┼──────────────────┐                                     │
│  │      ▼                  │                                     │
│  │  count == first? → checkpoint reminder                        │
│  │  count == second? → quality gate reminder                     │
│  │  count > second && % repeat == 0? → periodic reminder         │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

                    Commit 链路

  git commit (Bash PreToolUse)
    │
    ▼
  commit-validate.js → 检查 conventional commit 格式
    │                   (type(scope): summary, <=72 chars)
    │
    ▼
  secret-scan.js → 正则检测 13 种 secret 模式
    │               (AWS/GitHub/Anthropic/OpenAI/Slack/Google/Stripe/...)
    │               (允许 process.env., example, placeholder)
    │
    ▼
  git-blast-radius.js → 检测危险 git 操作
                         (force push, hard reset, branch -D, stash drop)
```

#### 2.2 关键代码位置

| 文件 | 作用 |
|------|------|
| `scripts/quality-gate.js` | 自适应检查频率，基于历史纠正率 |
| `scripts/commit-validate.js` | Conventional commit 格式检查 |
| `scripts/secret-scan.js` | 13 种 secret 正则检测 |
| `scripts/git-blast-radius.js` | 14 种危险 git 操作拦截 |
| `hooks/hooks.json:5-78` | PreToolUse hook 注册 |
| `config.json:22-28` | quality_gates 配置（lint/typecheck/test 命令） |

---

### 模块 3: 知识平面 (Knowledge Plane)

**功能:** 最强大的模块。为任意主题建立持久化 Wiki，支持 FTS5 搜索 + 向量检索 + 自动研究循环。

#### 3.1 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                    Knowledge Plane (v3.3)                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│                    ┌─────────────────────┐                        │
│                    │   SQLite + FTS5     │                        │
│                    │                     │                        │
│                    │  wikis              │  wiki 注册表           │
│                    │  wiki_pages         │  页面内容              │
│                    │  wiki_pages_fts     │  全文搜索              │
│                    │  wiki_sources       │  引用来源              │
│                    │  wiki_claims        │  声明/断言             │
│                    │  wiki_seeds         │  研究种子队列          │
│                    │  wiki_embeddings    │  向量索引              │
│                    │  learnings_wiki     │  学习-关联表           │
│                    └─────────────────────┘                        │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  ┌──────────┐    │
│  │  wiki-   │  │  wiki-   │  │  wiki-research│  │  wiki-   │    │
│  │  builder │  │  query   │  │  -loop        │  │  viewer  │    │
│  │          │  │          │  │               │  │          │    │
│  │ 创建/管理│  │ 检索/查询│  │ 自动研究循环  │  │ HTML展示 │    │
│  │ Wiki     │  │ BM25+向量│  │ BFS+Budget    │  │          │    │
│  └──────────┘  └──────────┘  └───────────────┘  └──────────┘    │
│       │             │               │                              │
│       ▼             ▼               ▼                              │
│  UserPromptSubmit: 自动注入 top-3 wiki hits                       │
│  SessionStart: 列出可用 wiki                                     │
│  FileChanged: 编辑时触发 seed 入队                               │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

#### 3.2 Wiki 建立流程

```
用户: /wiki init agent-memory --title "Agent Memory" --flavor research
  │
  ▼
wiki-builder/SKILL.md → 生成目录结构:
  agent-memory/
  ├── wiki.config.md
  ├── raw/
  ├── wiki/index.md
  ├── derived/
  ├── logs/maintenance-log.md
  └── sources.md
  │
  ▼
wiki-cli.js init → createStore + store.upsertWiki()
  │                 (注册到 SQLite wikis 表)
  │
  ▼
后续: /wiki page ... → 写 Markdown + upsertWikiPage()
                        → FTS5 同步 (trigger)
  │
  ▼
/wiki ask "what is episodic memory" → store.searchWiki() → bm25()
                                      → 返回 top-K hits + snippet
```

#### 3.3 研究循环流程

```
/wiki research agent-memory --max-pages 5 --budget-usd 0.50
  │
  ▼
research-loop.js → 从 seed queue 取 pending seed
  │                 (depth ASC, created_at ASC)
  │
  ▼
fetcher plugins:
  ├── web.js (WebFetch shim)
  ├── arxiv.js (free API)
  └── github.js (search API + README)
  │
  ▼
提取 claims → 去重 (FTS5 + Jaccard overlap)
  │
  ▼
编译 wiki page → upsertWikiPage → FTS5 sync
  │
  ▼
生成 follow-up seeds → enqueue
  │
  ▼
检查停止条件:
  - budget_usd 超限
  - max_pages 到达
  - max_depth 到达
  - 3 连续页 < 5% 新 claims (convergence)
  - ~/.pro-workflow/STOP 文件存在
```

#### 3.4 关键代码位置

| 文件 | 作用 |
|------|------|
| `src/db/store.ts:94-108,172-422` | Wiki CRUD, FTS 搜索, Seed 队列 |
| `src/db/schema.sql:63-168` | Wiki 相关 7 张表 + FTS5 + 索引 |
| `src/search/embeddings.ts` | OpenAI/Voyage 向量嵌入 + RRF 融合 |
| `skills/wiki-builder/SKILL.md` | Wiki 创建和管理逻辑 |
| `skills/wiki-query/SKILL.md` | 检索逻辑: search/related/show |
| `skills/wiki-research-loop/SKILL.md` | BFS 自动研究 + 预算控制 |
| `scripts/embed-wiki.js` | 命令行: 批量向量化 + 混合检索 |
| `skills/wiki-viewer/SKILL.md` | HTML 可视化 |

---

### 模块 4: 上下文工程 (Context Engineering)

**功能:** 四步上下文管理: Write / Select / Compress / Isolate，配合 PreCompact/PostCompact hook。

#### 4.1 流程图

```
┌─────────────────────────────────────────────────────────┐
│             Context Engineering (4 Operations)           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Write   → 持久化到文件 (NOTES.md / LEARNED.md)          │
│            持久化到 SQLite (learnings)                    │
│                                                          │
│  Select  → 精准检索 (grep > file > Glob > subagent)      │
│            Wiki 自动注入 (UserPromptSubmit hook)          │
│                                                          │
│  Compress → /compact + pre/post compact hooks           │
│            │                                             │
│            ▼ PreCompact                                  │
│            pre-compact.js:                               │
│             - 保存 edit count / prompt count 到临时文件   │
│             - 将当前状态写入 /tmp/pro-workflow/compacts/  │
│            │                                             │
│            ▼ PostCompact                                 │
│            post-compact.js:                              │
│             - 读取最近的 compact JSON                     │
│             - 注入 summary / counts 回上下文             │
│                                                          │
│  Isolate → subagent / worktree / /btw                   │
│            并行会话: claude -w                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 4.2 关键代码位置

| 文件 | 作用 |
|------|------|
| `scripts/pre-compact.js` | Compact 前保存状态到 JSON |
| `scripts/post-compact.js` | Compact 后恢复状态 |
| `scripts/tool-call-budget.js` | 工具调用预算 (20/30/50/80 阶梯) |
| `scripts/read-before-write.js` | 写前必须读 |
| `skills/context-engineering/SKILL.md` | Write/Select/Compress/Isolate 完整方法论 |

---

### 模块 5: 会话管理 (Session Lifecycle)

**功能:** Session Start / End / 统计，工作区检测。

#### 5.1 流程图

```
SessionStart (hook)
  │
  ▼
session-start.js:
  ├── 找到项目根目录 (.git)
  ├── 打开 SQLite store
  ├── store.startSession(sessionId, projectName)
  ├── 加载最近 5 条 learnings → 注入上下文
  ├── 获取上次 session 统计 (edit_count, corrections_count)
  ├── 列出已注册 wiki (top 5)
  ├─ 检测 worktree 数量
  └── 提示 "Use /wrap-up before ending, /learn to capture"

SessionEnd (hook)
  │
  ▼
session-end.js:
  ├── store.endSession(sessionId)
  ├── 打印 session 统计
  ├── 检测未提交变更 (git status --porcelain)
  └── 提示 "/wrap-up? Learnings captured?"
```

#### 5.2 关键代码位置

| 文件 | 作用 |
|------|------|
| `scripts/session-start.js` | 加载 learnings + sessions + wikis |
| `scripts/session-end.js` | 结束统计 + 未提交变更检测 |
| `src/db/store.ts:147-171` | Session CRUD |

---

### 模块 6: 任务漂移检测 (Drift Detector)

**功能:** 跟踪原始意图，当偏离目标时提醒。

#### 6.1 流程图

```
UserPromptSubmit (hook)
  │
  ▼
drift-detector.js:
  │
  ├── 首次: 保存 intent 到 /tmp/pro-workflow/intent-{sessionId}
  │         (提取第一句话作为 intent, 最多 200 字符)
  │
  ├── 后续: editsSinceLastTouch++
  │         计算 intentKeywords 与 promptKeywords 重叠率
  │         overlap = intersect(intent, prompt) / len(intent)
  │
  └── 检测漂移:
      if editsSinceLastTouch >= 6 && relevance < 0.2:
        提醒 "Original intent: ... Current work seems unrelated"
        editsSinceLastTouch = 0

  检测新意图:
    patterns: "now let's", "switch to", "forget that", "new task"
    → 重置 intent
```

#### 6.2 关键代码位置

| 文件 | 作用 |
|------|------|
| `scripts/drift-detector.js` | 全部实现（120 行） |

---

### 模块 7: 命令系统 (Commands)

**功能:** 22 个 slash 命令，Part 1 核心命令。

| 命令 | 流程 | 文件位置 |
|------|------|----------|
| `/learn-rule` | 纠正 → 提议规则 → 审批 → 存储 | `skills/learn-rule/SKILL.md` |
| `/wrap-up` | 状态审计 → 学习收集 → 总结 | `skills/wrap-up/SKILL.md` |
| `/commit` | Quality Gates → review diff → 生成 commit message | `skills/smart-commit/SKILL.md` |
| `/wiki` | init/page/ask/hybrid/research/council/view | `skills/wiki-builder/SKILL.md` & `skills/wiki-query/SKILL.md` |
| `/develop` | Research → Plan → Implement → Review | `skills/orchestrate/SKILL.md` |
| `/insights` | Session 分析，纠正热图 | `skills/insights/SKILL.md` |
| `/replay` | 回放已学规则 | `skills/replay-learnings/SKILL.md` |
| `/handoff` | 会话交接文档 | `skills/session-handoff/SKILL.md` |

---

### 模块 8: Hook 事件注册系统

**功能:** 24 个事件，37 个 Hook 脚本，完整的事件驱动架构。

#### 事件→脚本映射

| 事件 | 脚本 | 触发时机 |
|------|------|----------|
| `SessionStart` | session-start.js | 会话开始 |
| `SessionEnd` | session-end.js | 会话结束 |
| `UserPromptSubmit` | prompt-submit.js, drift-detector.js | 用户发消息 |
| `PreToolUse(Edit/Write)` | quality-gate.js, read-before-write.js, secret-scan.js | 编辑/写入前 |
| `PreToolUse(Bash)` | git-blast-radius.js, pre-commit-check.js, commit-validate.js, pre-push-check.js | Git 操作前 |
| `PostToolUse` | post-edit-check.js, test-failure-check.js | 编辑后 |
| `Stop` | session-check.js, learn-capture.js | AI 停止时 |
| `PreCompact` | pre-compact.js | 压缩前 |
| `PostCompact` | post-compact.js | 压缩后 |
| `ConfigChange` | config-watcher.js | 配置修改 |
| `Notification` | notification-handler.js | 通知 |
| `SubagentStart` | subagent-start.js | 子代理开始 |
| `SubagentStop` | subagent-stop.js | 子代理结束 |
| `TaskCompleted` | task-completed.js | 任务完成 |
| `TaskCreated` | task-created.js | 任务创建 |
| `PermissionRequest` | permission-request.js | 权限请求 |
| `PermissionDenied` | permission-denied.js | 权限拒绝 |
| `PostToolUseFailure` | tool-failure.js | 工具失败 |
| `TeammateIdle` | teammate-idle.js | 队友空闲 |
| `StopFailure` | stop-failure.js | 停止失败 |
| `FileChanged` | file-changed.js | 文件变更 |
| `Setup` | setup-hook.js | 初始化 |
| `WorktreeCreate` | worktree-create.js | Worktree 创建 |
| `WorktreeRemove` | worktree-remove.js | Worktree 移除 |
| `CwdChanged` | cwd-changed.js | 工作目录变更 |

---

### 模块 9: Agent 系统

**功能:** 8 个专用 Agent，每个有独立的工具和职责。

| Agent | 用途 | 关键工具 |
|-------|------|----------|
| `orchestrator` | 多阶段开发: Research→Plan→Implement | Read, Glob, Grep, Bash, Edit, Write |
| `reviewer` | 代码审查，安全审计 | Read, Glob, Grep, Bash |
| `planner` | 任务分解，只读 | Read, Glob, Grep |
| `debugger` | 系统性调试，假设排序 | Read, Glob, Grep, Bash |
| `scout` | 置信度门控探索 | Read, Glob, Grep, Bash |
| `context-engineer` | 上下文窗口分析 | (按需) |
| `permission-analyst` | 权限策略分析 | (按需) |
| `cost-analyst` | 成本优化 | (按需) |

**Agent 实现:** 位于 `agents/` 目录，以 `.md` 文件定义，带 YAML frontmatter（tools, model, skills）。

---

## 三、数据库 Schema 概览

```
~/.pro-workflow/data.db (SQLite + FTS5)
│
├── learnings          → 自纠正规则 (category, rule, mistake, correction)
├── learnings_fts      → 全文搜索索引 (BM25)
├── sessions           → 会话统计 (edit_count, corrections_count, prompts_count)
├── wikis              → Wiki 注册表 (slug, title, flavor, scope)
├── wiki_pages         → Wiki 页面 (rel_path, title, content, content_hash)
├── wiki_pages_fts     → Wiki 全文搜索 (BM25)
├── wiki_sources       → 数据来源 (url, title, fetcher)
├── wiki_claims        → 声明/断言 (text, confidence)
├── wiki_seeds         → 研究种子队列 (query, status, depth)
├── wiki_embeddings    → 向量表 (blob, model, dim)
└── learnings_wiki     → 学习-Wiki 关联表
```

---

## 四、可集成能力分析

### 4.1 高价值可直接集成（Phase 1 — 立即可做）

| 能力 | 实现方式 | 复杂度 | 价值 |
|------|----------|--------|------|
| **自纠正学习循环** | 从 pro-workflow 复用 `src/db/store.ts` + `src/search/fts.ts` + Hook 脚本 | 中 | ⭐⭐⭐⭐⭐ |
| **自动规则持久化** | 复用 `learn-capture.js` 逻辑，存 tech-cc-hub 自己的 SQLite | 低 | ⭐⭐⭐⭐⭐ |
| **质检提醒** | 复用 `quality-gate.js` 阈值逻辑，集成到现有 runner | 低 | ⭐⭐⭐⭐ |
| **Secret 扫描** | 复用 `secret-scan.js` 13 条正则 + allowlist，写入 PreToolUse hook | 低 | ⭐⭐⭐ |
| **Conventional Commit** | 复用 `commit-validate.js` 格式检查 | 低 | ⭐⭐⭐ |
| **Git 危险操作拦截** | 复用 `git-blast-radius.js` 14 条规则 | 低 | ⭐⭐⭐⭐ |
| **写前读取检查** | 复用 `read-before-write.js` 逻辑 | 低 | ⭐⭐⭐ |
| **工具调用预算** | 复用 `tool-call-budget.js` 20/30/50/80 阶梯 | 低 | ⭐⭐⭐ |
| **任务漂移检测** | 复用 `drift-detector.js` 逻辑 | 低 | ⭐⭐⭐ |
| **卫生检查 (/doctor)** | 复用 `setup-hook.js` + 诊断逻辑 | 低 | ⭐⭐⭐ |

---

### 4.2 中等价值需适配集成（Phase 2 — 需探讨）

| 能力 | 实现方式 | 复杂度 | 价值 |
|------|----------|--------|------|
| **Wiki 知识库** | 复用 wiki-builder + wiki-query + FTS5 表结构 | 中 | ⭐⭐⭐⭐ |
| **Pre/Post Compact** | 复用 pre-compact + post-compact 逻辑 | 中 | ⭐⭐⭐⭐ |
| **Session 生命周期** | 集成 session start/end 到现有会话管理 | 中 | ⭐⭐⭐ |
| **向量检索 (Embeddings)** | 复用 embeddings.ts + OpenAI/Voyage API | 中 | ⭐⭐⭐⭐ |
| **混合检索 (RRF)** | 复用 `reciprocalRankFusion()` | 中 | ⭐⭐⭐ |
| **Wiki 可视化 (HTML)** | 复用 wiki-viewer 生成单页 HTML | 高 | ⭐⭐ |
| **LLM Council (多人讨论)** | 复用 3 阶段 deliberation | 高 | ⭐⭐⭐ |
| **文献调查生成器** | 复用 survey-generator | 高 | ⭐⭐ |

---

### 4.3 不可直接集成/需要重新实现（Phase 3 — 后续迭代）

| 能力 | 原因 | 优先级 |
|------|------|--------|
| **Agent Teams** | 需要 Claude Code 原生支持 subagent coordination | 低 |
| **SkillKit 跨 Agent** | 需要第三方框架 SkillKit | 低 |
| **Context 工程框架** | 方法论层面，需要写进 CLAUDE.md | 中 |
| **Auto-research loop** | 依赖 wiki + fetcher 插件，需完整 BFS | 低 |

---

### 4.4 与 tech-cc-hub 现状的集成映射

| pro-workflow 模块 | tech-cc-hub 现有模块 | 集成点 |
|-------------------|---------------------|--------|
| `src/db/store.ts` | `src/electron/libs/runner.ts` | 直接引用，扩展 SQLite 表 |
| `scripts/learn-capture.js` | `src/electron/libs/runner.ts` | 在每次 AI 响应时自动捕获 `[LEARN]` |
| `scripts/quality-gate.js` | `src/ui/store/useAppStore.ts` | 在 UI 中展示质检提醒 |
| `scripts/secret-scan.js` | `src/electron/libs/mcp-tools/` | Pre-tool hook 中调用 |
| `hooks/hooks.json` | `src/electron/libs/runner.ts` | 扩展现有 hook 系统 |
| `wiki-builder` skill | `src/ui/components/Sidebar.tsx` | 在侧栏展示 wiki 列表 |
| `wiki-query` skill | `src/ui/components/PromptInput.tsx` | 输入框自动注入 wiki hits |
| `skills/learn-rule` | `src/ui/components/PromptInput.tsx` | 输入框触发 /learn-rule |
| `rules/self-correction.mdc` | `src/electron/libs/system-prompt-presets.ts` | 注入到 system prompt |
| `skills/context-engineering` CLAUDE.md | `CLAUDE.md` 直接追加 | 方法论层面 |

---

## 五、集成方案建议

### Phase 1: 学习循环 + 质量门禁（1-2 周）

**优先级最高，最快速见效**

1. **扩展数据库:**
   - 在 tech-cc-hub 现有 SQLite 中复制 pro-workflow 的 `learnings` 和 `learnings_fts` 表
   - 添加 `sessions` 统计表
   - 保持兼容

2. **Hook 系统:**
   - 在 `src/electron/libs/runner.ts` 中添加对 `SessionStart` / `UserPromptSubmit` / `Stop` 事件的监听
   - 注入 pro-workflow 的脚本逻辑为内联函数或独立脚本

3. **UI 集成:**
   - PromptInput 输入框添加 `/learn-rule` 支持
   - Sidebar 显示近期 learnings
   - ActivityRail 显示质检提醒

4. **质量门禁:**
   - 在 Edit/Write 时调用 `quality-gate.js` 逻辑
   - 在 commit 时调用 `commit-validate.js` + `secret-scan.js`

---

### Phase 2: 知识库 Wiki（4-6 周）

1. **Wiki 存储层:**
   - 在 tech-cc-hub SQLite 中复制 pro-workflow 的 wiki 表结构
   - 复用 `wiki-cli.js` 作为命令行入口
   - 在 Runner 中集成 wiki-scoped learnings

2. **Wiki 界面:**
   - Sidebar 新增 "Knowledge" section
   - PromptInput 添加 `/wiki ask` 支持
   - 单独页面或抽屉显示 wiki 内容

3. **自动研究:**
   - 集成 `-research-loop` 逻辑（预算限制）
   - 在后台运行，通过 ActivityRail 显示进度

---

### Phase 3: Context Engineering（持续迭代）

1. **Pre/Post Compact:**
   - 在现有的 compact 机制前/后添加状态保存
   - 通过 Runner hooks 集成

2. **工具调用预算:**
   - 在 UI 中实现工具调用计数器
   - 20/30/50/80 阶梯提醒

3. **任务漂移警告:**
   - 在 PromptInput 中实时检测并提示

---

## 六、代码集成注意事项

1. **依赖极简:** pro-workflow 只有一个 `better-sqlite3` 依赖，低风险
2. **MIT 许可证:** 可以直接引用代码，但需要保留来源说明
3. **路径约定:** pro-workflow 使用 `~/.pro-workflow/`，tech-cc-hub 需要统一到自己的数据库路径
4. **Hook 注册:** pro-workflow 使用 Claude Code 原生的 `hooks.json`，tech-cc-hub 需要适配
5. **FTS5 兼容性:** SQLite FTS5 是标准特性，better-sqlite3 已支持
6. **向量表:** pro-workflow 存储为 BLOB，tech-cc-hub 可以同样处理
7. **代码风格:** pro-workflow 是纯 JS，tech-cc-hub 是 TypeScript，有适配层

---

## 七、优先级排序

| 排名 | 模块 | 价值/复杂度 | 理由 |
|------|------|------------|------|
| 1 | 自纠正学习循环 | 高价值/低复杂度 | 核心能力，且与 tech-cc-hub 现有架构完全兼容 |
| 2 | Git 守护 (secret/blast-radius) | 中/低复杂度 | 现有代码复用，像增加一层安全网 |
| 3 | 质量门禁提醒 | 高/低复杂度 | 与学习循环互补 |
| 4 | Wiki 知识库 | 高/中复杂度 | 价值巨大，但需要较多 UI 适配 |
| 5 | 向量检索 (Embeddings) | 高/中复杂度 | 依赖 OpenAI/Voyage API，但 RRF 融合提升显著 |
| 6 | 工具调用预算 | 中/低复杂度 | 现成实现，简单集成 |
| 7 | 任务漂移检测 | 中/低复杂度 | 现成实现，简单集成 |
| 8 | LLM Council | 中/高复杂度 | 多 LLM 讨论，需 API 集成复杂 |
| 9 | Wiki 可视化 | 低/高复杂度 | HTML 生成复杂度高 |

---

## 八、已确认集成范围（2026-05-12）

### Phase 1: 立即实施（学习循环 + 质量门禁 + Git 守护）
- [x] 从 pro-workflow 复制 `learnings` + `learnings_fts` 表结构到 tech-cc-hub 数据库
- [x] 复制 `learn-capture.js` 逻辑到 tech-cc-hub Runner
- [x] 复制 `quality-gate.js` + `commit-validate.js` + `secret-scan.js` + `git-blast-radius.js` 到 PreToolUse hook
- [x] 复制 `read-before-write.js` + `tool-call-budget.js` 到 PreToolUse hook
- [x] 复制 `drift-detector.js` 到 UserPromptSubmit hook
- [x] 添加 `sessions` 统计表

### UI 集成: 在 Usage 页面显示 learnings
- [x] 在 Usage 页面（ActivityRail / 详情抽屉）展示 learnings 列表
- [x] 最近 5 条 learnings 自动注入到 SessionStart 上下文

### Wiki 预留: DeepWiki 接口预留
- [x] Wiki 路径放在 tech-cc-hub 存储目录内（复用现有 SQLite）
- [x] 预留 DeepWiki 接口（不实现完整 self-correction，只建表结构）
- [x] 后续迭代接入 DeepWiki 时，扩展 wiki-queries 接口

### 下一步: Phase 2（后续迭代）
- [ ] Wiki 知识库 UI 展示
- [ ] 向量检索 + 混合检索 (RRF)
- [ ] LLM Council
- [ ] Wiki 可视化 (HTML)

---

*文档完成时间: 2026-05-12*
*等待用户确认集成范围后，进入 Phase 1 实施阶段*