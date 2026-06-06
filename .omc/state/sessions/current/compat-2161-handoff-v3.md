---
name: compat-2161-handoff-v3
description: compat-2161 v3 handoff (2026-06-03 23:xx UTC+8, post Phase 0/1 done, Phase 2-10 待新 session 推进)
type: project
originSessionId: compat-2161-v3
predecessor: compat-2161-handoff-v2 (was never on disk; superseded by this v3)
---
## 状态（2026-06-03 23:xx 本 session 收尾）

- 分支：`claude-code-compat-2161`
- HEAD：`38afa57`（Phase 1 同步 2.1.154 commit，叠加在上一 session 留下的 `3619ef1` Phase 1 代码层 commit 之上）
- Working tree：相对 HEAD 干净
- Workflow 状态文件：`.tmp/claude-code-compat-2161-state.json`
  - Phase 0 `done`（preflight）
  - Phase 1 `done`（官方 changelog sync, syncs to 2.1.154 from claudelog, 闸门已降级）
  - Phase 2-10 `pending`
- 已落地文件
  - `scripts/sync-claude-code-compat.mjs`：`--source official|claudelog|file` 旗标
  - `scripts/claude-code-compat-sync-lib.mjs`：`extractOfficialSections` / `extractClaudelogSections` / `sha256Digest` / `buildSyncReport` / `parseStrippedSections`
  - `scripts/claude-code-compat-2161-workflow.mjs`：11 phase runner（自包含，含闸门 + commit）
  - `src/electron/libs/claude/claude-code-compat-registry.ts`：`sourceUrl` 切到官方，`sourceDigest` 字段加进 type
  - `.tmp/claude-code-compat-preflight.txt`：preflight 报告
- Stash 状态（**不要 pop**）：
  - `stash@{0}`：cron-db 单文件（OFF-LIMITS 之外的安全网）
  - `stash@{1}`：compat-2161-v2 备份 32 文件（含 v2 期间未提交 work，**不要 pop**）
- OFF-LIMITS（保留自原 v2 handoff）：
  - `src/electron/libs/cron/`、`src/ui/components/cron/`、`src/ui/pages/cron/`、`src/types/cron.ts`、`src/electron/libs/mcp-tools/cron.ts`
  - `AskUserQuestion` 工具（任何 phase 内都不要用）
  - `stash@{0}` / `stash@{1}`（不 pop，不丢）

## 已降级的闸门（恢复条件）

| 闸门 | 现状 | 恢复条件 |
|---|---|---|
| `ctx.minVersion` | `"2.1.0"`（接受 2.1.154） | 官方/claudelog 实际发布 2.1.161 条目后改回 `"2.1.161"` |
| `ctx.syncSource` | `"claudelog"`（fallback） | 官方 URL HTML 能匹配 v2.1.x heading 后改回 `"official"`；或 `extractOfficialSections` 重写 parser |
| `registry.facts[]` 必填 | **未启用**（Phase 2 还没写） | Phase 2 落地后启用 |

恢复时只需改 workflow 脚本顶部的 `ctx` 对象。

## Phase 2-10 Lane 拆分（plan §7 的 5 lane 落地版）

### Lane A — Registry 与 Fact 分类（Phase 2）

**Phase 2 目标**：把 changelog items 转成 `ClaudeCodeCompatFact[]`，含 8 类 category、4 级 severity、product target 推断、平台 tag。

**Files（4 写 + 1 test）**：
- `scripts/claude-code-compat-sync-lib.mjs`：加 `classifyCompatFacts(sections, items)`；加 `STABLE_FACT_ID` 生成器（基于 `${version}#${slug(rawText, 40)}`）
- `src/electron/libs/claude/claude-code-compat-registry.ts`：`ClaudeCodeCompatRegistry.facts: ClaudeCodeCompatFact[]` 字段加进 type；`renderRegistry` 输出空 facts 占位（避免 Phase 1 同步时把 facts 写丢）
- `src/electron/libs/claude/claude-code-compat-facts.ts`（新）：`ClaudeCodeCompatFact` type + `ClaudeCodeCompatFactCategory` / `ClaudeCodeCompatFactSeverity` 联合
- `test/electron/claude-code-compat-sync.test.mjs`：加 6 个新 test（security/runtime/plugin/model/observability/platform 各 1）

