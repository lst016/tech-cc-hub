---
doc_id: "PRD-100-60"
title: "60-实施任务单-ADP-SDK-跨版本适配-0.3.187"
doc_type: "delivery"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-07-01"
owners:
  - "Engineering"
  - "QA"
tags:
  - "tech-cc-hub"
  - "sdk"
  - "claude-agent-sdk"
  - "compat"
  - "delivery"
  - "tasks"
  - "adp"
---

# 60-实施任务单-ADP-SDK-跨版本适配-0.3.187

## Purpose

把跨 **33 个 minor 版本** 的 `@anthropic-ai/claude-agent-sdk` 升级（0.3.154 → 0.3.187）期间识别出的全部功能 / 事件 / 错误类型 / 选项差距，分解为按 Phase 可执行、可验收、可回滚的任务清单，并对接 `claude-code-compat-2161` 分支遗留工作。

本 spec 是 `ADAPT-001` 工作流的执行版本，所有改动以单一 diff、一份 Electron QA 验收收尾为单位，避免跨 Phase 连续编辑耗尽上下文。

## Scope

### In Scope

- TodoWrite → TaskCreate / TaskUpdate 主路径迁移（修复静默失效）
- runner.ts 中关键 SDK 选项补齐（`betas` / `additionalDirectories` / `managedSettings` / `sandbox.credentials`）
- 新增 Hook 事件注册（`MessageDisplay` / `ConfigChange` / `TeammateIdle` / `TaskCompleted`）
- 新字段消费（`origin` / `tool_use_meta` / `memory_recall` / `memory_paths`）
- 新错误类型分支（`refusal` / `overloaded` / `model_not_found` / `system/model_fallback`）
- 已退役模型 ID 清理（防调用即报 400）
- `startup()` 预热 / `getContextUsage()` / `experimental usage` 三大控制面 API
- 测试覆盖与 Electron 真窗口回归

### Out of Scope

- 完整 SDK bump 到 `0.3.196`（落入后续 `ADAPT-002` spec）
- model_not_found 的图片预处理链路（之前已在 `image-preprocessor.ts` 修过）
- Windows Bash / PowerShell 安全 guardrail（已在 `compat-security-guardrails.ts` 落地）
- 已稳定的 `compat-2161` 1~11 Phase 中已完成的硬规则（直接 Reuse，不重写）

## Background

| 字段 | 值 |
|---|---|
| 起点 SDK 版本（`compat-registry.ts` 锚点） | `0.3.154` |
| 当前 SDK 版本（`package.json`） | `^0.3.187`（33 版本升级） |
| 最新 SDK 版本（npm `dist-tags.latest`） | `0.3.196` |
| 起点 Claude Code parity | `2.1.154`（2026-05-28） |
| 当前 Claude Code parity | `2.1.187`（2026-06-23） |
| `compat-registry.ts` 上次同步 | `2026-06-03T15:19:03.495Z`（Claude Code 2.1.154） |
| `compat-registry.ts` 中 fact 总数 | 44 |
| `compat-registry.ts` 中 `implemented: false` 数 | 44（**全部未实施**） |
| 历史遗留分支 | `claude-code-compat-2161`（11 Phase，Phase 5/6/10 未真做实现） |
| 上一次真升级 SDK commit | `caf030e chore(deps): upgrade claude-agent-sdk` |

## Actors / Owners

- **Owner**: Engineering（runner / IPC）+ Frontend（EventCard / ActivityRail / useAppStore）
- **QA**: `qa:smoke` / `qa:continue` / `qa:slash` + Electron 真窗口截图
- **Reviewer**: 跑前 spec review（不是执行 review）
- **Reader**: 接续 spec 的 Agent（任何会话）

## Inputs / Outputs

### Inputs

- `doc/30-research/sdk-changelog/claude-agent-sdk-full-record.md`（2746 行版本全记录）
- `doc/30-research/sdk-changelog/claude-agent-sdk-index.md`（索引）
- `src/electron/libs/claude/claude-code-compat-facts.ts`（fact 分类规则）
- `src/electron/libs/claude/claude-code-compat-registry.ts`（已登记 fact 表）
- `.omc/state/sessions/current/compat-2161-handoff.md`（如存在）

