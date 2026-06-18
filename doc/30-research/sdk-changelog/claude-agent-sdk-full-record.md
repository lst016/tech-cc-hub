# @anthropic-ai/claude-agent-sdk 全量版本更新记录

> 本文档由 workflow 自动生成,基于 npm registry + GitHub releases + CHANGELOG.md 整合。
> 配套简版索引请参考同目录下 `claude-agent-sdk-index.md`。
> 本文件用于本项目 (tech-cc-hub) 跟踪 Claude Agent SDK 能力变化,直接服务 `claude-code-compat-2161` 兼容性工作。

## 概览

- **当前安装版本**: 0.3.154
- **npm 包名**: @anthropic-ai/claude-agent-sdk
- **官方仓库**: anthropics/claude-agent-sdk-typescript
  - 仓库 URL: https://github.com/anthropics/claude-agent-sdk-typescript
  - releases 列表: https://github.com/anthropics/claude-agent-sdk-typescript/releases
  - CHANGELOG: https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md
- **总版本数**: 222
- **收录范围**: 0.0.4 (2025-09-27) → 0.3.181 (2026-06-17)
- **数据完整度**: rich (rich = 找到 CHANGELOG.md;medium = 仅有 GitHub releases;sparse = 仅 npm 时间戳)
- **生成时间**: 2026-06-18
- **数据来源**:
  - npm registry: https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk
  - GitHub releases: https://github.com/anthropics/claude-agent-sdk-typescript/releases
  - CHANGELOG: https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md

## 统计

- **总版本数**: 222
- **含 release notes 的版本数**: 约 199 (rich 数据集中含明确 changelogSnippet 非空字符串的版本;其余为 "无 release notes" 标记,通常是 parity 跟版 + 杂项修复)
- **含 breaking changes 的版本数**: 11 (粗略统计,见下文"破坏性变更汇总"段)
- **最早发布日期**: 2025-09-27 (0.0.4)
- **最新发布日期**: 2026-06-17 (0.3.181)
- **总跨度**: 263 天
- **平均发布间隔**: 约 1.21 天
- **minor 分布**:
  - 0.0.x: 1 个 (0.0.4)
  - 0.1.x: 65 个 (0.1.0 ~ 0.1.77)
  - 0.2.x: 120 个 (0.2.0 ~ 0.2.141)
  - 0.3.x: 36 个 (0.3.142 ~ 0.3.181)

## 版本时间线 (新→旧)

完整 timeline 表格见 `claude-agent-sdk-index.md` 的"时间线"段。下文按 minor 分组提供详细日志。

## 详细版本日志

### 0.3.x (2026-05-14 → 2026-06-17)

0.3 是一次明确的 major-bump 候补小版本号,反映 API 稳定化: 移除 v2 session API、Task 工具替代 TodoWrite、SDK 内部架构切换到 native binary、peer dep 调整。

#### 0.3.181 (2026-06-17)

**破坏性变更**
- 无

**新功能**
- `SDKRateLimitInfo` 新增 `errorCode`、`canUserPurchaseCredits`、`hasChargeableSavedPaymentMethod` 字段,用于检测需要充值的速率限制
- assistant 消息新增 `tool_use_meta.icon_url`,从 MCP server directory metadata 填充

**Bug 修复**
- 修复 SDK-hosted Remote Control session 丢失 inbound user message 中的 `file_attachments`

**废弃**
- 无

**迁移说明**
- 处理 rate limit 的下游代码可开始消费 `errorCode` / `canUserPurchaseCredits`;原本依赖 `file_attachments` 透传的 Remote Control 集成现已自动恢复

**原始 release notes**
> Added `errorCode`, `canUserPurchaseCredits`, and `hasChargeableSavedPaymentMethod` fields to `SDKRateLimitInfo` for detecting credits-required rate limits
> Added `tool_use_meta.icon_url` to assistant messages, populated from MCP server directory metadata
> Fixed SDK-hosted Remote Control sessions dropping `file_attachments` from inbound user messages

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.181
- https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk/v/0.3.181

#### 0.3.180 (撤回)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版 Claude Code v2.1.180)

**Bug 修复**
- 无明确记录 (parity 跟版,继承自 Claude Code v2.1.180 修复集)

**废弃**
- 无

**迁移说明**
- **npm registry 状态**: 此版本曾在 `npm view @anthropic-ai/claude-agent-sdk versions` 列表中出现,但 `time` 表中无对应记录且 `npm view @0.3.180` 返回 404 → 已被 Anthropic 撤回/不发布。CHANGELOG.md 中保留条目仅用于回溯记录,生产环境请跳过该版本,直接使用 0.3.181

**原始 release notes**
> Updated to parity with Claude Code v2.1.180

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.180 (CHANGELOG 留存)

#### 0.3.179 (2026-06-16)

**破坏性变更**
- 无

**新功能**
- assistant 消息新增可选的 `tool_use_meta` sidecar,携带 tool call 的友好显示名,SDK 消费者可直接渲染可读标签而不必用 wire name 自行映射

**Bug 修复**
- 修复 `-p` 模式在 background agent 完成通知到达前退出,导致中间文本被当成最终结果发出
- 修复 remote (stream-json) session 在整个 background workflow 期间一直显示 busy;turn 边界会发 turn result,后台任务继续时 session 报 idle

**废弃**
- 无

**迁移说明**
- 依赖 `-p` 模式最终输出做下游流水线的代码需复测: 之前可能丢的背景通知,0.3.179 起会等待完成

**原始 release notes**
> Added optional `tool_use_meta` sidecar to assistant messages with display-friendly names for tool calls, so SDK consumers can render human-readable labels instead of raw wire names
> Fixed `-p` mode exiting before a completed background agent's notification was delivered, causing interim text to ship as the final result
> Fixed remote (stream-json) sessions appearing busy for the entire duration of a background workflow — the turn result is now emitted at the turn boundary and the session reports idle while background tasks continue

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.179

#### 0.3.178 (2026-06-15)

**破坏性变更**
- 无

**新功能**
- spawn 失败时若检测到现有 native binary 的 libc 不匹配 (musl binary 跑在 glibc host),错误信息会提示使用 `options.pathToClaudeCodeExecutable` 指定正确版本
- Permission-denied 通知消息现在携带 typed denial reasons (`safetyCheck`、`asyncAgent`),SDK 消费者可编程匹配拒绝原因
- Remote Control worker 在 graceful exit 时发送 `worker_shutting_down` 系统消息,远端客户端可显示退出原因

**Bug 修复**
- 修复 `UserPromptSubmit` hook block feedback 未发出到 SDK event stream — 之前 hook 阻止 prompt 会导致 SDK 静默挂起
- 修复 MCP server 级规格 (`mcp__server`、`mcp__server__*`) 在 `disallowedTools` 中被静默忽略 — 现在会正确移除该 server 所有工具

**废弃**
- 无

**迁移说明**
- 使用 `UserPromptSubmit` hook 做 prompt gating 的集成需要确认 SDK 端能看到 block feedback
- 用 `disallowedTools` 屏蔽整个 MCP server 名的代码现已生效,无需另写 hook

**原始 release notes**
> Spawn failures on an existing native binary now explain the likely libc mismatch (musl binary on a glibc host) and suggest `options.pathToClaudeCodeExecutable`
> Permission-denied advisory messages now carry typed denial reasons (`safetyCheck`, `asyncAgent`), enabling SDK consumers to programmatically match denial causes
> Fixed `UserPromptSubmit` hook block feedback not being emitted to the SDK event stream — consumers can now see why a prompt was blocked by a hook instead of a silent hang
> Remote Control workers now send a `worker_shutting_down` system message on graceful exit so remote clients can show why the session ended
> Fixed MCP server-level specs (`mcp__server`, `mcp__server__*`) in `disallowedTools` being silently ignored — they now correctly remove all tools from the named server

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.178

#### 0.3.177 (2026-06-13)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录 (parity 跟版,继承自 Claude Code v2.1.177 修复集)

**废弃**
- 无

**迁移说明**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.177

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.177

#### 0.3.176 (2026-06-12)

**破坏性变更**
- 无明确 breaking;但 turn result 丢弃与 task 状态恢复是行为修正,某些依赖了"消息顺序"的代码需要重新验证

**新功能**
- 无明确新增

**Bug 修复**
- 修复 turn result 消息被丢弃的问题: 当多个 turn 完成时,如果此时 background agent 或 workflow 还在运行,turn result 会被丢弃
- 修复后台 agent、远程 agent 和 MCP task 状态在通过 SDK resume session 时未被恢复的问题

**废弃**
- 无

**迁移说明**
- 升级前如果业务依赖 resume 后台任务的状态,需复测;升级后行为更符合预期

**原始 release notes**
> Fixed turn result messages being dropped when multiple turns complete while background agent or workflow is running. Fixed background agent, remote agent, and MCP task state not being restored when resuming session via SDK.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.176

#### 0.3.175 (2026-06-12)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**迁移说明**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.175

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.175

#### 0.3.174 (2026-06-11)

**破坏性变更**
- 无明确 breaking;但 system/model_fallback 触发条件从分散变为统一,部分仅监听单一 error 类型的代码需要兼容

**新功能**
- 新增 system/model_fallback 消息统一处理所有 fallback 触发条件: overloaded、server_error、last_resort、model_not_found、permission_denied

**Bug 修复**
- 无明确记录

**废弃**
- 无

**迁移说明**
- 客户端应改为同时支持监听 system/model_fallback 与具体的 error retry 事件

**原始 release notes**
> SDK consumers now receive system/model_fallback message for all fallback triggers (overloaded, server_error, last_resort, model_not_found, permission_denied).

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.174

#### 0.3.173 (2026-06-11)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.173

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.173

#### 0.3.172 (2026-06-10)

**破坏性变更**
- 无

**新功能**
- SDK plugins 选项现在每插件支持 `skipMcpDiscovery: true`

**Bug 修复**
- 修复 slash 后跟空白 (`/ command`) 的输入被静默丢弃

**废弃**
- 无

**原始 release notes**
> SDK plugins option now accepts skipMcpDiscovery: true per plugin. Fixed slash-followed-by-whitespace input being silently dropped.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.172

#### 0.3.170 (2026-06-09)

**破坏性变更**
- 无明确 breaking;但新增的 `claude-fable-5` 模型 + `fable` 别名会出现在 SDK model types 中

**新功能**
- 新增 `claude-fable-5` 模型以及 `fable` 别名到 SDK model types

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Added claude-fable-5 model and fable alias to SDK model types. Updated to parity with Claude Code v2.1.170.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.170

#### 0.3.169 (2026-06-08)

**破坏性变更**
- 无 (API 标记为 experimental,命名上强烈提示可能变动)