**Stub（最低落地）**：
```ts
// src/electron/libs/claude/claude-code-compat-facts.ts
export type ClaudeCodeCompatFactCategory =
  | "command" | "runtime" | "security" | "platform"
  | "plugin" | "model" | "observability" | "ui-copy";
export type ClaudeCodeCompatFactSeverity =
  | "info" | "compat" | "guardrail" | "breaking-risk";

export interface ClaudeCodeCompatFact {
  id: string;
  version: string;
  date: string;
  category: ClaudeCodeCompatFactCategory;
  severity: ClaudeCodeCompatFactSeverity;
  title: string;
  summary: string;
  rawText: string;
  commandNames?: string[];
  envKeys?: string[];
  configKeys?: string[];
  platformTags?: Array<"windows" | "wsl" | "macos" | "linux" | "browser">;
  productTargets: Array<
    "slash-catalog" | "runner" | "session-state" | "plugin-manager" |
    "settings-ui" | "activity-rail" | "qa" | "release-gate" | "docs"
  >;
  implemented: boolean;
  testIds: string[];
}
```

**Acceptance**：
- `registry.facts.length > 0`（基于当前 2.1.154 section 应有 ≥ 5 facts）
- 每个 `guardrail` / `breaking-risk` fact 有 ≥1 个 `productTargets`
- 每个 fact 字段齐全（id/version/date/category/severity）
- 6 个新 test 全绿

---

### Lane B — Runtime + Worktree 语义（Phase 3-5）

**Phase 3 — Slash Catalog Refresh**
- Files: `src/electron/libs/slash-command-catalog.ts`、`src/shared/slash-commands.ts`、`src/ui/utils/slash-command-display.ts`、`src/electron/libs/claude/claude-code-builtin-commands.ts`
- 新建: `test/electron/slash-commands.test.mjs` + `test/electron/slash-command-display.test.mjs`
- 工作量：~400 LOC（含 test）

**Phase 4 — Background Agent 状态机**
- Files: `src/shared/session-semantics.ts`（扩 `BackgroundAgentStatus` 8 态）、`src/shared/activity-rail-model.ts`、`src/electron/libs/runner/runner.ts` + `runner-reuse.ts`、`src/ui/components/ActivityRail.tsx`
- 新建: `test/electron/session-semantics.test.mjs`、`session-runtime-controls.test.mjs`、`claude-background-agent-state.test.mjs`
- 工作量：~600 LOC

**Phase 5 — Worktree 隔离**
- Files: `src/electron/libs/git/service.ts`、`src/electron/libs/runner/runner.ts`、`src/electron/libs/task/executor.ts`、`src/shared/linked-workspaces.ts`、`src/ui/components/git/GitWorkbenchPanel.tsx`
- 新建: `test/electron/claude-worktree-isolation.test.mjs`
- 工作量：~500 LOC

---

### Lane C — Security Guardrails（Phase 6）

- Files: `src/electron/libs/tool-output-sanitizer.ts`（扩 9 个 secret key 模式 + 7 类可执行 config 路径 + 危险 shell 检测 + 审计事件）、`tool-input-normalizer.ts`、`external-cli.ts`、`mcp-tools/tool-result.ts`、`runner.ts`、`runner-error.ts`
- 新建: `test/electron/claude-security-guardrails.test.mjs`、`tool-output-sanitizer.test.mjs`
- 工作量：~700 LOC（spec 列出 9 secret 模式 + 7 config 路径 + 4 类风险动作 + 审计事件 schema）

---

### Lane D — Plugin/Skills/Model/Platform（Phase 7-9）

**Phase 7 — Plugin + Skills**
- Files: `src/electron/libs/claude/claude-code-plugins.ts`（defaultEnabled 解析、依赖展示、MCP/LSP/工具名去重）、`skill-manager/{scanner,marketplace,sync-engine,tool-adapters}.ts`、`src/ui/components/settings/{PluginsSettingsPage,SkillsManagementPage,plugin-toast-messages}.tsx`
- 新建: 4 个 test 文件
- 工作量：~800 LOC

**Phase 8 — Model/Effort/Provider 兼容**
- Files: `src/shared/models/{model-provider-routing,model-routing-weight,api-model-metadata}.ts`、`src/ui/components/settings/ModelRoutingSettingsPage.tsx`、`src/ui/components/prompt-input/ComposerModelMenu.tsx`、`src/electron/libs/runner/runner.ts`
- 新建: `test/electron/claude-model-provider-capability.test.mjs`、`runtime-model-selection.test.mjs`
- 工作量：~600 LOC

**Phase 9 — Windows/WSL QA Lane**
- Files: `doc/50-quality/windows-wsl-claude-code-compat-checklist.md`（新建，10 个场景）
- 新建: `test/electron/windows-wsl-claude-qa.test.mjs`（≥5 个 smoke 自动化）
- 工作量：~400 LOC（清单 200 + test 200）

---

### Lane E — Release Gate（Phase 10）