### Outputs

- 按 Phase 修改后的 `src/` 改动
- Phase 完成后 `git diff --stat` 摘要
- Phase QA 命令通过 / 失败证据
- Electron 真窗口验证截图（如在 desktop 跑过）

## Core Concepts

- **`TaskTools 替代 TodoWrite`**：SDK 0.2.136 弃用 TodoWrite → 0.3.142 删除并强制改用 `TaskCreate/TaskGet/TaskUpdate/TaskList`。任何仍按 `toolName === "TodoWrite"` 分支的代码进入 0.3.142+ 后会变成"看起来跑得动但 plan 面板空"。
- **`betas` 头不传就不生效**：1M context（`context-1m-2025-08-07`）等 beta 特性必须显式在 runner 的 `options.betas` 里启用，否则 Sonnet 4.5 仍为 200k context。
- **`SandboxSettings` 是结构化对象**：从 `sandbox: true` 字面升级到完整 `{enabled, filesystem, network, credentials}`，否则只能"启用沙箱"，不能说"凭据文件 deny"。
- **`MessageDisplay` hook 是给 UI 看的中间层**：与 PostToolUse 不同，它专门用于把 assistant 消息转 / 换 / 隐藏给最终用户。
- **`tool_use_meta` 是协议字段**：`tool_use_meta.displayName`（0.3.179）/ `tool_use_meta.icon_url`（0.3.181）从 MCP server 目录元数据拉，UI 必须显式消费。
- **`compat-registry.ts` 单调滞后于 SDK**：任何 SDK 升级后必须 `node scripts/sync-claude-code-compat.mjs` 同步，否则 `implemented: false` 数累积。

## Behavior / Flow

### 阶段概览

| Phase | 主题 | 风险级别 | 文件数估算 | QA 验收 |
|---|---|---|---|---|
| **Phase A** | 立即修复（功能直接坏） | 🔴 Critical | ~8 | 必跑 3 个 + Electron |
| **Phase B** | 增强补齐（功能增量） | 🟡 Important | ~12 | 必跑 3 个 + Electron |
| **Phase C** | 长尾 + 下一轮 bump | 🟢 Low | ~6 | 选跑 |

---

### Phase A — 必须立即修复（功能直接坏）

#### A.1 runner.ts 移除 TodoWrite 处理，迁移到 Task 工具链

**问题**：SDK 0.3.142 起发的是 `TaskCreate/TaskUpdate`，主路径仍按 `TodoWrite` 分支处理 plan 更新，导致 plan 面板 / ActivityRail "TodoWrite 兼容" 路径空转。

**改动文件**：

- `src/electron/libs/runner/runner.ts` 行 41, 690-693, 2119-2123
  - 删 `import { ..., normalizeTodoWriteArgs, ... }` 中的 `normalizeTodoWriteArgs` 引用
  - 删两处 `if (toolName === "TodoWrite")` 分支（含 `sendPlanUpdate(args, "todo_write", toolName, toolUseId, turnId)`）
  - 改为 `if (toolName === "TaskCreate" || toolName === "TaskUpdate")`，`source` 传 `task_create`，并为 `TaskCreate` 传 `args.items`、为 `TaskUpdate` 传 `{...args, item: args}`（按 schema 归一）

- `src/shared/plan-progress.ts` 行 13, 67
  - `SessionPlanSource = "update_plan" | "task_create"`（去掉 `"todo_write"`）
  - 删 `normalizeTodoWriteArgs` 函数体（连同所有调用方）
  - 新增 `normalizeTaskCreateArgs(input)`：接受 `{items: [{content, status, active_form}]}` 数组，转为 `UpdatePlanArgs[]`

- `src/ui/store/useAppStore.ts` 行 24, 329-336
  - 删 `import { normalizeTodoWriteArgs }`
  - `toolName === "TodoWrite"` → `["TaskCreate", "TaskUpdate"].includes(toolName)`
  - `source: "todo_write"` → `source: "task_create"`

- `src/ui/components/ActivityRail.tsx` 行 773
  - 文案 `"TodoWrite 兼容"` → `"Task 工具链"`
  - `sourceLabel` 映射补 `"task_create"`