**新功能**
- Query 上新增 experimental `usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET()` 方法
- BrowserQueryOptions 新增 `sse` 选项 (SSEOptions)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Added experimental usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET() method on Query. Added sse option (SSEOptions) to BrowserQueryOptions.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.169

#### 0.3.168 (2026-06-06)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.168

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.168

#### 0.3.167 (2026-06-06)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.167

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.167

#### 0.3.166 (2026-06-05)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复 MCP resource 工具未注入给运行时通过 `mcp_set_servers` 控制请求添加的 server

**废弃**
- 无

**原始 release notes**
> Fixed MCP resource tools not being injected for servers added at runtime via mcp_set_servers control request.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.166

#### 0.3.165 (2026-06-05)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.165

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.165

#### 0.3.163 (2026-06-04)

**破坏性变更**
- 无

**新功能**
- Stop hook 与 SubagentStop hook 事件现在支持 `additionalContext`

**Bug 修复**
- `stop_task` 控制请求现在当目标 task 已不存在时返回 success
- 修复 SDK 宿主无法通过 `setMcpServers` 添加 builtin MCP server

**废弃**
- 无

**原始 release notes**
> stop_task control requests now return success when target task is already gone. Fixed SDK hosts being unable to add builtin MCP servers via setMcpServers. Stop and SubagentStop hook events now support additionalContext.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.163

#### 0.3.162 (2026-06-03)

**破坏性变更**
- 无明确 breaking;但 refusal 错误现在携带 `stop_reason: 'refusal'` 与 `stop_details`,依赖旧 stop_reason 值的代码需要更新

**新功能**
- Refusal 错误消息现在携带 `stop_reason: 'refusal'` 与 `stop_details`
- Agent SDK sessions 在 native build 上现在默认使用 fast embedded find/grep search in Bash

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Refusal error messages now carry stop_reason: 'refusal' and stop_details. Agent SDK sessions on native builds now default to fast embedded find/grep search in Bash.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.162

#### 0.3.161 (2026-06-02)

**破坏性变更**
- 无明确 breaking;但 ControlResponse 多了 `pending_permission_requests` 字段,以及 applyFlagSettings 的行为 live-applies

**新功能**
- `initialize` 控制请求现在幂等
- ControlResponse 新增可选 `pending_permission_requests` 字段
- `applyFlagSettings` 现在在下个 turn live-applies agent 变更

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> initialize control request is now idempotent. ControlResponse gains optional pending_permission_requests field. applyFlagSettings now live-applies agent changes on next turn.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.161

#### 0.3.160 (2026-06-01)

**破坏性变更**
- 无明确 breaking;但 SDK hook callback 之前吞掉 abort signal 是行为 bug,修复后 abort 期间 PostToolUse 行为变化 (现在以 result 结束 turn)

**新功能**
- 无

**Bug 修复**
- 修复 SDK hook callbacks 吞掉 abort signals 的问题
- 在 PostToolUse hook 期间 abort 现在以 final result 消息结束 turn,而不是挂起调用进程

**废弃**
- 无

**原始 release notes**
> Fixed SDK hook callbacks swallowing abort signals. Aborting during a PostToolUse hook now ends the turn with a final result message instead of hanging the calling process.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.160

#### 0.3.159 (2026-05-31)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.159

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.159

#### 0.3.158 (2026-05-30)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.158

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.158

#### 0.3.157 (2026-05-29)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.157

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.157

#### 0.3.156 (2026-05-28)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.156

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.156

#### 0.3.154 (2026-05-28)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复 stdio MCP server 由于 config-equality 假阳性在每次 reconcile pass 时被错误地重启

**废弃**
- 无

**迁移说明**
- 升级前若业务对 stdio MCP server 频繁重启敏感 (例如依赖 server 启动副作用或 server 内部缓存),升级后行为改善

**原始 release notes**
> Fixed stdio MCP servers being incorrectly restarted on every reconcile pass due to config-equality false positives.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.154

#### 0.3.153 (2026-05-27)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.153

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.153

#### 0.3.152 (2026-05-26)

**破坏性变更**
- 无

**新功能**
- SessionStart hooks 现在可以返回 `reloadSkills: true` 触发 skill 重扫
- SessionStart hook 可以通过 `hookSpecificOutput.sessionTitle` 设置会话标题
- 新增 `MessageDisplay` hook 事件,用于转换或隐藏展示的 assistant 消息文本

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> SessionStart hooks can now return reloadSkills: true to trigger skill re-scan, and set session title via hookSpecificOutput.sessionTitle. Added MessageDisplay hook event for transforming or hiding assistant message text as displayed.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.152

#### 0.3.150 (2026-05-23)

**破坏性变更**
- 无明确 breaking;但 api_retry 系统消息对 529 响应的 `error` 字段从 `'rate_limit'` 改为 `'overloaded'`,依赖该值的客户端需要更新

**新功能**
- 无

**Bug 修复**
- api_retry 系统消息现在对 529 响应报告 `error: 'overloaded'` 而不是 `'rate_limit'`

**废弃**
- 无

**原始 release notes**
> api_retry system message now reports error: 'overloaded' for 529 responses instead of 'rate_limit'. Updated to parity with Claude Code v2.1.150.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.150

#### 0.3.149 (2026-05-22)

**破坏性变更**
- 文档修正: `Options.env` 现在被描述为"替换"子进程环境,而非"与 process.env 合并" (代码注释同步,但语义此前已修过)

**新功能**
- 无

**Bug 修复**
- 修复 `options.env` 丢失 `CLAUDE_AGENT_SDK_VERSION` 的问题
- 纠正 `Options.env` 文档说明: 替换子进程环境,而不是与 process.env 合并

**废弃**
- 无

**原始 release notes**
> Fixed options.env dropping CLAUDE_AGENT_SDK_VERSION. Corrected Options.env docs to state the value replaces subprocess environment rather than merging with process.env.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.149

#### 0.3.148 (2026-05-22)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.148

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.148

#### 0.3.147 (2026-05-21)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.147

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.147

#### 0.3.146 (2026-05-20)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.146

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.146

#### 0.3.145 (2026-05-19)

**破坏性变更**
- 无

**新功能**
- 无 (parity 跟版)

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.145

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.145

#### 0.3.144 (2026-05-18)

**破坏性变更**
- 无明确 breaking;但 assistant 消息与 StopFailure hook 之前对"模型不存在"会发出模糊 error,现在精确报告 `error: 'model_not_found'`,依赖原 error 字符串的代码需更新

**新功能**
- Assistant 消息和 StopFailure hooks 现在在选定模型不存在时报告 `error: 'model_not_found'`
- 新增 `@anthropic-ai/claude-agent-sdk/extract` 导出供 `bun build --compile` 消费者使用

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Assistant messages and StopFailure hooks now report error: 'model_not_found' when selected model doesn't exist. Added @anthropic-ai/claude-agent-sdk/extract export for bun build --compile consumers.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.144

#### 0.3.143 (2026-05-15)

**破坏性变更**
- **依赖关系变化**: `@anthropic-ai/sdk` 和 `@modelcontextprotocol/sdk` 现在是 peerDependencies 而不是 dependencies
- 运行时不受影响,但消费者 (本项目) 的 `package.json` 需要确保显式声明这两个依赖

**新功能**
- 无

**Bug 修复**
- 无明确记录

**废弃**
- 无

**迁移说明**
- 检查 `package.json` 显式声明 `@anthropic-ai/sdk` 和 `@modelcontextprotocol/sdk`
- 运行 `npm ls @anthropic-ai/sdk @modelcontextprotocol/sdk` 验证无重复安装

**原始 release notes**
> @anthropic-ai/sdk and @modelcontextprotocol/sdk are now peerDependencies instead of dependencies. Runtime is unaffected.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.143

#### 0.3.142 (2026-05-14)

**破坏性变更**
- **移除 v2 session API** (之前 0.1.54 引入,0.2.133 标记废弃,本版本正式移除)
- **MCP servers 现在默认在后台连接** (之前是同步连接)
- **Headless 和 SDK sessions 现在使用 Task 工具而不是 TodoWrite** (行为变化,需要适配 task_progress/task_started 等事件消费方)
- Headless `--sdk-url` sessions 现在当远程 transport 永久关闭时退出码非零

**新功能**
- 暴露 `request_id`、`subagent_type`、`task_description` 字段到 SDK message types

**Bug 修复**
- 无明确记录

**废弃**
- 无 (v2 session API 已彻底移除,不是 deprecated)

**迁移说明**
- 从 v2 session API (`unstable_v2_*`) 迁移到 `query()`
- 适配 MCP 后台连接行为: 不再假设 MCP 在首次 query() 之前就绪
- 适配 Task 工具替代 TodoWrite: 监听 `task_progress`、`task_started`、`TaskCreate/TaskGet/TaskUpdate/TaskList` 等
- 检查 `request_id`/`subagent_type`/`task_description` 字段的类型消费方

**原始 release notes**
> Breaking: Removed the v2 session API. Breaking: MCP servers now connect in the background by default. Breaking: Headless and SDK sessions now use Task tools instead of TodoWrite. Surfaced request_id, subagent_type, and task_description on SDK message types. Headless --sdk-url sessions now exit non-zero when remote transport closes permanently.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.142

### 0.2.x (2026-01-07 → 2026-05-13)

0.2 阶段是 SDK 功能大爆发期。重要的能力扩展:v2 session API 实验→废弃、MCP 动态治理 (reconnectMcpServer/toggleMcpServer/setMcpServers)、session 治理 (listSessions/getSessionInfo/getSessionMessages/renameSession/tagSession/deleteSession/forkSession)、Task 工具集、OpenTelemetry、native binary 切换、resolveSettings、effort/thinking 模型元信息、permission policy、SDK 内部稳定性 (Windows temp 泄漏、Bun ReferenceError、长会话内存、Zod v4 metadata、stream abort)。

#### 0.2.141 (2026-05-13)

**破坏性变更**
- 无明确 breaking;但 `TaskCreateInput/Output`、`TaskGetInput/Output`、`TaskUpdateInput/Output`、`TaskListInput/Output` 类型现在从 `@anthropic-ai/claude-agent-sdk/sdk-tools` 导出 (类型访问路径变化,需更新 import)

**新功能**
- TaskCreateInput/Output、TaskGetInput/Output、TaskUpdateInput/Output、TaskListInput/Output 类型现在从 `@anthropic-ai/claude-agent-sdk/sdk-tools` 导出

**Bug 修复**
- 无

**废弃**
- 无

**依赖**
- `@anthropic-ai/sdk` 依赖对齐到 `^0.93.0`

**原始 release notes**
> TaskCreateInput/Output, TaskGetInput/Output, TaskUpdateInput/Output, TaskListInput/Output types are now exported from @anthropic-ai/claude-agent-sdk/sdk-tools. Aligned @anthropic-ai/sdk dependency to ^0.93.0.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md (parity 发布前快照)