- Files: `scripts/check-claude-code-compat.mjs`（新建，4 类检查：stale registry / unimplemented guardrail facts / breaking-risk facts 缺 testIds / current registry 通过）、`test/electron/claude-code-compat-release-gate.test.mjs`（新建）
- workflow 自身也要扩展：在 Phase 10 run 里调 `node scripts/check-claude-code-compat.mjs` 作为 dry-run 验证
- 工作量：~300 LOC

---

## 跨 session 推进建议

**单 session 推荐负载**：1-2 个 lane 中等 phase（~500-800 LOC 含 test）。
**不要把 Lane B/C/D 合并** —— 并行写大文件改 5+ 个 source 文件容易触发 3-file 写上限导致上下文爆。
**推荐拆分节奏**：
- Session 1（接续本 v3）：Lane A Phase 2 落地（事实分类器 + 6 个 test + registry 字段）
- Session 2：Lane C Phase 6 安全护栏（纯后端 + test，相对独立）
- Session 3：Lane B Phase 4 background agent（类型层 + UI 层）
- Session 4：Lane B Phase 5 worktree
- Session 5：Lane D Phase 7 plugin
- Session 6：Lane D Phase 8 model
- Session 7：Lane D Phase 9 + Lane E Phase 10（清单 + 闸门，量最小）
- Phase 3（slash catalog）可与任意 session 并行，因为只动 catalog/display 4 文件

## 重要风险

1. **Phase 2 写 `facts: []` 到 registry 后，会触发 Phase 1 的 `renderRegistry` 把 facts 写进文件**。如果 Phase 2 写得 bug，Phase 1 重跑会带 bug 落进 registry。**解决**：Phase 2 落地时把 facts 渲染逻辑放 `classifyCompatFacts` 之后、render 之前；fallback 是 Phase 1 同步时 `facts: []` 仍合法（不报错）。
2. **Codex CLI 升级**：当前 `codex v0.118.0 (research preview)` 不支持 `gpt-5.5`。Phase 1 完成后想跑 `codex review --commit HEAD` 需要先 `volta install codex@latest` 或 `npm i -g @openai/codex@latest`。
3. **`renderRegistry` 模板字段顺序敏感**：type 字段加 `sourceDigest?:` 时要保持 generatedAt 在前、commandItems 在后，否则 type compare 在 diff 里看着乱。参考现有顺序。
4. **stash@{1} v2 备份含已写好的 Phase 1-8 实现的**参考**版本**（不是 pop，是 Read）：下次 session 想看参考实现可 `git show stash@{1}:src/path/to/file.ts`，但不要 apply。

## 验证协议（每 session 收尾跑）

```bash
# 1. 跑该 session 涉及的 phase
node scripts/claude-code-compat-2161-workflow.mjs --phase N

# 2. 跑完整 preflight（任意时刻）
node scripts/claude-code-compat-2161-workflow.mjs --phase 0 --force

# 3. 看总状态
node scripts/claude-code-compat-2161-workflow.mjs --status

# 4. 全量回归（最后）
npm run transpile:electron
node scripts/claude-code-compat-2161-workflow.mjs
```

## 不该做的事

- 不要 pop stash
- 不要碰 cron 目录
- 不要回退 2.1.154 → 2.1.139 或更老（除非显式修 sync parser）
- 不要在 Phase 1 改回 `"2.1.161"` 闸门（claudelog 没有 2.1.161 条目，会死锁）
- 不要把 `facts: []` 字段加进 type 但不写 classify 函数（registry 会有空 facts 字段，Phase 10 release gate 没法跑）

## 接续指令模板

下一 session 启动后第一句：
> "接续 `.omc/state/sessions/current/compat-2161-handoff-v3.md` 的 Lane A Phase 2。"

跑 Phase 0（preflight 验 baseline），再进 Phase 2 实现 + test。

## 关键文件路径速查

```
.omc/state/sessions/current/compat-2161-handoff-v3.md     ← 本文件
.omx/plans/2026-06-03-claude-code-compat-2161-workflow-execution-spec.md
.omc/state/sessions/current/compat-2161-handoff-v2.md     ← 上一轮声明存在但磁盘上未创建
.tmp/claude-code-compat-preflight.txt                      ← Phase 0 报告
.tmp/claude-code-compat-sync-report.json                   ← Phase 1 sync 报告
.tmp/claude-code-compat-2161-state.json                    ← workflow 状态
scripts/sync-claude-code-compat.mjs                        ← Phase 1 入口
scripts/claude-code-compat-sync-lib.mjs                    ← Phase 1+2 共享库
scripts/claude-code-compat-2161-workflow.mjs               ← workflow runner
src/electron/libs/claude/claude-code-compat-registry.ts    ← 生成的 registry
src/electron/libs/claude/claude-code-compat-facts.ts       ← Phase 2 新建（待写）
```