**验收**：

- `grep -rn "TodoWrite\|todo_write" src/` 输出仅剩注释
- `npx tsc --noEmit` 通过
- `npm run qa:smoke` / `qa:continue` 通过
- Electron 真窗口手动跑"分 3 步完成某任务"的请求，plan 面板显示 `TaskCreate` + `TaskUpdate` 步骤

#### A.2 EventCard 改造 TodoWrite 渲染分支

**问题**：EventCard 字面量映射仍以 `TodoWrite: "计划更新"` 输出，且渲染守卫用 `messageContent.name === "TodoWrite"`。

**改动文件**：

- `src/ui/components/EventCard.tsx` 行 1351, 1509
  - 删字面量 `TodoWrite: "计划更新"`
  - 新增 `TaskCreate: "新增任务"` / `TaskUpdate: "更新任务"` / `TaskList: "任务列表"` / `TaskGet: "获取任务"`
  - 渲染守卫从 `messageContent.name === "TodoWrite"` 改为 `["TaskCreate", "TaskUpdate", "TaskList", "TaskGet"].includes(messageContent.name)`
  - 数据归一复用 `normalizeTaskCreateArgs`，渲染 todo 项用 `item.content` + `item.status`

- `src/shared/claude-agent-teams.ts` 行 11-14
  - 把硬编码字符串 `["TaskCreate", "TaskGet", "TaskUpdate", "TaskList"]` 导出为一个 `const TASK_TOOL_NAMES = [...] as const`，runner / store / EventCard 共享同一个 source of truth

**验收**：

- `qa:slash` 通过（`/tasks` 类的指令触发后，EventCard 正确展示任务列表）
- Electron 真窗口手动跑一条"给我列 3 件事你要做"的请求，EventCard 显示 `TaskCreate` 行

#### A.3 runner.ts 注入 `betas` 选项

**问题**：runner 没传 `betas`，导致 Sonnet 4 / 4.5 拿不到 1M context，Opus 4.8 拿不到 fast mode research preview，claude-fable-5 拿不到模型启用头。

**改动文件**：

- `src/electron/libs/runner/runner.ts` 行 854-885（`options: {}` 块）
  - 新增 `betas: buildBetasForModel(effectiveModel)` 函数（新建 `src/electron/libs/claude/claude-betas.ts`）
  - 函数逻辑：
    - Sonnet 4 / 4.5：`['context-1m-2025-08-07']`（1M context beta 启用）
    - Opus 4.7+：`['fast-mode-2026-02-01']`（如果开启 fast mode）
    - Opus 4.8：默认加 `'effort-2026-05-01'`（effort 参数 GA 后可省）
    - claude-fable-5：`['reasoning-extraction-2026-06-09']`（如果适用）

- `src/electron/libs/claude/claude-betas.ts`（新建）
  - 导出 `buildBetasForModel(model: string): string[]`
  - 内部用 allowlist + model 版本比对，不引入危险分支

**验收**：

- `npx tsc --noEmit` 通过
- 选 Sonnet 4.6 跑 session，CLI 在请求头里看到 `anthropic-beta: context-1m-2025-08-07`
- 选 Opus 4.8 并开 fast mode，CLI 看到 `fast-mode-2026-02-01`

#### A.4 清理已退役模型 ID 引用

**问题**：硬编码 `claude-sonnet-4-20250514` 等已退役 model 调用即报 400，UI 列表也不应再显示它们。

**改动文件**（grep 命中后逐步改）：

- `src/electron/libs/claude/claude-settings.ts`
- `src/ui/components/models/ModelSelect.tsx` 行 129-326
- `src/ui/components/settings/ModelRoutingSettingsPage.tsx`
- 其他 `src/` 下 `*-20250514` / `*-20240307` / `*-20250219` / `*-20241022` / `*-20240229` 等日期 ID 位置
- 任何 fallback / 默认路由里出现的硬编码 model ID

**禁止使用的已退役 ID**：