---

#### 0.2.140 (2026-05-12) — parity with Claude Code v2.1.140

**破坏性变更**: 无 | **新功能**: 无 | **Bug 修复**: 无明确记录 | **废弃**: 无

#### 0.2.139 (2026-05-11) — parity with Claude Code v2.1.139

**破坏性变更**: 无 | **新功能**: 无 | **Bug 修复**: 无明确记录 | **废弃**: 无

#### 0.2.138 (2026-05-09) — parity with Claude Code v2.1.138

**破坏性变更**: 无 | **新功能**: 无 | **Bug 修复**: 无明确记录 | **废弃**: 无

#### 0.2.137 (2026-05-09) — parity with Claude Code v2.1.137

**破坏性变更**: 无 | **新功能**: 无 | **Bug 修复**: 无明确记录 | **废弃**: 无

#### 0.2.136 (2026-05-08)

**破坏性变更**
- **废弃 TodoWrite 工具**: 未来版本将切换到 Task 工具 (与 0.3.142 的最终切换呼应)

**新功能**
- 新增 `resolveSettings()` (alpha) 用于在 spawn Claude CLI 之前检查 effective merged settings

**Bug 修复**
- 无

**废弃**
- TodoWrite 工具 (deprecation,非立即移除)

**原始 release notes**
> Added resolveSettings() (alpha) to inspect effective merged settings without spawning Claude CLI. Deprecated TodoWrite tool — future versions will switch to Task tools.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.133 (2026-05-07)

**破坏性变更**
- **废弃 unstable V2 session API**: 改用 `query()`
- **废弃 `allowedTools` 传 `'Skill'`**: 改用 `skills` 选项

**新功能**
- 无

**Bug 修复**
- 无明确记录

**废弃**
- unstable V2 session API (`unstable_v2_createSession`、`unstable_v2_resumeSession`、`unstable_v2_prompt`)
- `allowedTools` 传 `'Skill'` 字符串

**迁移说明**
- V2 session API 仍可用但会在 0.3.142 (2026-05-14) 移除
- `allowedTools: ['Skill', ...]` 应改为 `skills: [...]` 选项

**原始 release notes**
> Deprecated unstable V2 session API — use query() instead. Deprecated passing 'Skill' in allowedTools — use skills option instead. Updated to parity with Claude Code v2.1.133.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.132 (2026-05-06)

**破坏性变更**
- 无明确 breaking;flag-settings 新增支持 top-level `null` 来清除覆盖 (类型扩展)

**新功能**
- flag-settings 支持 top-level 键传 `null` 以清除 override
- TypeScript Agent SDK reference 文档化 `applyFlagSettings()`

**Bug 修复**
- 无明确记录

**原始 release notes**
> Documented applyFlagSettings() in TypeScript Agent SDK reference. Added support for null on top-level keys to clear flag-settings overrides. Updated to parity with Claude Code v2.1.132.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.131 (2026-05-06) — parity with Claude Code v2.1.131

#### 0.2.129 (2026-05-05) — parity with Claude Code v2.1.129

#### 0.2.128 (2026-05-04) — parity with Claude Code v2.1.128

#### 0.2.126 (2026-04-30)

**破坏性变更**
- 无明确 breaking;`SDKResultSuccess` 与 `SDKResultError` 多了 `origin` 字段,SDKMessageOrigin 暴露更细

**新功能**
- Result 消息 (SDKResultSuccess / SDKResultError) 新增 `origin` 字段,转发触发消息的 `SDKMessageOrigin`

**Bug 修复**
- 无明确记录

**原始 release notes**
> Added origin to result messages (SDKResultSuccess / SDKResultError) — forwards the triggering message's SDKMessageOrigin.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.124 (2026-04-30) — parity with Claude Code v2.1.124

#### 0.2.123 (2026-04-29) — parity with Claude Code v2.1.123

#### 0.2.122 (2026-04-28) — parity with Claude Code v2.1.122

#### 0.2.121 (2026-04-27)

**破坏性变更**
- **废弃 `updatedMCPToolOutput`**: 由 `updatedToolOutput` 替代 (PostToolUseHookSpecificOutput)

**新功能**
- `PostToolUseHookSpecificOutput` 新增 `updatedToolOutput` 用于替换工具输出

**Bug 修复**
- 无明确记录

**废弃**
- `updatedMCPToolOutput` (替代品: `updatedToolOutput`)

**原始 release notes**
> Added updatedToolOutput to PostToolUseHookSpecificOutput for replacing tool output. updatedMCPToolOutput is deprecated.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.120 (2026-04-24)

**破坏性变更**
- 无

**新功能**
- 新增 `skills` 选项 (`string[] | 'all'`) 控制加载到主会话的 Skills

**Bug 修复**
- 无

**原始 release notes**
> Added skills option (string[] | 'all') to control which Skills are loaded into the main session.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.119 (2026-04-23)

**破坏性变更**
- 无明确 breaking;`excludeDynamicSections` 行为变化 (保留 static auto-memory)

**新功能**
- 新增 `forwardSubagentText` 选项转发 subagent 文本 deltas

**Bug 修复**
- `excludeDynamicSections` 现在保留可缓存系统提示中的 static auto-memory instructions
- 长会话 SDK sessions 现在会在 transport stream abort 后 reconnect claude.ai 代理的 MCP server
- `SessionStore.append()` 失败现在重试 3 次

**废弃**
- 无

**原始 release notes**
> Added forwardSubagentText option to stream subagent text deltas. excludeDynamicSections now keeps static auto-memory instructions in cacheable system-prompt block. Long-running SDK sessions now reconnect claude.ai-proxied MCP servers after transport-stream abort. SessionStore.append() failures now retried up to 3 times.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.118 (2026-04-22)

**破坏性变更**
- 无

**新功能**
- 新增 `Options.managedSettings` 用于 embedders 在内存中向 spawn 的 CLI 传递 policy-tier settings

**Bug 修复**
- 无

**原始 release notes**
> Added Options.managedSettings for embedders to pass policy-tier settings to spawned CLI in-memory.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.117 (2026-04-21) — parity with Claude Code v2.1.117

#### 0.2.116 (2026-04-20) — parity with Claude Code v2.1.116

#### 0.2.114 (2026-04-17) — parity with Claude Code v2.1.114

#### 0.2.113 (2026-04-17)  ⭐ 重大架构变化

**破坏性变更**
- **SDK 改为 spawn native Claude Code binary 而不是 bundled JavaScript** (重大运行时变化)
- `options.env` 恢复为替换 `process.env` (在 0.2.111/0.2.110 之间反复调整后,本版本明确"替换"语义)
- 新增 `SDKMirrorErrorMessage` (消息类型扩展)
- 新增 `sessionStore` 选项 (alpha) 到 `query()` 和 session helpers
- 新增 `deleteSession()` 方法

**新功能**
- 新增 `title` 选项
- 新增 OpenTelemetry trace context propagation
- 新增 `sessionStore` (alpha) 用于自定义 session 持久化
- 新增 `deleteSession()` 用于删除历史 session

**Bug 修复**
- 无明确记录

**废弃**
- 无

**迁移说明**
- 升级前验证 native Claude Code binary 路径配置 (`pathToClaudeCodeExecutable`)
- 重新审视 `options.env` 行为,不要依赖其与 process.env 合并
- 验证 hook 系统在 native binary 下的兼容性
- OpenTelemetry 自动注入可能影响现有的 trace 系统

**原始 release notes**
> Changed the SDK to spawn a native Claude Code binary instead of bundled JavaScript. Added sessionStore option (alpha) to query() and session helpers. Added deleteSession(). Added SDKMirrorErrorMessage. Breaking: options.env once again replaces process.env. Added title option. Added OpenTelemetry trace context propagation.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.112 (2026-04-16) — parity with Claude Code v2.1.112

#### 0.2.111 (2026-04-16)  ⭐ 行为变化

**破坏性变更**
- **无明确 breaking** 但 `options.env` 行为变化: 从 0.2.110 之前的"替换 process.env" 改为"overlay 继承的 process.env"

**新功能**
- **Opus 4.7 现在可用**
- `mcp_set_servers` 控制请求支持 remote (http/sse) server entries 携带 per-tool `permission_policy` 值
- `startup()` 与 `WarmQuery` 现在是公开 TypeScript API 的一部分
- 模型元信息扩展

**Bug 修复**
- 无明确记录

**迁移说明**
- 升级前如果业务依赖 `options.env` 完全替换行为,需要回退到显式设置所有变量

**原始 release notes**
> Opus 4.7 is now available. mcp_set_servers control request: remote (http/sse) server entries can now carry per-tool permission_policy values. startup() and WarmQuery are now part of the public TypeScript API. Changed options.env to overlay inherited process.env instead of replacing it.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.110 (2026-04-15)

**破坏性变更**
- 无

**新功能**
- `SDKUserMessage` 新增可选 `shouldQuery` 字段

