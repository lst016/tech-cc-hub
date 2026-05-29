---
doc_id: "PLAN-CLAUDE-CODE-COMPAT-2149"
title: "Claude Code 2.1.149 兼容升级实施计划"
doc_type: "delivery"
layer: "L4"
status: "active"
version: "1.0.0"
last_updated: "2026-05-28"
owners:
  - "tech-cc-hub Core"
audience:
  - "electron"
  - "frontend"
  - "qa"
tags:
  - "tech-cc-hub"
  - "claude-code"
  - "agent-sdk"
  - "compat"
  - "tdd"
sources:
  - "../../20-specs/20-AgentOS集成规范.md"
  - "../../20-specs/24-事件模型与可观测规范.md"
  - "./spec.md"
  - "https://claudelog.com/claude-code-changelog/"
---

# Claude Code 2.1.149 兼容升级实施计划

## Purpose

将 `tech-cc-hub` 当前停留在 Claude Code `2.1.139` 的兼容层，升级到以 `2.1.149` 为目标基线的兼容实现，并用 TDD 方式逐步落地。目标不是重写运行时，而是在已有 `@anthropic-ai/claude-agent-sdk ^0.3.150` 基础上补齐命令语义、兼容提示、usage 视图和 agent/background 会话语义。

## Baseline

当前确认状态：

- 依赖已升级到 `@anthropic-ai/claude-agent-sdk ^0.3.150`
- `runner.ts` 已接入 `resume`、`stderr`、`permissionMode`、`includePartialMessages`、`includeHookEvents`、`agentProgressSummaries`、`forwardSubagentText`
- `CLAUDE_PROJECT_DIR` 注入已存在
- Agent Teams 环境开关和最小版本判断已存在
- 兼容注册表仍停在 `2.1.139`
- 系统提示与 preset 命名仍硬编码为 `2139`
- slash command 种子仍含旧命令名，如 `/simplify`、`/extra-usage`
- 当前 usage breakdown 是 prompt ledger 视角，不是 Claude Code `2.1.149` 的“按来源拆分”视角

## Scope

本次计划包含：

- Claude Code changelog 同步脚本修正与 registry 刷新
- 内置 slash command 种子升级
- 兼容 preset 去版本硬编码
- `/usage` 分类拆分视图设计与落地
- agent/background session 语义补齐
- plugin details 元数据补齐
- 全流程测试先行与回归测试补强

本次计划不包含：

- 重写 `runner.ts` 主执行架构
- 复刻 Claude Code CLI 的 daemon / pin / OS-level 生命周期实现
- 改造非 Claude 侧的 Browser/Figma/CodeGraph 主流程

## Feature Tracks

### Track 1: Compat Sync Pipeline

目标：

- 将 changelog 抓取与 registry 生成从“可用”提升为“稳定可刷新”

涉及文件：

- `scripts/sync-claude-code-compat.mjs`
- `src/electron/libs/claude/claude-code-compat-registry.ts`
- `src/electron/libs/slash-command-catalog.ts`

TDD 顺序：

1. 先补 parser 单测，覆盖版本块提取、命令提取、无效命令过滤
2. 修正脚本，只保留真实 slash command 和明确的 `claude agents` / `plugin details` 兼容项
3. 刷新 registry 到 `2.1.149`
4. 验证 catalog 仍能稳定合并 builtin / compat / local command sources

完成标准：

- registry `sourceVersion` 为 `2.1.149`
- 不再出现 `code`、`docs`、`en`、`tokens`、`turns` 这类误提取命令

### Track 2: Slash Command Surface Refresh

目标：

- 让 app 里呈现的 Claude Code 命令名与当前 changelog 对齐

涉及文件：

- `src/electron/libs/claude/claude-code-builtin-commands.ts`
- `src/electron/libs/slash-command-catalog.ts`
- `test/electron/slash-commands.test.ts`

功能点：

- `/simplify` -> `/code-review`
- `/extra-usage` -> `/usage-credits`
- `/usage` 描述更新为支持分类 usage breakdown
- 保留旧命令 alias 的兼容策略

TDD 顺序：

1. 先写命令存在性和优先级测试
2. 再改 builtin command seed
3. 最后验证 catalog merge 行为

完成标准：

- 新命令可发现
- 旧命令不会意外覆盖新命令
- 本地 `.claude` 定义仍可正常叠加

### Track 3: Compat Prompt Generalization

目标：

- 去掉 `2139` 这种一次性命名，让 compat prompt 成为持续可升级模块

涉及文件：

- `src/electron/libs/system-prompt-presets.ts`
- `src/electron/libs/runner/runner.ts`
- `test/electron/system-prompt-presets.test.ts`

功能点：

- `buildClaudeCode2139FeaturePromptAppend` 重命名为版本无关入口
- preset label 从 `2.1.139` 改为当前 registry 驱动
- runner 调用点同步替换

TDD 顺序：

1. 先写 preset 输出和 label 测试
2. 再改命名与引用
3. 回归 runner 调用链

完成标准：

- 没有新的 `2139` 硬编码入口
- compat prompt 标题由 registry 版本驱动

### Track 4: Usage Breakdown Attribution

目标：

- 将当前 Context Usage 面板从 prompt ledger 维度，补强到 Claude Code 新增的 usage 来源维度

涉及文件：