| 模型 ID | 退役日期 |
|---|---|
| `claude-sonnet-4-20250514` | 2026-06-15 |
| `claude-opus-4-20250514` | 2026-06-15 |
| `claude-3-haiku-20240307` | 2026-04-20 |
| `claude-opus-4-1-20250805` | 2026-08-05（即将） |
| `claude-3-opus-20240229` | 2026-01-05 |
| `claude-3-7-sonnet-20250219` | 2026-02-19 |
| `claude-3-5-haiku-20241022` | 2026-02-19 |
| `claude-sonnet-3.5` / `claude-haiku-3.5` 等模糊命名 | 验证后清理 |

**验收**：

- `grep -rn "claude-sonnet-4-20250514\|claude-opus-4-20250514\|claude-3-haiku-20240307\|claude-3-opus-20240229\|claude-3-7-sonnet-20250219\|claude-3-5-haiku-20241022" src/` 输出为空
- Model picker 只显示支持列表内的 ID
- 调用已退役 ID 时 `runner-error.ts` 抛 friendly error

---

### Phase B — 建议补齐（功能增强）

#### B.1 sandbox.credentials + 完整 SandboxSettings

**改动文件**：

- `src/electron/libs/runner/runner.ts`（options 块）
- `src/electron/libs/browser-workbench/browser-workbench-session.ts` 行 6, 15（字面 `sandbox: true` → 结构化）
- `src/electron/libs/claude/claude-sandbox-policy.ts`（新建）

**Schema 示例**：

```ts
import type { SandboxSettings } from "@anthropic-ai/claude-agent-sdk";

const policy: SandboxSettings = {
  enabled: true,
  filesystem: {
    denyRead: ["~/.ssh/**", "~/.aws/**", "~/.config/gh/**", "/etc/shadow"],
    allowWrite: ["$WORKSPACE/**"],
  },
  network: {
    allowUnixSockets: [],
    allowLocalBinding: [8080, 5173],
  },
  credentials: {
    denyFile: ["/etc/passwd", "/etc/shadow", "~/.netrc"],
    denyEnv: ["AWS_*", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GITHUB_TOKEN"],
  },
  failIfUnavailable: true,
};
```

**验收**：

- sandbox 启用时 `cat ~/.ssh/id_rsa` 被拒且 UI 提示 `Blocked by sandbox.credentials`
- sandbox 未启用时 deny 规则不生效（向后兼容）
- Electron 真窗口手动跑一个 sandbox 测试命令，确认 deny 行为生效

#### B.2 runner.ts 注册新 Hook

**改动文件**：

- `src/electron/libs/runner/runner.ts`（hooks 块）
- `src/electron/libs/learning/learning-hooks.ts`（追加 hook 实现）
- `src/electron/libs/claude/claude-hook-event-router.ts`（新建，统一 hook→前端 IPC）

**新增 Hook 处理**：

| Hook | 引入 | 目的 | 处理位置 |
|---|---|---|---|
| `MessageDisplay` | 0.3.152 | UI 文案转换/隐藏 | `learning-hooks.ts` → 投喂 IPC |
| `ConfigChange` | 0.2.49 | settings 变更回调 | `learning-hooks.ts` → emit `settings-changed` |
| `TeammateIdle` | 0.2.33 | iTerm2 多 agent idle | `learning-hooks.ts` → ActivityRail 提示 |
| `TaskCompleted` | 0.2.33 | subagent 任务完成 | `learning-hooks.ts` → ActivityRail 子任务收尾 |
| `PreCompact` | 早期 | 上下文压缩前回调（确认已在） | 若未注册则补上 |

**验收**：

- 跑 teammate 模式下，`TaskCompleted` hook 被触发，ActivityRail 出现 "subagent X 完成 Y"
- 修改 user-level settings（`~/.claude/settings.json`），`ConfigChange` hook 触发并发回前端
- 多 step 任务完成后 `MessageDisplay` 被链路上的 transform 处理过

#### B.3 tool_use_meta 字段消费

**改动文件**：

- `src/ui/components/EventCard.tsx`
- `src/ui/components/ActivityRail.tsx`
- `src/shared/claude-agent-teams.ts`

**字段**：

- `tool_use_meta.displayName`（0.3.179）→ 友好显示名（覆盖技术 tool 名称）
- `tool_use_meta.icon_url`（0.3.181）→ MCP server directory 元数据拉取的图标
- `tool_use_meta.mcp_server_name`（0.3.181+）→ MCP 来源标注