**Bug 修复**
- 修复 `unstable_v2_createSession` 不尊重 `cwd`、`settingSources` 与 `allowDangerouslySkipPermissions`
- 自动 session-title 生成现在尊重 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`

**原始 release notes**
> Fixed unstable_v2_createSession not respecting cwd, settingSources, and allowDangerouslySkipPermissions. Added optional shouldQuery field to SDKUserMessage. Auto session-title generation now respects CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.109 (2026-04-15) — parity with Claude Code v2.1.109

#### 0.2.108 (2026-04-14) — parity with Claude Code v2.1.106

#### 0.2.107 (2026-04-14) — parity with Claude Code v2.1.106

#### 0.2.105 (2026-04-13)

**破坏性变更**
- 无

**新功能**
- 新增 `system/memory_recall` 事件
- `system/init` 新增 `memory_paths` 字段

**Bug 修复**
- 修复 `error_max_structured_output_retries` 在最终重试成功时仍被发出

**原始 release notes**
> Added system/memory_recall event and memory_paths on system/init. Fixed error_max_structured_output_retries being emitted when final retry attempt succeeded.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.104 (2026-04-12) — parity with Claude Code v2.1.95

#### 0.2.101 (2026-04-10)  ⭐ 安全升级

**破坏性变更**
- **Security**: 升级 `@anthropic-ai/sdk` 到 `^0.81.0`、`@modelcontextprotocol/sdk` 到 `^1.29.0` (peer dep 锁文件可能需要更新)

**新功能**
- 无

**Bug 修复**
- 修复 Windows 上 `resume-session` 临时目录泄漏
- 修复 11+ 并发 `query()` 调用时的 `MaxListenersExceededWarning`

**迁移说明**
- 同步更新 `package.json` 中两个依赖的版本约束
- 在 Windows 上验证 resume session 的临时目录清理

**原始 release notes**
> Security: bumped @anthropic-ai/sdk to ^0.81.0 and @modelcontextprotocol/sdk to ^1.29.0. Fixed resume-session temp directory leaking on Windows. Fixed MaxListenersExceededWarning when running 11+ concurrent query() calls.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.100 (2026-04-10) — parity with Claude Code v2.1.100

#### 0.2.98 (2026-04-09) — parity with Claude Code v2.1.98

#### 0.2.97 (2026-04-08) — parity with Claude Code v2.1.97

#### 0.2.96 (2026-04-08) — parity with Claude Code v2.1.96

#### 0.2.94 (2026-04-07)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复 `getContextUsage()` 不包含 `options.agents` 中的 agent
- 修复 CJK/多字节文本因 U+FFFD 损坏
- 修复 MCP server 子进程未被清理
- 修复失败的 error-report 写入导致 SDK 崩溃

**原始 release notes**
> Fixed getContextUsage() to include agents from options.agents. Fixed CJK/multibyte text corrupted with U+FFFD. Fixed MCP server child processes not being cleaned up. Fixed failed error-report write crashing SDK. Updated to parity with Claude Code v2.1.94.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

> **本项目 (CJK) 影响**: 本项目 UI 大量使用简体中文,此 CJK 修复对本项目至关重要,务必升级到此版本或更高。

---

#### 0.2.92 (2026-04-04) — parity with Claude Code v2.1.92

#### 0.2.91 (2026-04-02)

**破坏性变更**
- **sandbox 行为变化**: 当 `sandbox.enabled: true` 时,`failIfUnavailable` 默认改为 `true` (之前默认 false)
- 公开 `PermissionMode` 类型新增 `'auto'` 值 (类型扩展,非破坏)

**新功能**
- Result 消息新增可选 `terminal_reason` 字段
- 公开 `PermissionMode` 类型新增 `'auto'` 值

**Bug 修复**
- 无明确记录

**迁移说明**
- 如果业务在 sandbox enabled 时依赖 fail-soft 行为 (即 Claude sandbox 不可用时回退),需显式设置 `failIfUnavailable: false`

**原始 release notes**
> Added optional terminal_reason field to result messages. Added 'auto' to public PermissionMode type. Changed sandbox option to default failIfUnavailable to true when enabled: true. Updated to parity with Claude Code v2.1.91.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.90 (2026-04-01) — parity with Claude Code v2.1.90

#### 0.2.89 (2026-03-31) — parity with Claude Code v2.1.87

#### 0.2.88 (2026-03-30)  ⭐ 大量新能力

**破坏性变更**
- 无明确 breaking,但 `settingSources` 空数组之前未工作,现在修复为按预期工作

**新功能**
- 新增 `startup()` 方法预热 CLI 子进程
- 新增 `includeSystemMessages` 选项
- 新增 `listSubagents()` 方法
- 新增 `getSubagentMessages()` 方法
- 新增 `includeHookEvents` 选项

**Bug 修复**
- 修复 `ERR_STREAM_WRITE_AFTER_END` 错误
- 修复 Zod v4 `.describe()` metadata 被丢弃
- 修复 `side_question` 返回 `null`
- 修复 `settingSources` 空数组未按预期工作
- 修复错误 result 消息
- 修复 MCP server 陷入 failed 状态

**废弃**
- 无

**原始 release notes**
> Added startup() to pre-warm the CLI subprocess. Added includeSystemMessages option. Added listSubagents() and getSubagentMessages(). Added includeHookEvents option. Fixed ERR_STREAM_WRITE_AFTER_END errors. Fixed Zod v4 .describe() metadata being dropped. Fixed side_question returning null. Fixed settingSources empty array. Fixed error result messages. Fixed MCP servers stuck in failed state.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.87 (2026-03-29) — parity with Claude Code v2.1.87

#### 0.2.86 (2026-03-27)

**破坏性变更**
- `SDKUserMessage.session_id` 现在是 optional (之前 required)

**新功能**
- 新增 `getContextUsage()` 控制方法

**Bug 修复**
- 修复 TypeScript 类型解析为 `any` 的问题

**原始 release notes**
> Added getContextUsage() control method. Made session_id optional in SDKUserMessage. Fixed TypeScript types resolving to any. Updated to parity with Claude Code v2.1.86.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.85 (2026-03-26)

**破坏性变更**
- 无

**新功能**
- 新增 `reloadPlugins()` SDK 方法

**Bug 修复**
- 修复 PreToolUse hooks 当 `permissionDecision: 'ask'` 时被忽略

**原始 release notes**
> Added reloadPlugins() SDK method. Fixed PreToolUse hooks with permissionDecision: ask being ignored. Updated to parity with Claude Code v2.1.85.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.84 (2026-03-26)

**破坏性变更**
- 无明确 breaking;`[Request interrupted by user]` 文本的触发条件变化 (非用户错误不再被标为 interrupted)

**新功能**
- 新增 `taskBudget` 选项
- 新增 `enableChannel()` 方法
- 导出 `EffortLevel` 类型
- 新增 `capabilities` 字段

**Bug 修复**
- 修复非用户错误显示 `[Request interrupted by user]`

**原始 release notes**
> Added taskBudget option. Added enableChannel() method and capabilities field. Exported EffortLevel type. Fixed showing [Request interrupted by user] for non-user errors. Updated to parity with Claude Code v2.1.84.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.83 (2026-03-25)

**破坏性变更**
- **行为变化**: `session_state_changed` 事件改为 opt-in via `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1` (之前默认发送)

**新功能**
- 新增 `seed_read_state` 控制子类型

**废弃**
- 无

**迁移说明**
- 升级前如果业务依赖 session_state_changed 事件,需显式设置 env var

**原始 release notes**
> Added seed_read_state control subtype. Changed session_state_changed events to opt-in via CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1. Updated to parity with Claude Code v2.1.83.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.81 (2026-03-20)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复 `canUseTool` 未提供可用的 `addRules` 建议

**原始 release notes**
> Fixed canUseTool not providing working addRules suggestion. Updated to parity with Claude Code v2.1.81.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.80 (2026-03-19)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复 `getSessionMessages()` 丢失并行工具结果

**原始 release notes**
> Fixed getSessionMessages() dropping parallel tool results. Updated to parity with Claude Code v2.1.80.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.79 (2026-03-18)

**破坏性变更**
- 无明确 breaking;`ExitReason` 类型新增 `'resume'` 值 (类型扩展)

**新功能**
- `ExitReason` 类型新增 `'resume'` 用于区分 resume 触发的会话结束

**原始 release notes**
> Added 'resume' to ExitReason type for distinguishing resume-triggered session ends. Updated to parity with Claude Code v2.1.79.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.78 (2026-03-17) — parity with Claude Code v2.1.78

#### 0.2.77 (2026-03-16)

**破坏性变更**
- 无

**新功能**
- 新增 `api_retry` 系统消息,当重试瞬时 API 错误时发出

**原始 release notes**
> Added api_retry system messages when retrying transient API errors. Updated to parity with Claude Code v2.1.77.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.76 (2026-03-14)  ⭐ 多项能力新增

**破坏性变更**
- 无

**新功能**
- 新增 `forkSession()` 用于分支对话
- 新增 `cancel_async_message` 控制子类型
- `ExitPlanMode` 新增 `planFilePath` 字段
- 新增 MCP elicitation hook 类型
- 新增 `SDKElicitationCompleteMessage` 消息类型

**Bug 修复**
- 无明确记录

**废弃**
- 无

**原始 release notes**
> Added forkSession() for branching conversations. Added cancel_async_message control subtype. Added planFilePath field to ExitPlanMode. Added MCP elicitation hook types and SDKElicitationCompleteMessage. Updated to parity with Claude Code v2.1.76.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.75 (2026-03-13)

**破坏性变更**
- 无明确 breaking;`AgentToolOutput` 新增 `queued_to_running` 状态 (类型扩展)

**新功能**
- `SDKSessionInfo` 新增 `tag` 和 `createdAt` 字段
- 新增 `getSessionInfo()` 方法
- `listSessions` 新增 `offset` 选项
- 新增 `tagSession()` 方法
- `AgentToolOutput` 新增 `queued_to_running` 状态
- 改进错误信息

**原始 release notes**
> Added tag and createdAt fields to SDKSessionInfo. Added getSessionInfo(). Added offset option to listSessions. Added tagSession(). Added queued_to_running status to AgentToolOutput. Improved error messages. Updated to parity with Claude Code v2.1.75.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.74 (2026-03-12)

**破坏性变更**
- 无

**新功能**
- 新增 `renameSession()` 方法

**Bug 修复**
- 修复 `import type` from `@anthropic-ai/claude-agent-sdk/sdk-tools` 在 NodeNext/Bundler 下失败
- 修复 `user-invocable: false` 的 skills 被错误包含在 `supportedCommands()`

**原始 release notes**
> Added renameSession(). Fixed import type from @anthropic-ai/claude-agent-sdk/sdk-tools failing under NodeNext/Bundler. Fixed skills with user-invocable: false being included in supportedCommands(). Updated to parity with Claude Code v2.1.74.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.73 (2026-03-11)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复 `options.env` 被 `~/.claude/settings.json` 中的 env 块覆盖

**原始 release notes**
> Fixed options.env being overridden by ~/.claude/settings.json env block. Updated to parity with Claude Code v2.1.73.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.72 (2026-03-10)

**破坏性变更**
- 无

**新功能**
- 新增 `agentProgressSummaries` 选项用于周期性 AI 生成的进度摘要
- `getSettings()` 新增 `applied` 段

**Bug 修复**
- 修复 `toggleMcpServer` 和 `reconnectMcpServer` 因 `Server not found` 失败

**原始 release notes**
> Added agentProgressSummaries option for periodic AI-generated progress summaries. Added getSettings() applied section. Fixed toggleMcpServer and reconnectMcpServer failing with Server not found. Updated to parity with Claude Code v2.1.72.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.71 (2026-03-06) — parity with Claude Code v2.1.71

#### 0.2.70 (2026-03-06)

**破坏性变更**
- **`AgentToolInput.subagent_type` 改为可选** (之前 required)

**新功能**
- 无

**Bug 修复**
- 修复 `type: 'http'` MCP server 在 Streamable HTTP server 上 HTTP 406 失败

**原始 release notes**
> Fixed type: http MCP servers failing with HTTP 406 on Streamable HTTP servers. Changed AgentToolInput.subagent_type to optional. Updated to parity with Claude Code v2.1.70.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.69 (2026-03-05)  ⭐ 大量新能力与修复

**破坏性变更**
- **修复 breaking**: `system:init` 与 `result` 事件恢复 emit `'Task'` 作为 Agent tool name (回退 0.2.69 之前的破坏性变更)

**新功能**
- `toolConfig.askUserQuestion.previewFormat` 新选项
- `ModelInfo` 新增 `supportsFastMode` 字段
- Hook 事件新增 `agent_id` 与 `agent_type` 字段

**Bug 修复**
- 修复 SDK-mode MCP server 断开
- 修复带 `updatedPermissions` 的 control response 阻塞 tool calls
- 改进 `getSessionMessages()` 的内存使用

**废弃**
- 无

**原始 release notes**
> Added toolConfig.askUserQuestion.previewFormat option. Added supportsFastMode field to ModelInfo. Added agent_id and agent_type fields to hook events. Fixed SDK-mode MCP servers getting disconnected. Fixed breaking change: system:init and result events emit 'Task' as Agent tool name again. Fixed control responses with malformed updatedPermissions blocking tool calls. Improved memory usage of getSessionMessages().

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.68 (2026-03-04) — parity with Claude Code v2.1.68

#### 0.2.66 (2026-03-04) — parity with Claude Code v2.1.66

#### 0.2.64 (2026-03-03) — parity with Claude Code v2.1.66

#### 0.2.63 (2026-02-28)

**破坏性变更**
- 无

**新功能**
- 新增 `supportedAgents()` 方法

**Bug 修复**
- 修复 `pathToClaudeCodeExecutable` 设为裸命令名时失败
- 修复 MCP 替换工具在 subagent 中被错误拒绝

**原始 release notes**
> Fixed pathToClaudeCodeExecutable failing when set to bare command name. Added supportedAgents() method. Fixed MCP replacement tools being incorrectly denied in subagents.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.62 (2026-02-27) — parity with Claude Code v2.1.61

#### 0.2.61 (2026-02-26) — parity with Claude Code v2.1.61

#### 0.2.59 (2026-02-26)

**破坏性变更**
- 无

**新功能**
- 新增 `getSessionMessages()` 函数,用于从 session 的 transcript 文件读取会话历史

**原始 release notes**
> Added getSessionMessages() function for reading a session's conversation history from its transcript file.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.58 (2026-02-25) — parity with Claude Code v2.1.58

#### 0.2.56 (2026-02-25) — parity with Claude Code v2.1.56

#### 0.2.55 (2026-02-25) — parity with Claude Code v2.1.55

#### 0.2.54 (2026-02-25) — parity with Claude Code v2.1.54

#### 0.2.53 (2026-02-24)

**破坏性变更**
- 无

**新功能**
- 新增 `listSessions()` 用于发现/列出过去 session 及其轻量元数据

**原始 release notes**
> Added listSessions() for discovering and listing past sessions with light metadata.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.52 (2026-02-24) — parity with Claude Code v2.1.52

#### 0.2.51 (2026-02-24)  ⭐ 关键稳定性修复

**破坏性变更**
- 无明确 breaking;但 `session.close()` 在 v2 session API 上的行为修复

**新功能**
- 新增 `task_progress` 事件

**Bug 修复**
- 修复 SDK 在 compiled Bun binary 中使用时崩溃并报 ReferenceError
- 修复长运行 SDK session 中内存无限增长
- 修复本地 slash command 输出未返回
- 修复 `session.close()` 在 v2 session API 上

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.51. Fixed SDK crashing with ReferenceError when used inside compiled Bun binaries. Fixed unbounded memory growth in long-running SDK sessions. Fixed local slash command output not being returned. Added task_progress events. Fixed session.close() in v2 session API.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.50 (2026-02-20) — parity with Claude Code v2.1.50

#### 0.2.49 (2026-02-19)  ⭐ 模型元信息扩展

**破坏性变更**
- 无明确 breaking;`ModelInfo` 新增字段 (类型扩展)

**新功能**
- SDK model info 现在包含 `supportsEffort`、`supportedEffortLevels`、`supportsAdaptiveThinking`
- 权限建议现在在安全检查触发 ask 时被填充
- 新增 `ConfigChange` hook 事件

**Bug 修复**
- 无明确记录

**原始 release notes**
> Updated to parity with Claude Code v2.1.49. SDK model info now includes supportsEffort, supportedEffortLevels, and supportsAdaptiveThinking. Permission suggestions populated when safety checks trigger ask. Added ConfigChange hook event.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.48 (2026-02-19) — parity with Claude Code v2.1.46

#### 0.2.47 (2026-02-18)

**破坏性变更**
- 无

**新功能**
- `Query` 上新增 `promptSuggestion()` 方法
- `task_notification` 事件新增 `tool_use_id` 字段

**原始 release notes**
> Updated to parity with Claude Code v2.1.47. Added promptSuggestion() method on Query. Added tool_use_id field to task_notification events.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.45 (2026-02-17)  ⭐ Sonnet 4.6

**破坏性变更**
- 无

**新功能**
- 新增 Claude Sonnet 4.6 支持
- 新增 `task_started` 系统消息

**Bug 修复**
- 修复 `Session.stream()` 在后台 subagent 还在运行时提前返回
- 改进 shell 命令的内存使用

**原始 release notes**
> Added support for Claude Sonnet 4.6. Added task_started system message. Fixed Session.stream() returning prematurely when background subagents are still running. Improved memory usage for shell commands.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.44 (2026-02-16) — parity with Claude Code v2.1.44

#### 0.2.42 (2026-02-13) — parity with Claude Code v2.1.42

#### 0.2.41 (2026-02-13) — parity with Claude Code v2.1.41

#### 0.2.40 (2026-02-12) — parity with Claude Code v2.1.40

#### 0.2.39 (2026-02-10) — parity with Claude Code v2.1.39

#### 0.2.38 (2026-02-10) — parity with Claude Code v2.1.38

#### 0.2.37 (2026-02-07) — parity with Claude Code v2.1.37

#### 0.2.36 (2026-02-07) — parity with Claude Code v2.1.36

#### 0.2.34 (2026-02-06) — parity with Claude Code v2.1.34

#### 0.2.33 (2026-02-06)

**破坏性变更**
- 无

**新功能**
- 新增 `TeammateIdle` 与 `TaskCompleted` hook 事件
- 新增 `sessionId` 选项,允许指定自定义 UUID

**原始 release notes**
> Added TeammateIdle and TaskCompleted hook events. Added sessionId option to specify custom UUID. Updated to parity with Claude Code v2.1.33.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.32 (2026-02-05) — parity with Claude Code v2.1.32

#### 0.2.31 (2026-02-04)

**破坏性变更**
- 无明确 breaking;`SDKResultSuccess` 与 `SDKResultError` 多了 `stop_reason` 字段

**新功能**
- `SDKResultSuccess` 与 `SDKResultError` 新增 `stop_reason` 字段,表示模型停止生成的原因

**原始 release notes**
> Added stop_reason field to SDKResultSuccess and SDKResultError to indicate why the model stopped generating.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.30 (2026-02-03)  ⭐ 调试与文件读取扩展

**破坏性变更**
- 无明确 breaking;`FileReadToolOutput` 新增 `parts` 输出类型,可能影响消费者

**新功能**
- 新增 `debug` 和 `debugFile` 选项用于程序化控制 debug 日志
- `FileReadToolInput` 新增可选 `pages` 字段 (PDF 分页读取)

**Bug 修复**
- 修复 `(no content)` 占位消息被错误包含在 SDK 输出中

**废弃**
- 无

**原始 release notes**
> Added debug and debugFile options for programmatic control of debug logging. Added optional pages field to FileReadToolInput. Added parts output type to FileReadToolOutput. Fixed (no content) placeholder messages being included in SDK output.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.29 (2026-01-31) — parity with Claude Code v2.1.29

#### 0.2.27 (2026-01-30)

**破坏性变更**
- 无

**新功能**
- `tool()` 助手新增可选 `annotations` 支持 MCP tool hints
- `mcpServerStatus()` 现在包含来自 SDK 与动态添加的 MCP server 的工具

**废弃**
- 无

**原始 release notes**
> Added optional annotations support to tool() helper for MCP tool hints. Fixed mcpServerStatus() to include tools from SDK and dynamically-added MCP servers. Updated to parity with Claude Code v2.1.27.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.26 (2026-01-30) — parity with Claude Code v2.1.27

#### 0.2.25 (2026-01-29) — parity with Claude Code v2.1.25

#### 0.2.23 (2026-01-29)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复结构化输出验证错误未正确报告

**原始 release notes**
> Fixed structured output validation errors not being reported correctly. Updated to parity with Claude Code v2.1.23.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.22 (2026-01-28)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复结构化输出处理空 assistant 消息

**原始 release notes**
> Fixed structured outputs to handle empty assistant messages. Updated to parity with Claude Code v2.1.22.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.21 (2026-01-28)  ⭐ MCP 动态治理

**破坏性变更**
- 无

**新功能**
- `McpServerStatus` 新增 `config`、`scope`、`tools` 字段
- 新增 `reconnectMcpServer()` 方法
- 新增 `toggleMcpServer()` 方法
- 新增 `disabled` 状态 (McpServerStatus)

**Bug 修复**
- 修复 SDK 模式下 `PermissionRequest` hooks 未执行

**废弃**
- 无

**原始 release notes**
> Added config, scope, and tools fields to McpServerStatus. Added reconnectMcpServer() and toggleMcpServer() methods. Added disabled status. Fixed PermissionRequest hooks not being executed in SDK mode. Updated to parity with Claude Code v2.1.21.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.20 (2026-01-27)

**破坏性变更**
- 无

**新功能**
- 新增 `additionalDirectories` 选项,从指定目录加载 CLAUDE.md
- 新增 `CLAUDE_CODE_ENABLE_TASKS` env var (opt-in 新 task 系统)

**原始 release notes**
> Added support for loading CLAUDE.md files from directories specified via additionalDirectories option. Added CLAUDE_CODE_ENABLE_TASKS env var. Updated to parity with Claude Code v2.1.20.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.19 (2026-01-23)

**破坏性变更**
- 无

**新功能**
- 新增 `CLAUDE_CODE_ENABLE_TASKS` env var,设为 `true` 启用新 task 系统

**原始 release notes**
> Added CLAUDE_CODE_ENABLE_TASKS env var, set to true to opt into the new task system

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.18 (2026-01-22)

**破坏性变更**
- 无

**新功能**
- 新增 `CLAUDE_CODE_ENABLE_TASKS` env var,opt-in 新 task 系统

**原始 release notes**
> Added CLAUDE_CODE_ENABLE_TASKS env var, set to true to opt into the new task system

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.17 (2026-01-22) — parity with Claude Code v2.1.17

#### 0.2.16 (2026-01-22) — parity with Claude Code v2.1.16

#### 0.2.15 (2026-01-21)

**破坏性变更**
- 无

**新功能**
- 新增 notification hook 支持
- `Query` 接口新增 `close()` 方法,用于强制终止运行中的 query

**原始 release notes**
> Added notification hook support. Added close() method to Query interface for forcefully terminating running queries. Updated to parity with Claude Code v2.1.15.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.14 (2026-01-20) — parity with Claude Code v2.1.14

#### 0.2.12 (2026-01-17) — parity with Claude Code v2.1.12

#### 0.2.11 (2026-01-17) — parity with Claude Code v2.1.11

#### 0.2.10 (2026-01-17)

**破坏性变更**
- 无

**新功能**
- 自定义 agent 定义新增 `skills` 与 `maxTurns` 配置选项

**原始 release notes**
> Added skills and maxTurns configuration options to custom agent definitions.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.9 (2026-01-16) — parity with Claude Code v2.1.9

#### 0.2.8 (2026-01-15) — parity with Claude Code v2.1.8

#### 0.2.7 (2026-01-13) — parity with Claude Code v2.1.7

#### 0.2.6 (2026-01-13)

**破坏性变更**
- 无

**新功能**
- `package.json` 新增 `claudeCodeVersion` 字段,用于程序化确定兼容 CLI 版本

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.1.6. Added claudeCodeVersion field to package.json for programmatically determining compatible CLI version.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

#### 0.2.5 (2026-01-11) — parity with Claude Code v2.1.5

#### 0.2.4 (2026-01-10) — parity with Claude Code v2.1.4

#### 0.2.3 (2026-01-09) — parity with Claude Code v2.1.3

#### 0.2.2 (2026-01-08) — parity with Claude Code v2.1.2

#### 0.2.1 (2026-01-07) — parity with Claude Code v2.1.1

#### 0.2.0 (2026-01-07)  ⭐ 首个 0.2 minor

**破坏性变更**
- 无明确 breaking;`McpServerStatus` 新增 `error` 字段 (类型扩展,需关注消费方)

**新功能**
- `McpServerStatus` 新增 `error` 字段,表示失败的 MCP server 连接

**原始 release notes**
> Added error field to McpServerStatus for failed MCP server connections. Updated to parity with Claude Code v2.1.0.

**来源**
- https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

### 0.1.x (2025-09-29 → 2026-01-06)

0.1 阶段是 SDK 从首发到大版本前的功能基线建立期。四大配置支柱 (systemPrompt/settingsSources/agents/forkSession) 在 0.1.0 确立,Claude Code parity 跟版节奏稳定 (v2.0.x),并逐步引入 Microsoft Foundry/结构化输出/Opus 4.5/v2 session API/AskUserQuestion/1M context beta/tools 选项/sessionId/stop_reason/fileRead pages/task_started/TeammateIdle/TaskCompleted hook 等关键能力。

#### 0.1.77 (2026-01-06) — parity with Claude Code v2.0.78

#### 0.1.76 (2025-12-22) — 无 release notes (parity)

#### 0.1.75 (2025-12-20) — parity with Claude Code v2.0.75

#### 0.1.74 (2025-12-19) — parity with Claude Code v2.0.74

#### 0.1.73 (2025-12-18)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复 Stop hooks 因 `Stream closed` 错误不一致运行

**原始 release notes**
> Fixed bug where Stop hooks would not consistently run due to Stream closed error. Updated to parity with Claude Code v2.0.73.

---

#### 0.1.72 (2025-12-17)  ⭐ V2 session API 重命名

**破坏性变更**
- **V2 session API 方法 `receive()` 改名为 `stream()`** (破坏性 API 重命名,后续在 0.2.133 废弃,在 0.3.142 移除)

**新功能**
- 无

**Bug 修复**
- 修复 `/context` 命令不尊重自定义 system prompts
- 修复非流式单轮 query 在首个 result 后立即关闭

**废弃**
- 无 (V2 session API 仍在)

**原始 release notes**
> Fixed /context command not respecting custom system prompts. Fixed non-streaming single-turn queries to close immediately on first result. Changed V2 session API method receive() to stream(). Updated to parity with Claude Code v2.0.72.

---

#### 0.1.71 (2025-12-16)  ⭐ zod v4 + Windows 修复

**破坏性变更**
- **zod 升级**: `zod ^4.0.0` 现在作为 peer dep 选项 (与 v3 并存)

**新功能**
- 新增 `zod ^4.0.0` 作为 peer dependency 选项
- 新增 `AskUserQuestion` 工具支持

**Bug 修复**
- 修复 Windows 上 spawn Claude 子进程时可见控制台窗口
- 修复 spawn 消息被送至 stderr callback

**废弃**
- 无

**原始 release notes**
> Added zod ^4.0.0 as peer dependency option. Added support for AskUserQuestion tool. Fixed visible console window appearing when spawning Claude subprocess on Windows. Fixed spawn message sent to stderr callback (#45). Updated to parity with Claude Code v2.0.71.

---

#### 0.1.70 (2025-12-15) — 无 release notes (parity)

#### 0.1.69 (2025-12-13) — parity with Claude Code v2.0.69

#### 0.1.68 (2025-12-12)

**破坏性变更**
- 无明确 breaking;MCP 工具可见性修正

**新功能**
- 无

**Bug 修复**
- 修复不允许的 MCP 工具对模型可见

**原始 release notes**
> Fixed bug where disallowed MCP tools were visible to the model. Updated to parity with Claude Code v2.0.68.

---

#### 0.1.67 (2025-12-11) — parity with Claude Code v2.0.67

#### 0.1.66 (2025-12-11)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复 project MCP servers (from `.mcp.json`) 在 `settingSources` 含 `project` 时不可用

**原始 release notes**
> Fixed project MCP servers from .mcp.json not being available when settingSources includes project. Updated to parity with Claude Code v2.0.66.

---

#### 0.1.65 (2025-12-11) — parity with Claude Code v2.0.66

#### 0.1.63 (2025-12-09) — parity with Claude Code v2.0.63

#### 0.1.62 (2025-12-09) — 无 release notes (parity)

#### 0.1.61 (2025-12-07) — parity with Claude Code v2.0.61

#### 0.1.60 (2025-12-05) — parity with Claude Code v2.0.60

#### 0.1.59 (2025-12-04) — parity with Claude Code v2.0.59

#### 0.1.58 (2025-12-03)  ⭐ 1M context beta

**破坏性变更**
- 无

**新功能**
- 新增 `betas` 选项启用 beta 特性 (`context-1m-2025-08-07` 让 Sonnet 4/4.5 启用 1M token 上下文)

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.0.58. Added betas option to enable beta features (context-1m-2025-08-07 for 1M token context on Sonnet 4/4.5).

---

#### 0.1.57 (2025-12-03)  ⭐ tools 选项

**破坏性变更**
- 无

**新功能**
- 新增 `tools` 选项指定可用内置工具集合 (精确白名单)

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.0.57. Added tools option to specify exact set of built-in tools available to the agent.

---

#### 0.1.56 (2025-12-01) — parity with Claude Code v2.0.56

#### 0.1.55 (2025-11-26) — parity with Claude Code v2.0.55

#### 0.1.54 (2025-11-26)  ⭐ V2 session API 实验引入

**破坏性变更**
- 无明确 breaking;新增 experimental V2 session API

**新功能**
- 新增实验性 V2 session API: `unstable_v2_createSession`、`unstable_v2_resumeSession`、`unstable_v2_prompt`

**Bug 修复**
- 修复 `ExitPlanMode` 工具 input 为空

**废弃**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.0.54. Added experimental v2 session APIs (unstable_v2_createSession, unstable_v2_resumeSession, unstable_v2_prompt). Fixed bug where ExitPlanMode tool input was empty.

---

#### 0.1.53 (2025-11-25) — parity with Claude Code v2.0.53

#### 0.1.52 (2025-11-24) — parity with Claude Code v2.0.52

#### 0.1.51 (2025-11-24)  ⭐ Opus 4.5

**破坏性变更**
- 无

**新功能**
- 新增 Opus 4.5 支持

**原始 release notes**
> Updated to parity with Claude Code v2.0.51. Added support for Opus 4.5.

---

#### 0.1.50 (2025-11-21) — parity with Claude Code v2.0.50

#### 0.1.49 (2025-11-21) — parity with Claude Code v2.0.49

#### 0.1.47 (2025-11-19)

**破坏性变更**
- 无明确 breaking;部分消息新增 `error` 字段

**新功能**
- 部分消息新增 `error` 字段

**原始 release notes**
> Updated to parity with Claude Code v2.0.47. Added error field to some messages.

---

#### 0.1.46 (2025-11-19) — parity with Claude Code v2.0.46

#### 0.1.45 (2025-11-18)  ⭐ Microsoft Foundry + 结构化输出

**破坏性变更**
- 无

**新功能**
- 新增 Microsoft Foundry 支持
- 新增结构化输出 (structured outputs) 支持

**原始 release notes**
> Added support for Microsoft Foundry. Structured outputs support. Updated to parity with Claude Code v2.0.45.

---

#### 0.1.44 (2025-11-18) — parity with Claude Code v2.0.44

#### 0.1.43 (2025-11-17) — parity with Claude Code v2.0.43

#### 0.1.42 (2025-11-14) — parity with Claude Code v2.0.42

#### 0.1.39 (2025-11-14) — parity with Claude Code v2.0.41

#### 0.1.37 (2025-11-10) — parity with Claude Code v2.0.37

#### 0.1.36 (2025-11-07) — parity with Claude Code v2.0.36

#### 0.1.35 (2025-11-06) — parity with Claude Code v2.0.35

#### 0.1.34 (2025-11-05) — parity with Claude Code v2.0.34

#### 0.1.33 (2025-11-04) — parity with Claude Code v2.0.33

#### 0.1.31 (2025-11-03) — parity with Claude Code v2.0.32

#### 0.1.30 (2025-10-30)  ⭐ max-budget-usd

**破坏性变更**
- 无

**新功能**
- 新增 `--max-budget-usd` flag

**Bug 修复**
- 修复 stream 模式下 hooks 有时失败

**原始 release notes**
> Added --max-budget-usd flag. Fixed bug where hooks were sometimes failing in stream mode. Updated to parity with Claude Code v2.0.31.

---

#### 0.1.29 (2025-10-29) — parity with Claude Code v2.0.29

#### 0.1.28 (2025-10-27)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复自定义工具 30 秒超时而不尊重 `MCP_TOOL_TIMEOUT`

**原始 release notes**
> Updated to parity with Claude Code v2.0.28. Fixed custom tools timing out after 30 seconds instead of respecting MCP_TOOL_TIMEOUT (#42).

---

#### 0.1.27 (2025-10-24)

**破坏性变更**
- 无

**新功能**
- `Options` 新增 `plugins` 字段

**原始 release notes**
> Updated to parity with Claude Code v2.0.27. Added plugins field to Options.

---

#### 0.1.26 (2025-10-23) — parity with Claude Code v2.0.26

#### 0.1.25 (2025-10-21)  ⭐ skills 修复

**破坏性变更**
- 无

**新功能**
- `SDKSystemMessage` 新增 `skills` 字段

**Bug 修复**
- 修复 project-level skills 在指定 `project` settings source 时未加载
- 修复导出类型导入失败

**原始 release notes**
> Updated to parity with Claude Code v2.0.25. Fixed project-level skills not loading when 'project' settings source specified. Added skills field to SDKSystemMessage. Fixed exported types not importing correctly (#39).

---

#### 0.1.23 (2025-10-20) — 无 release notes (parity)

#### 0.1.22 (2025-10-17) — parity with Claude Code v2.0.22

#### 0.1.21 (2025-10-16) — parity with Claude Code v2.0.21

#### 0.1.20 (2025-10-16) — parity with Claude Code v2.0.20

#### 0.1.19 (2025-10-15) — parity with Claude Code v2.0.19

#### 0.1.17 (2025-10-15) — parity with Claude Code v2.0.18

#### 0.1.16 (2025-10-15) — parity with Claude Code v2.0.17

#### 0.1.15 (2025-10-14)

**破坏性变更**
- 无明确 breaking;`env` 类型不再使用 Bun Dict (类型修复)

**新功能**
- 无

**Bug 修复**
- env 类型不再使用 Bun Dict
- 启动性能改进: 当使用多个 SDK MCP server 时

**原始 release notes**
> Updated to parity with Claude Code v2.0.15. Updated env type to not use Bun Dict type. Startup performance improvements when using multiple SDK MCP servers.

---

#### 0.1.14 (2025-10-10) — parity with Claude Code v2.0.14

#### 0.1.13 (2025-10-09) — parity with Claude Code v2.0.13

#### 0.1.12 (2025-10-09)

**破坏性变更**
- 无明确 breaking;SDK MCP channel 关闭超时从默认值提升到 60s

**新功能**
- 无

**Bug 修复**
- 提升 SDK MCP channel 关闭超时到 60s

**原始 release notes**
> Updated to parity with Claude Code v2.0.12. Increased SDK MCP channel closure timeout to 60s (#15).

---

#### 0.1.11 (2025-10-08) — parity with Claude Code v2.0.11

#### 0.1.10 (2025-10-07)

**破坏性变更**
- **依赖变化**: `zod ^3.24.1` 升级为 peer dependency (消费者需显式声明)

**新功能**
- 无

**原始 release notes**
> Updated to parity with Claude Code v2.0.10. Added zod ^3.24.1 as peer dependency.

---

#### 0.1.9 (2025-10-06)

**破坏性变更**
- 无

**新功能**
- 无

**Bug 修复**
- 修复 system prompt 有时未正确设置

**原始 release notes**
> Fixed a bug where system prompt was sometimes not getting set correctly (#8)

---

#### 0.1.8 (2025-10-04) — 无 release notes (parity)

#### 0.1.5 (2025-10-02) — 无 release notes (parity)

#### 0.1.3 (2025-10-01) — parity with Claude Code v2.0.1

#### 0.1.2 (2025-09-30) — 无 release notes (parity)

#### 0.1.1 (2025-09-30) — 无 release notes (parity)

#### 0.1.0 (2025-09-29)  ⭐ 重大 API 重构

**破坏性变更**
- **`customSystemPrompt` 与 `appendSystemPrompt` 合并为单一 `systemPrompt` 字段**
- **不再注入默认 system prompt**
- **不再注入默认 filesystem settings**
- **显式 settings 控制**: 通过 `settingSources`

**新功能**
- 编程式 subagents 通过 `agents` 选项
- 会话分叉通过 `forkSession` 选项
- 细粒度 settings 控制
- 完整 TypeScript API 参考
- 全面 API 指南、自定义工具、权限、会话管理指南

**废弃**
- `customSystemPrompt` (合并入 `systemPrompt`)
- `appendSystemPrompt` (合并入 `systemPrompt`)

**迁移说明**
- 移除 `customSystemPrompt` 与 `appendSystemPrompt` 调用,合并为 `systemPrompt`
- 显式声明 `settingSources` (例如 `['project']`)
- 移除任何依赖默认 system prompt / filesystem settings 的代码

**原始 release notes**
> Merged prompt options: customSystemPrompt and appendSystemPrompt merged into single systemPrompt field. No default system prompt. No filesystem settings by default. Explicit settings control via settingSources. Programmatic subagents via agents option. Session forking via forkSession option. Granular settings control. Comprehensive API Guide, Custom Tools, Permissions, Session Management guides. Complete TypeScript API reference.

---

### 0.0.x

#### 0.0.4 (2025-09-27)

**破坏性变更**
- 无 (首发)

**新功能**
- SDK 首发 (无 changelog snippet)

**Bug 修复**
- 无

**废弃**
- 无

**原始 release notes**
> (无 release notes)

**来源**
- https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk/v/0.0.4

---

## 破坏性变更汇总

按 minor 分组列出:

### 0.1.x 破坏性变更

- **0.1.0** (2025-09-29): API 重构 — `customSystemPrompt` + `appendSystemPrompt` → `systemPrompt`;移除默认 system prompt / filesystem settings;`settingSources` 显式化
- **0.1.10** (2025-10-07): zod 升级为 peer dependency
- **0.1.71** (2025-12-16): zod v4 peer dep 选项;Windows spawn 控制台窗口修复(行为)
- **0.1.72** (2025-12-17): V2 session API `receive()` → `stream()` 重命名

### 0.2.x 破坏性变更

- **0.2.69** (2026-03-05): 修复 breaking — `system:init` / `result` 事件恢复 emit `'Task'` 作为 Agent tool name (回退之前的破坏性变更)
- **0.2.70** (2026-03-06): `AgentToolInput.subagent_type` 改为 optional
- **0.2.83** (2026-03-25): `session_state_changed` 事件改为 opt-in
- **0.2.86** (2026-03-27): `SDKUserMessage.session_id` 改为 optional
- **0.2.91** (2026-04-02): `sandbox.enabled: true` 时 `failIfUnavailable` 默认为 `true`
- **0.2.101** (2026-04-10): **Security** — 升级 `@anthropic-ai/sdk` ^0.81.0、`@modelcontextprotocol/sdk` ^1.29.0
- **0.2.111** (2026-04-16): `options.env` 改为 overlay 行为
- **0.2.113** (2026-04-17): **架构变化** — SDK 改为 spawn native Claude Code binary;`options.env` 恢复为替换;新增 `sessionStore` (alpha)、`SDKMirrorErrorMessage`
- **0.2.121** (2026-04-27): `updatedMCPToolOutput` 废弃
- **0.2.133** (2026-05-07): 废弃 V2 session API、`allowedTools` 传 `'Skill'`
- **0.2.136** (2026-05-08): 废弃 TodoWrite 工具

### 0.3.x 破坏性变更

- **0.3.142** (2026-05-14): **多个 breaking** — 移除 v2 session API;MCP 默认后台连接;headless/SDK 改用 Task 工具替代 TodoWrite;`--sdk-url` 远程 transport 永久关闭时非零退出
- **0.3.143** (2026-05-15): `@anthropic-ai/sdk` 与 `@modelcontextprotocol/sdk` 改为 peerDependencies

### 行为/语义变化 (非显式 breaking 但需关注)

- **0.2.30** (2026-02-03): `(no content)` 占位消息不再包含在 SDK 输出
- **0.2.84** (2026-03-26): `[Request interrupted by user]` 仅用于用户中断
- **0.3.144** (2026-05-18): assistant 消息在模型不存在时报告 `error: 'model_not_found'`
- **0.3.150** (2026-05-23): api_retry 529 响应报 `error: 'overloaded'` 而非 `'rate_limit'`
- **0.3.162** (2026-06-03): refusal 错误携带 `stop_reason: 'refusal'` 与 `stop_details`

## 重要里程碑

- **2025-09-27 (0.0.4)**: SDK 首发
- **2025-09-29 (0.1.0)**: 重大 API 重构 — 四大配置支柱确立 (systemPrompt / settingSources / agents / forkSession)
- **2025-11-18 (0.1.45)**: 引入 Microsoft Foundry 与结构化输出
- **2025-11-24 (0.1.51)**: Opus 4.5 支持
- **2025-11-26 (0.1.54)**: 实验性 V2 session API 引入
- **2025-12-03 (0.1.57)**: `tools` 选项(精确白名单)
- **2025-12-03 (0.1.58)**: `betas` 选项 + 1M context (Sonnet 4/4.5)
- **2025-12-16 (0.1.71)**: `AskUserQuestion` 工具 + zod v4 peer dep
- **2025-12-17 (0.1.72)**: V2 session API `receive()` → `stream()` 重命名
- **2026-01-07 (0.2.0)**: 首个 0.2 minor — `McpServerStatus.error` 字段
- **2026-01-28 (0.2.21)**: MCP 动态治理(`reconnectMcpServer` / `toggleMcpServer`)
- **2026-02-03 (0.2.30)**: debug 选项 + FileRead `pages` 字段
- **2026-02-17 (0.2.45)**: Claude Sonnet 4.6 支持
- **2026-02-18 (0.2.47)**: `promptSuggestion()` 方法
- **2026-02-24 (0.2.51)**: 关键稳定性修复(Bun ReferenceError、长会话内存)
- **2026-02-26 (0.2.59)**: `getSessionMessages()` 函数
- **2026-03-05 (0.2.69)**: `toolConfig.askUserQuestion.previewFormat` + ModelInfo 扩展
- **2026-03-10 (0.2.72)**: `agentProgressSummaries` AI 进度摘要
- **2026-03-14 (0.2.76)**: `forkSession()` + MCP elicitation hook
- **2026-03-30 (0.2.88)**: `startup()` 预热 + `getSubagentMessages`
- **2026-04-07 (0.2.94)**: **CJK 修复** — U+FFFD 损坏(本项目影响重大)
- **2026-04-10 (0.2.101)**: **Security 升级** + Windows temp 泄漏修复
- **2026-04-16 (0.2.111)**: Opus 4.7 + `mcp_set_servers` per-tool policy
- **2026-04-17 (0.2.113)**: **架构变化** — 改 spawn native binary
- **2026-04-22 (0.2.118)**: `Options.managedSettings`
- **2026-04-23 (0.2.119)**: `forwardSubagentText` + `excludeDynamicSections` 行为
- **2026-04-24 (0.2.120)**: `skills` 选项(`string[] | 'all'`)
- **2026-05-07 (0.2.133)**: 废弃 V2 session API
- **2026-05-08 (0.2.136)**: 废弃 TodoWrite + `resolveSettings()` (alpha)
- **2026-05-13 (0.2.141)**: TaskCreate/TaskGet/TaskUpdate/TaskList 类型导出
- **2026-05-14 (0.3.142)**: **重大架构变化** — 移除 V2 session API、Task 工具替代 TodoWrite
- **2026-05-15 (0.3.143)**: peerDependencies 化
- **2026-05-18 (0.3.144)**: `model_not_found` 错误报告
- **2026-05-26 (0.3.152)**: `MessageDisplay` hook 事件
- **2026-06-09 (0.3.170)**: `claude-fable-5` 模型 + `fable` 别名
- **2026-06-11 (0.3.174)**: 统一 `system/model_fallback` 消息

## compat-2161 影响分析

参考项目内 Claude Code 兼容追踪源:
- `D:/tool/tech-cc-hub/src/electron/libs/claude/`
- `D:/tool/tech-cc-hub/src/electron/libs/claude-code-compat-registry.ts`

### 新增的 SDK 能力 (本项目可利用)

- **`startup()` 预热 (0.2.88)**: 适合 Electron 启动时预热 CLI 子进程,降低首轮延迟
- **`includeSystemMessages` / `includeHookEvents` (0.2.88)**: 内部调试能力
- **`getSubagentMessages` / `listSubagents` (0.2.88)**: 增强 subagent 可观测性
- **`listSessions` / `getSessionInfo` / `getSessionMessages` / `renameSession` / `tagSession` / `deleteSession` (0.2.53 ~ 0.2.75)**: 完整 session 治理,可用于本项目会话列表 UI
- **`forkSession()` (0.2.76)**: 分支对话,本项目可探索"重新开始不同方向"场景
- **`MessageDisplay` hook (0.3.152)**: 转换/隐藏展示的 assistant 消息,可用于 UI 文案适配
- **`origin` 字段 on result 消息 (0.2.126)**: 消息溯源
- **`additionalContext` on Stop/SubagentStop hooks (0.3.163)**: 注入额外上下文
- **`refusal` stop_reason (0.3.162)**: 安全拒绝事件处理
- **`claude-fable-5` / `fable` (0.3.170)**: 新模型接入
- **`Opus 4.7` (0.2.111)**: 升级到该模型
- **`Sonnet 4.6` (0.2.45)**: 升级到该模型
- **`Opus 4.5` (0.1.51)**: 升级到该模型
- **结构化输出 (0.1.45)**: 强类型响应
- **`AgentTaskOutput.queued_to_running` 状态 (0.2.75)**: 任务状态机细化
- **`betas` 选项 + 1M context (0.1.58)**: 启用 Sonnet 4/4.5 1M 上下文
- **`tools` 选项 (0.1.57)**: 精确工具白名单

### 行为变化 (本项目需要适配)

- **CJK 修复 (0.2.94)**: 本项目 UI 大量使用简体中文,**必须升级到此版本或更高** 修复 U+FFFD 损坏
- **Windows temp 目录泄漏 (0.2.101)**: 在 Windows 上改善 resume session 行为
- **MaxListenersExceededWarning (0.2.101)**: 修复 11+ 并发 `query()` 调用
- **MCP 默认后台连接 (0.3.142)**: 不再假设 MCP 在首次 query() 之前就绪,UI 需要在 MCP 未连接时不阻塞主交互
- **Task 工具替代 TodoWrite (0.3.142)**: 监听 `task_progress`、`task_started`、`TaskCreate/TaskGet/TaskUpdate/TaskList` 等事件;旧的 `TodoWrite` 事件已废弃
- **`stop_reason: 'refusal'` (0.3.162)**: 本项目的安全拒绝 UI 触发器
- **统一 `system/model_fallback` 消息 (0.3.174)**: 替代之前分散的 fallback 事件
- **`api_retry` 529 响应报 `error: 'overloaded'` (0.3.150)**: 客户端错误处理需更新
- **`assistant` 消息 `error: 'model_not_found'` (0.3.144)**: 模型不可用时明确错误类型
- **`MessageDisplay` hook (0.3.152)**: 转换/隐藏 assistant 消息
- **Hook callback 不再吞 abort signal (0.3.160)**: abort 行为更明确
- **`(no content)` 不再输出 (0.2.30)**: 过滤空消息的代码可以简化
- **非用户错误不再显示 `[Request interrupted by user]` (0.2.84)**: 错误分类更准确

### 工具/接口调整

- **V2 session API 移除 (0.3.142)**: 本项目若使用 `unstable_v2_*`,必须迁移到 `query()`
- **`options.env` 语义反复调整**:
  - 0.2.110 之前: 替换 process.env
  - 0.2.111: 改为 overlay
  - 0.2.113: 恢复为替换
  - 0.3.149: 文档修正
  - **本项目若依赖 env 行为,需固定到具体版本**
- **Task 工具类型导出 (0.2.141)**: 改用 `@anthropic-ai/claude-agent-sdk/sdk-tools` 导入 `TaskCreateInput` 等
- **native binary 切换 (0.2.113)**: 验证 `pathToClaudeCodeExecutable` 配置
- **`peerDependencies` 化 (0.3.143)**: `package.json` 显式声明 `@anthropic-ai/sdk` 与 `@modelcontextprotocol/sdk`
- **`sessionStore` (alpha) (0.2.113)**: 自定义 session 持久化
- **`SDKMirrorErrorMessage` (0.2.113)**: 镜像错误消息处理
- **`SDKElicitationCompleteMessage` (0.2.76)**: MCP elicitation 完成事件
- **`PermissionMode` 新增 `'auto'` (0.2.91)**: 自动权限模式

### 与本项目 Claude Code 兼容层相关的关键版本

- **0.0.4**: 基线 (与本项目 initial commit 时期 SDK 同步)
- **0.1.0**: API 重构 — 兼容层需要重新映射字段
- **0.1.45**: 结构化输出 — compat registry 需添加 structured output handler
- **0.1.51**: Opus 4.5 — 模型列表更新
- **0.1.57**: `tools` 选项 — 工具白名单
- **0.1.58**: `betas` 选项 — 1M context
- **0.1.66**: project MCP server 修复
- **0.1.71**: zod v4 + Windows 修复
- **0.1.72**: V2 session API `stream()` 重命名
- **0.2.0**: `McpServerStatus.error` — MCP 错误处理
- **0.2.21**: MCP `reconnectMcpServer` / `toggleMcpServer`
- **0.2.30**: `debug` 选项 + FileRead `pages`
- **0.2.45**: Sonnet 4.6
- **0.2.51**: 关键稳定性修复 (Bun / 长会话内存 / slash command)
- **0.2.53**: `listSessions()`
- **0.2.59**: `getSessionMessages()`
- **0.2.69**: 修复 `system:init` / `result` 事件 Agent tool name 回退
- **0.2.74**: 修复 `import type` from `sdk-tools` 在 NodeNext 下失败
- **0.2.76**: `forkSession()` + MCP elicitation
- **0.2.83**: `session_state_changed` opt-in
- **0.2.86**: `getContextUsage()` + `SDKUserMessage.session_id` optional
- **0.2.88**: `startup()` / `getSubagentMessages`
- **0.2.91**: `PermissionMode` 新增 `'auto'` + sandbox `failIfUnavailable` 默认 true
- **0.2.94**: **CJK 修复** (本项目必须升级)
- **0.2.101**: **Security 升级** + Windows temp 修复 + 并发 query 修复
- **0.2.111**: Opus 4.7 + `options.env` overlay
- **0.2.113**: **native binary 切换** + `sessionStore` (alpha)
- **0.2.118**: `Options.managedSettings`
- **0.2.119**: `forwardSubagentText` + 长会话 reconnect
- **0.2.120**: `skills` 选项
- **0.2.126**: result 消息 `origin` 字段
- **0.2.132**: `applyFlagSettings()` + flag-settings `null` 清空
- **0.2.133**: 废弃 V2 session API
- **0.2.136**: 废弃 TodoWrite + `resolveSettings()`
- **0.2.141**: Task 工具类型导出到 `sdk-tools`
- **0.3.142**: **Task 工具替代 TodoWrite** + 移除 V2 session API
- **0.3.143**: peerDependencies 化
- **0.3.144**: `model_not_found` 错误 + `/extract` 导出
- **0.3.149**: `Options.env` 文档修正
- **0.3.150**: api_retry `error: 'overloaded'`
- **0.3.152**: `MessageDisplay` hook
- **0.3.154** (当前): stdio MCP server 不再错误重启
- **0.3.160**: hook callback 不吞 abort signal
- **0.3.161**: `initialize` 控制请求幂等
- **0.3.162**: refusal `stop_reason` + native build fast find/grep
- **0.3.163**: `stop_task` 目标不存在 success + `setMcpServers` builtin
- **0.3.166**: mcp_set_servers 资源工具注入
- **0.3.169**: experimental usage API + SSE options
- **0.3.170**: claude-fable-5 / fable
- **0.3.172**: `skipMcpDiscovery` per plugin + slash 空白修复
- **0.3.174**: 统一 `system/model_fallback`
- **0.3.176**: 后台 agent 状态恢复 + turn result 不丢
- **0.3.178**: libc 不匹配错误提示 + `UserPromptSubmit` hook 反馈发出 + `disallowedTools` 中 `mcp__server` 规格生效 + typed denial reasons
- **0.3.179**: `tool_use_meta` 友好显示名 + `-p` 模式等 background agent 通知 + remote session turn 边界发 result
- **0.3.180**: parity with Claude Code v2.1.180 (npm registry 已撤回,跳过)
- **0.3.181**: `SDKRateLimitInfo` 充值检测字段 + `tool_use_meta.icon_url` + Remote Control `file_attachments` 恢复

## 索引与导航

- 跳转链接到各 minor section:
  - [0.3.x 详细日志](#03x-2026-05-14--2026-06-17)
  - [0.2.x 详细日志](#02x-2026-01-07--2026-05-13)
  - [0.1.x 详细日志](#01x-2025-09-29--2026-01-06)
  - [0.0.x 详细日志](#00x)
  - [破坏性变更汇总](#破坏性变更汇总)
  - [重要里程碑](#重要里程碑)
  - [compat-2161 影响分析](#compat-2161-影响分析)
- 配套索引: [claude-agent-sdk-index.md](./claude-agent-sdk-index.md)
- 项目兼容层源:
  - D:/tool/tech-cc-hub/src/electron/libs/claude/
  - D:/tool/tech-cc-hub/src/electron/libs/claude-code-compat-registry.ts

## 数据来源

- npm registry: https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk
- GitHub releases: https://github.com/anthropics/claude-agent-sdk-typescript/releases
- CHANGELOG.md: https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md
- 项目兼容层: D:/tool/tech-cc-hub/src/electron/libs/claude/ 和 claude-code-compat-registry.ts