- `src/ui/components/ActivityRail.tsx`
- `src/ui/utils/context-usage-breakdown.ts`
- `src/shared/activity-rail-model.ts`
- 可能补充 `src/electron/libs/runner/runner.ts` 事件采样
- `test/electron/context-usage-breakdown.test.ts`

功能点：

- 新增来源分类：skills、subagents、plugins、MCP servers、system/base prompt
- 与当前 prompt ledger 明细并存，而不是互相覆盖
- 无精确来源时，展示 derived estimate / unattributed bucket

TDD 顺序：

1. 先定义 breakdown 数据模型和归因测试
2. 再补 UI 构建函数
3. 最后接 ActivityRail 展示

完成标准：

- 用户能看见至少一级来源分类
- 无法精确归因的 token 不会被静默吞掉

### Track 5: Agent / Background Session Semantics

目标：

- 对齐 `2.1.142` 到 `2.1.147` 的 agent/background 语义，而不复刻 CLI 内部进程模型

涉及文件：

- `src/electron/libs/runner/runner-reuse.ts`
- `src/electron/ipc-handlers.ts`
- `src/shared/activity-rail-model.ts`
- `src/electron/types.ts`
- 对应测试：`test/electron/runner-status.test.ts`、新增 agent/session 语义测试

功能点：

- session 级别 foreground/background 标记
- 持久化 `model` / `effort` / `permissionMode`
- agent view 展示 blocker / waiting-input / completed
- `/resume` 语义与 background session 列表打通

TDD 顺序：

1. 先定义 session state 测试
2. 再补后端状态与 IPC
3. 最后补 rail / overview 展示

完成标准：

- background session 在 app 内有明确状态
- resume 场景不会丢失关键运行参数

### Track 6: Plugin Details Enrichment

目标：

- 对齐 `2.1.145` / `2.1.149` 的 plugin details 信息丰富度

涉及文件：

- `src/electron/libs/claude/claude-code-plugins.ts`
- `src/ui/components/settings/PluginsSettingsPage.tsx`
- 相关测试：`test/electron/claude-code-plugins.test.ts`、`test/electron/plugin-updates.test.ts`

功能点：

- source
- version
- status
- configured MCP servers
- tool count / tool names
- auth mode
- projected token impact
- LSP servers

TDD 顺序：

1. 先写 plugin metadata 聚合测试
2. 再改读取逻辑
3. 最后补设置页展示

完成标准：

- 插件详情不再只停留在“本地路径 + MCP server name”

## Delivery Phases

### Phase 1

- Track 1
- Track 2
- Track 3

目标：

- 先把兼容面刷新到可持续升级状态

### Phase 2

- Track 4

目标：

- 完成 usage breakdown 的产品级对齐

### Phase 3

- Track 5
- Track 6

目标：

- 补齐会话语义与插件详情

## TDD Working Agreement

每个 track 都遵循同一开发节奏：

1. 先写失败测试
2. 最小实现让测试变绿
3. 重构命名、抽取共用逻辑、去重复
4. 跑对应子集测试
5. 阶段完成后跑 lint、typecheck、关键回归测试

## Verification Matrix

每阶段至少执行：

- `npm run transpile:electron`
- `npm run build`
- `npm run lint`

按变更范围执行：

- `node --test dist-test/test/electron/slash-commands.test.js`
- `node --test dist-test/test/electron/context-usage-breakdown.test.js`
- `node --test dist-test/test/electron/system-prompt-presets.test.js`
- `node --test dist-test/test/electron/claude-code-plugins.test.js`
- `node --test dist-test/test/electron/runner-status.test.js`

## Risks

### Parser Drift

风险：

- changelog 页面结构再变，sync 脚本再次误提取

缓解：

- parser 单测用真实片段固化
- 无效命令过滤采用 allowlist + pattern 双重约束

### Overfitting To Claude CLI

风险：

- app 为了追 CLI 语义，误把 CLI 内部生命周期搬进本地架构

缓解：

- 只对齐用户可见语义，不复制 daemon / process manager 内核

### Usage Attribution Accuracy

风险：

- token 来源难以 100% 精确归因

缓解：

- 明确展示 estimated / unattributed bucket
- 不伪造精确数字

## Exit Criteria

- `2.1.149` registry 刷新完成
- compat preset 不再绑定 `2139`
- 新 slash command 表面已对齐
- usage breakdown 至少支持一级来源分类
- background session 语义在 app 内可见
- plugin details 信息明显提升
- 对应测试全部变绿

## Delivery Status

2026-05-28:

- Phase 1 完成：compat registry、slash command surface、version-agnostic compat prompt 已落地。
- Phase 2 完成：ActivityRail 已展示 source attribution / source drivers，并保留 estimated / unattributed 语义。
- Phase 3 完成：background session 语义已贯穿 store / IPC / ActivityRail / Sidebar；Claude Code plugin details 已聚合并接入设置页。
- Regression guard 完成：`renderRegistry` 已迁入可测 sync lib，防止再次生成错误的 shared import path。
- 验证通过：`npm run transpile:electron`、`npm run build`、touched-files `eslint`、38+ focused regression tests。
- 剩余环境限制：全仓 `npm run lint` 被既有 `.tmp/`、`.worktrees/`、旧文件 lint 问题阻塞；`session-archive` 被本地 `better-sqlite3` Node ABI 不匹配阻塞。