**验收**：

- MCP 工具渲染显示友好名 + 图标
- ActivityRail 工具行显示 `→ [图标] Connector Service | search` 而非 `→ mcp__connector__search`

#### B.4 result 消息 origin 字段 + refusal/refusal stop_reason 消费

**改动文件**：

- `src/electron/libs/util.ts` 行 99-104（`runSinglePromptQuery`）
- `src/electron/libs/runner/runner.ts`（result 消费链）
- `src/electron/libs/runner/runner-reuse.ts`（reuse key 多包含 `origin`）
- `src/electron/libs/runner/runner-error.ts`（refusal 友好提示）

**消费点**：

- `result.origin` 记录到 session 日志（SDKMessageOrigin 路径）
- `result.stop_reason === "refusal"` → 跑 friendly 文案，触发用户侧安全提示
- `result.usage.*` 字段跨版本归一（`error: 'overloaded'` 替代 529 限速、`'model_not_found'` 替代 4xx not found）
- `result.usage.output_tokens_details.thinking_tokens`（0.5.x 起）→ 面板显示

**验收**：

- 日志中能看到 `origin: "sdk-query-7f8a"` 记录
- 触发 refusal（提供危险输入）后 UI 显示安全拒绝原因而非静默结束
- 5xx 流式错误在 `error: 'overloaded'` 路径被正确识别

#### B.5 startup() 预热 CLI 子进程

**改动文件**：

- `src/electron/main.ts`（Electron ready 钩子）
- `src/electron/libs/util.ts`

**改动**：

```ts
// main.ts: after app.whenReady()
import { startup } from "@anthropic-ai/claude-agent-sdk";
app.whenReady().then(async () => {
  try {
    await startup({ env: getEnhancedEnv() });
  } catch (e) {
    console.warn("[startup] prewarm failed", e);
  }
  // ... 原有启动逻辑
});
```

**验收**：

- Electron 启动后 5 秒内调 `startup()`
- 首次 query 延迟对比：启用前 ~800ms → 启用后 ≤200ms
- 预热失败不应阻塞主流程（只在 console.warn 输出）

#### B.6 getContextUsage() 接入

**改动文件**：

- `src/ui/components/ActivityRail.tsx`（context % 显示）
- `src/shared/activity-rail-model.ts`
- `src/electron/libs/runner/runner-reuse.ts`

**验收**：

- 主聊天顶栏 context % 用真实值，与 `usage.input_tokens` 同步
- 长会话中 context 数字随 message 增加而线性增长

---

### Phase C — 长尾与下一轮 bump

#### C.1 additionalDirectories / managedSettings / applyFlagSettings
- 接入 `Options.additionalDirectories` 让多目录 CLAUDE.md 加载
- 接入 `Options.managedSettings` 注入 policy-tier
- 接入 `applyFlagSettings()` 运行时热改 settings

#### C.2 experimental usage_EXPERIMENTAL_MAY_CHANGE()
- 引入 `Query.experimental_usage_EXPERIMENTAL_MAY_CHANGE()` 返回 detailed usage
- 接入计费面板

#### C.3 McpServerStatus.reconnect / toggle / setMcpServers
- 暴露 IPC 让用户手动重连某个 MCP server
- 接收 SDK `mcp_set_servers` 控制请求做 runtime MCP 调整

#### C.4 system/memory_recall + memory_paths
- 处理 `system/init` 消息新增 `memory_paths` 字段
- 监听 `system/memory_recall` 事件触发记忆拉取流程

#### C.5 bump 到 0.3.196（Parity with Claude Code v2.1.196）
- 后续另起 `ADAPT-002` spec
- 重点验证 0.3.196 的 control-protocol 去重修复（避免重复 tool_result）

#### C.6 同步 claude-code-compat-registry.ts 到 2.1.187+
- `node scripts/sync-claude-code-compat.mjs` 重跑
- 把 0.3.155-0.3.187 期间的 fact 全部登记
- 默认 `implemented: false`，逐项落地

---

## Interfaces / Types

- 完整 SDK 版本记录：`doc/30-research/sdk-changelog/claude-agent-sdk-full-record.md`
- 简版索引：`doc/30-research/sdk-changelog/claude-agent-sdk-index.md`
- 兼容层事实定义：`src/electron/libs/claude/claude-code-compat-facts.ts`
- 兼容层 fact 注册表：`src/electron/libs/claude/claude-code-compat-registry.ts`
- 兼容执行 handoff：`.omc/state/sessions/current/compat-2161-handoff.md`（如存在）
- compat-2161 兼容 spec：`doc/30-research/sdk-changelog/claude-agent-sdk-full-record.md#compat-2161-影响分析`

---

## Failure Modes

| 风险 | 触发 | 缓解 |
|---|---|---|
| TodoWrite 路径上的 event 历史数据无法向后兼容 | 升级后历史数据无 task 工具记录 | store 层对旧 `source: "todo_write"` 历史 fallback 渲染为历史 chunk；新数据走 `task_create`；schema 加 migration |
| 用户环境的 CLI 已升 0.3.196 但 compat 层停留 0.3.187 | npm 解析到更新但代码未 adapt | `package.json` 加 `"overrides": { "@anthropic-ai/claude-agent-sdk": "^0.3.187 <0.3.196" }`，等 ADAPT-002 跑完再放开 |
| `betas` 注入导致不支持的 model 报 400 | 误把 fast mode beta 加到 haiku | runner 层加 model allowlist 校验；`buildBetasForModel` 内部对照 SDK 0.3.187 文档 |
| sandbox deny 规则过严导致正常功能坏 | 误把 `~/.git/` 全 deny | 渐进式启用：先只 deny 凭据目录，再 deny ssh/aws；允许 `$WORKSPACE/**` 写入 |
| Hook 注册引入回归 | 旧 SDK 版本无 `MessageDisplay` 等类型 | 加运行时 capability 检测：`HookEventName in supportedHooks`；fallback 到无 hook |
| 关闭 Auth 后 pathToClaudeCodeExecutable 指错路径 | dev / packaged 路径不一致 | `getClaudeCodePath()` 加 fallback 链；同 util.ts 中的 env 注入 |
| `startup()` 失败阻塞主进程 | spawn 失败抛 sync error | 包 try/catch 只 console.warn 不抛；prewarm 在 ready 后非主路径 |

---

## Acceptance Gates

### Gate-A 完成（Phase A 全完成）

- [ ] `grep -rn "TodoWrite\|todo_write" src/` 输出仅剩注释
- [ ] `npm run qa:smoke` ✅
- [ ] `npm run qa:continue` ✅（多轮 round-trip）
- [ ] `npm run qa:slash` ✅
- [ ] `npx tsc --noEmit` 通过
- [ ] Electron 真窗口手动跑"分 3 步完成某任务"的请求，plan 面板显示 `TaskCreate` / `TaskUpdate` 步骤
- [ ] 选 Sonnet 4.6 模型会话，CLI 请求头含 `anthropic-beta: context-1m-2025-08-07`
- [ ] 已退役模型 ID grep 命中为空
- [ ] Git diff 摘要写到回复

### Gate-B 完成（Phase B 全完成）

- [ ] `npm run qa:smoke` / `qa:continue` / `qa:slash` ✅
- [ ] sandbox 开启时 `cat ~/.ssh/id_rsa` 被拒（electron-autostart 跑自定义 prompt）
- [ ] 启动延迟：首次 query ≤200ms（与 Gate-A 基线对比）
- [ ] context % UI 与 `usage.input_tokens` 同步
- [ ] refusal 触发后 UI 显示友好原因
- [ ] teammate 模式下 ActivityRail 收到 TaskCompleted 消息

### Gate-C 完成

- [ ] `additionalDirectories` 文档说明已落到 README
- [ ] `experimental usage` 入口暴露（可关闭 by flag）
- [ ] IPC 可让前端手动 `reconnectMcpServer`
- [ ] 全量 SDK bump 到 0.3.196 已落到 `ADAPT-002` spec
- [ ] `claude-code-compat-registry.ts` 同步到 ≥ 2.1.187

---

## Observability

- Phase 完成时输出每阶段改动文件清单（`git diff --stat` 摘要）
- 阶段完成时跑 QA 命令收集通过 / 失败证据
- Electron 真窗口验证保留截图到 `scripts/qa/electron-autostart-smoke.sh` 输出目录
- ClaudeCodeCompatFact 落地一处更新一处（`implemented: true` + `testIds: [...]`）
- 关键 trace：`session/result` 的 `origin` 字段、`MessageDisplay` 转换链

---

## 执行纪律（来自 `CLAUDE.md` 与 memory）

### 单轮 ≤ 3 文件写入

每次 Phase 子任务的单轮写入 ≤ 3 文件。超过 3 必须中断、报告进度、等用户确认。

### 跨 Phase 中断

每个 Phase 完成报告如下信息后中断：

```
Phase A 完成 (ADP-1.x)
────────────────────────────────────
改动文件:
  - src/electron/libs/runner/runner.ts (lines 41, 690-693, 2119-2123)
  - src/shared/plan-progress.ts (lines 13, 67)
  - src/ui/store/useAppStore.ts (lines 24, 329-336)

QA 验证:
  - npm run qa:smoke     ✅
  - npm run qa:continue  ✅
  - npm run qa:slash     ✅
  - npx tsc --noEmit     ✅

Electron 真窗口验证:
  - 截图保留路径 (如有)

未完成项 / 已知问题:
  - 无

下一步建议:
  - 用户确认后进 Phase A.2
```

### 用户授权连续执行

如果用户在某轮说「继续 / 全部执行完 / 不要问 / 并发执行」，则取消 Phase 间中断，连续推进直到任务完成或遇到阻塞，单轮 ≤ 3 文件上限仍生效，全部完成后一次性报告。

### 上下文健康度

每轮开始前检查工具输出占比。如果工具输出占 Prompt > 80%，先输出 3-5 条事实摘要再进入执行。

### lore trailer

每 Phase 完成后 commit 带 Lore 6 段 trailer（如果用户允许 commit）：

```
feat: ADP-SDK-0.3.187-A.1 移除 TodoWrite 处理，迁移到 Task 工具链

Phase A.1 of ADAPT-001: SDK 0.3.154→0.3.187 跨版本适配。

- runner.ts: 删两处 TodoWrite 分支，改用 TaskCreate/TaskUpdate
- plan-progress.ts: SessionPlanSource 去掉 todo_write，新增 normalizeTaskCreateArgs
- useAppStore.ts: toolName 分支跟随
- ActivityRail.tsx: 文案兜底

Why: SDK 0.3.142 起 TodoWrite 被强制替换为 TaskCreate/TaskUpdate，否则 plan 面板静默失效。
How to apply: 单轮 ≤3 文件；qa:continue 必须通过；Electron 真窗口验证 plan 面板。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## 已识别的可复用资产（避免重写）

下列在 compat-2161 1~11 Phase 已经做过相关的部分，新一轮直接复用而非重写：

- `src/electron/libs/compat-security-guardrails.ts` — Phase 6 落地
- `src/electron/libs/compat-plugin-default-enabled.ts` — Phase 5 落地
- `src/electron/libs/compat-model-provider-capability.ts` — Phase 3 落地
- `src/electron/libs/anthropic/anthropic-compat-proxy.ts` — 模型路由兼容
- `src/electron/libs/anthropic/anthropic-compat.ts` — 第一方 Anthropic API 兼容
- `src/ui/components/learning/` — 学习页 React bits
- `src/electron/libs/runner/runner-error.ts` — 错误分类（已含 model_not_found）

每个 Phase 子任务实施前先 grep 一下是否已有兼容层，避免重复实现。

---

## Reference

- 项目根 `D:/tool/tech-cc-hub`
- CLAUDE.md — 任务执行纪律
- compat-2161 handoff: `.omc/state/sessions/current/compat-2161-handoff.md`
- compat-2161 影响分析: `doc/30-research/sdk-changelog/claude-agent-sdk-full-record.md` § compat-2161
- compat-2161 历史执行: `git log --grep="compat" --oneline | head -20`
- 下一轮 bump spec: `doc/40-product/1.0.0/40-delivery/61-实施任务单-ADAPT-002-SDK-0.3.196.md`（如未创建则先留占位）
