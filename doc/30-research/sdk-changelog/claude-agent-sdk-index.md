# @anthropic-ai/claude-agent-sdk 版本索引

> 简版索引,完整记录请参考同目录下 `claude-agent-sdk-full-record.md`。
> 数据来源: npm registry、GitHub releases、CHANGELOG.md。
> 生成时间: 2026-06-18

## 概览

- **当前安装版本**: 0.3.154
- **npm 包名**: @anthropic-ai/claude-agent-sdk
- **官方仓库**: https://github.com/anthropics/claude-agent-sdk-typescript
- **总版本数**: 222
- **收录范围**: 0.0.4 (2025-09-27) → 0.3.181 (2026-06-17)
- **数据完整度**: rich(含 CHANGELOG.md)
- **平均发布间隔**: 约 1.21 天

## 时间线 (新→旧)

| 版本 | 日期 | 摘要 |
| --- | --- | --- |
| 0.3.181 | 2026-06-17 | SDKRateLimitInfo 新增 errorCode/canUserPurchaseCredits/hasChargeableSavedPaymentMethod;assistant 消息新增 tool_use_meta.icon_url;修复 Remote Control 丢 file_attachments |
| 0.3.180 | 撤回 | parity with Claude Code v2.1.180 (npm registry 已撤回,跳过) |
| 0.3.179 | 2026-06-16 | assistant 消息新增 tool_use_meta 友好显示名;修复 -p 模式未等 background agent 完成通知就退出;修复 remote stream-json session 全程 busy |
| 0.3.178 | 2026-06-15 | spawn 失败提示 libc 不匹配与 options.pathToClaudeCodeExecutable;Permission-denied 携带 typed reasons;UserPromptSubmit hook block feedback 发出到 event stream;disallowedTools 中 mcp__server/__* 规格生效;Remote Control worker graceful exit 发 worker_shutting_down |
| 0.3.177 | 2026-06-13 | parity with Claude Code v2.1.177 |
| 0.3.176 | 2026-06-12 | 修复多 turn 完成与后台 agent/workflow 运行时 turn result 消息被丢弃;修复 resume session 时后台/远程/MCP 任务状态未恢复 |
| 0.3.175 | 2026-06-12 | parity with Claude Code v2.1.175 |
| 0.3.174 | 2026-06-11 | 所有 fallback 触发条件 (overloaded, server_error, last_resort, model_not_found, permission_denied) 统一发出 system/model_fallback 消息 |
| 0.3.173 | 2026-06-11 | parity with Claude Code v2.1.173 |
| 0.3.172 | 2026-06-10 | plugins 选项支持每插件 skipMcpDiscovery:true;修复 slash 后跟空白被静默丢弃 |
| 0.3.170 | 2026-06-09 | 新增 claude-fable-5 模型与 fable 别名;parity with v2.1.170 |
| 0.3.169 | 2026-06-08 | Query 新增 experimental usage_EXPERIMENTAL_MAY_CHANGE 方法;BrowserQueryOptions 新增 sse 选项 (SSEOptions) |
| 0.3.168 | 2026-06-06 | parity with Claude Code v2.1.168 |
| 0.3.167 | 2026-06-06 | parity with Claude Code v2.1.167 |
| 0.3.166 | 2026-06-05 | 修复运行时通过 mcp_set_servers 注入的 MCP 资源工具未注入 |
| 0.3.165 | 2026-06-05 | parity with Claude Code v2.1.165 |
| 0.3.163 | 2026-06-04 | stop_task 目标已不存在时返回 success;修复 SDK 宿主无法通过 setMcpServers 添加 builtin MCP;Stop/SubagentStop 支持 additionalContext |
| 0.3.162 | 2026-06-03 | refusal 错误消息携带 stop_reason:refusal 与 stop_details;native build 默认使用 fast embedded find/grep |
| 0.3.161 | 2026-06-02 | initialize 控制请求幂等;ControlResponse 新增 pending_permission_requests;applyFlagSettings 下轮 live-applies agent 变更 |
| 0.3.160 | 2026-06-01 | 修复 SDK hook callback 吞掉 abort signal;PostToolUse 期间 abort 以 result 消息结束 turn |
| 0.3.159 | 2026-05-31 | parity with Claude Code v2.1.159 |
| 0.3.158 | 2026-05-30 | parity with Claude Code v2.1.158 |
| 0.3.157 | 2026-05-29 | parity with Claude Code v2.1.157 |
| 0.3.156 | 2026-05-28 | parity with Claude Code v2.1.156 |
| 0.3.154 | 2026-05-28 | 修复 stdio MCP server 因 config-equality 假阳性在每次 reconcile 时被错误重启 |
| 0.3.153 | 2026-05-27 | parity with Claude Code v2.1.153 |
| 0.3.152 | 2026-05-26 | SessionStart hook 可返回 reloadSkills:true;hookSpecificOutput.sessionTitle 设置标题;新增 MessageDisplay hook |
| 0.3.150 | 2026-05-23 | api_retry 529 响应报 error:overloaded 而非 rate_limit;parity with v2.1.150 |
| 0.3.149 | 2026-05-22 | 修复 options.env 丢失 CLAUDE_AGENT_SDK_VERSION;纠正 Options.env 文档为替换而非合并 |
| 0.3.148 | 2026-05-22 | parity with Claude Code v2.1.148 |
| 0.3.147 | 2026-05-21 | parity with Claude Code v2.1.147 |
| 0.3.146 | 2026-05-20 | parity with Claude Code v2.1.146 |
| 0.3.145 | 2026-05-19 | parity with Claude Code v2.1.145 |
| 0.3.144 | 2026-05-18 | assistant 消息与 StopFailure hook 模型不存在时报 error:model_not_found;新增 /extract 导出供 bun build --compile 使用 |
| 0.3.143 | 2026-05-15 | @anthropic-ai/sdk 与 @modelcontextprotocol/sdk 改为 peerDependencies,运行时不变 |
| 0.3.142 | 2026-05-14 | **Breaking**: 移除 v2 session API;MCP 默认后台连接;headless/SDK 改用 Task 工具替代 TodoWrite;暴露 request_id/subagent_type/task_description;--sdk-url 远程 transport 永久关闭时非零退出 |
| 0.2.141 | 2026-05-13 | TaskCreate/TaskGet/TaskUpdate/TaskList 类型导出到 sdk-tools;@anthropic-ai/sdk 依赖对齐到 ^0.93.0 |
| 0.2.140 | 2026-05-12 | parity with Claude Code v2.1.140 |
| 0.2.139 | 2026-05-11 | parity with Claude Code v2.1.139 |
| 0.2.138 | 2026-05-09 | parity with Claude Code v2.1.138 |
| 0.2.137 | 2026-05-09 | parity with Claude Code v2.1.137 |
| 0.2.136 | 2026-05-08 | 新增 resolveSettings() (alpha) 用于 spawn CLI 前检查 effective merged settings;废弃 TodoWrite 工具 |
| 0.2.133 | 2026-05-07 | 废弃 unstable V2 session API (改用 query());废弃 allowedTools 传 Skill (改用 skills 选项) |
| 0.2.132 | 2026-05-06 | TS Agent SDK reference 文档化 applyFlagSettings();flag-settings 支持 null 清空覆盖 |
| 0.2.131 | 2026-05-06 | parity with Claude Code v2.1.131 |
| 0.2.129 | 2026-05-05 | parity with Claude Code v2.1.129 |
| 0.2.128 | 2026-05-04 | parity with Claude Code v2.1.128 |
| 0.2.126 | 2026-04-30 | result 消息新增 origin 字段,转发触发消息的 SDKMessageOrigin |
| 0.2.124 | 2026-04-30 | parity with Claude Code v2.1.124 |
| 0.2.123 | 2026-04-29 | parity with Claude Code v2.1.123 |
| 0.2.122 | 2026-04-28 | parity with Claude Code v2.1.122 |
| 0.2.121 | 2026-04-27 | PostToolUseHookSpecificOutput 新增 updatedToolOutput 用于替换工具输出 (updatedMCPToolOutput 已废弃) |
| 0.2.120 | 2026-04-24 | 新增 skills 选项 (string[] \| 'all') 控制加载到主会话的 Skills |
| 0.2.119 | 2026-04-23 | forwardSubagentText 转发 subagent 文本 delta;excludeDynamicSections 保留可缓存系统提示;长会话 reconnect claude.ai MCP;SessionStore.append() 重试 3 次 |
| 0.2.118 | 2026-04-22 | 新增 Options.managedSettings 用于在内存中向 spawn 的 CLI 传递 policy-tier 设置 |
| 0.2.117 | 2026-04-21 | parity with Claude Code v2.1.117 |
| 0.2.116 | 2026-04-20 | parity with Claude Code v2.1.116 |
| 0.2.114 | 2026-04-17 | parity with Claude Code v2.1.114 |
| 0.2.113 | 2026-04-17 | **Breaking**: SDK 改为 spawn native Claude Code binary 而非 bundled JS;新增 sessionStore (alpha)、deleteSession()、SDKMirrorErrorMessage;options.env 恢复为替换 process.env;新增 title 选项与 OpenTelemetry trace context |
| 0.2.112 | 2026-04-16 | parity with Claude Code v2.1.112 |
| 0.2.111 | 2026-04-16 | Opus 4.7 可用;mcp_set_servers 控制请求支持远端 server 的 per-tool permission_policy;startup() 与 WarmQuery 进入公开 TS API;options.env 改为覆盖继承的 process.env |
| 0.2.110 | 2026-04-15 | 修复 unstable_v2_createSession 不尊重 cwd/settingSources/allowDangerouslySkipPermissions;SDKUserMessage 新增 shouldQuery;自动会话标题生成尊重 CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC |
| 0.2.109 | 2026-04-15 | parity with Claude Code v2.1.109 |
| 0.2.108 | 2026-04-14 | parity with Claude Code v2.1.106 |
| 0.2.107 | 2026-04-14 | parity with Claude Code v2.1.106 |
| 0.2.105 | 2026-04-13 | 新增 system/memory_recall 事件与 memory_paths on system/init;修复 error_max_structured_output_retries 在最终重试成功时仍发出 |
| 0.2.104 | 2026-04-12 | parity with Claude Code v2.1.95 |
| 0.2.101 | 2026-04-10 | **Security**: 升级 @anthropic-ai/sdk 到 ^0.81.0、@modelcontextprotocol/sdk 到 ^1.29.0;修复 Windows 上 resume-session 临时目录泄漏;修复 11+ 并发 query() 时的 MaxListenersExceededWarning |
| 0.2.100 | 2026-04-10 | parity with Claude Code v2.1.100 |
| 0.2.98 | 2026-04-09 | parity with Claude Code v2.1.98 |
| 0.2.97 | 2026-04-08 | parity with Claude Code v2.1.97 |
| 0.2.96 | 2026-04-08 | parity with Claude Code v2.1.96 |
| 0.2.94 | 2026-04-07 | 修复 getContextUsage() 包含 options.agents;修复 CJK/多字节文本 U+FFFD 损坏;修复 MCP 子进程未清理;修复失败 error-report 写入导致 SDK 崩溃 |
| 0.2.92 | 2026-04-04 | parity with Claude Code v2.1.92 |
| 0.2.91 | 2026-04-02 | result 消息新增 terminal_reason;PermissionMode 公开类型加 auto;sandbox 启用时 failIfUnavailable 默认为 true |
| 0.2.90 | 2026-04-01 | parity with Claude Code v2.1.90 |
| 0.2.89 | 2026-03-31 | parity with Claude Code v2.1.87 |
| 0.2.88 | 2026-03-30 | 新增 startup() 预热 CLI 子进程;includeSystemMessages、listSubagents、getSubagentMessages、includeHookEvents;修复 ERR_STREAM_WRITE_AFTER_END;Zod v4 .describe() 不再丢失 |
| 0.2.87 | 2026-03-29 | parity with Claude Code v2.1.87 |
| 0.2.86 | 2026-03-27 | 新增 getContextUsage() 控制方法;SDKUserMessage.session_id 改为可选;修复 TypeScript 类型解析为 any |
| 0.2.85 | 2026-03-26 | 新增 reloadPlugins() SDK 方法;修复 PreToolUse hook permissionDecision:ask 被忽略 |
| 0.2.84 | 2026-03-26 | 新增 taskBudget 选项;新增 enableChannel() 与 capabilities 字段;导出 EffortLevel 类型 |
| 0.2.83 | 2026-03-25 | 新增 seed_read_state 控制子类型;session_state_changed 事件改为 opt-in via CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1 |
| 0.2.81 | 2026-03-20 | 修复 canUseTool 未提供可用的 addRules 建议 |
| 0.2.80 | 2026-03-19 | 修复 getSessionMessages() 丢失并行工具结果 |
| 0.2.79 | 2026-03-18 | ExitReason 类型新增 resume 区分 resume 触发的会话结束 |
| 0.2.78 | 2026-03-17 | parity with Claude Code v2.1.78 |
| 0.2.77 | 2026-03-16 | 重试瞬时 API 错误时新增 api_retry 系统消息 |
| 0.2.76 | 2026-03-14 | 新增 forkSession() 用于分支对话;新增 cancel_async_message 控制子类型;ExitPlanMode 新增 planFilePath;新增 MCP elicitation hook 类型与 SDKElicitationCompleteMessage |
| 0.2.75 | 2026-03-13 | SDKSessionInfo 新增 tag/createdAt;新增 getSessionInfo();listSessions 新增 offset;新增 tagSession() |
| 0.2.74 | 2026-03-12 | 新增 renameSession();修复 NodeNext/Bundler 下 sdk-tools 导入类型失败 |
| 0.2.73 | 2026-03-11 | 修复 options.env 被 ~/.claude/settings.json env 块覆盖 |
| 0.2.72 | 2026-03-10 | 新增 agentProgressSummaries 周期性 AI 进度摘要;新增 getSettings() applied 段 |
| 0.2.71 | 2026-03-06 | parity with Claude Code v2.1.71 |
| 0.2.70 | 2026-03-06 | 修复 type:http MCP 在 Streamable HTTP 406 失败;AgentToolInput.subagent_type 改为可选 |
| 0.2.69 | 2026-03-05 | 新增 toolConfig.askUserQuestion.previewFormat;ModelInfo 新增 supportsFastMode;hook 事件新增 agent_id/agent_type |
| 0.2.68 | 2026-03-04 | parity with Claude Code v2.1.68 |
| 0.2.66 | 2026-03-04 | parity with Claude Code v2.1.66 |
| 0.2.64 | 2026-03-03 | parity with Claude Code v2.1.66 |
| 0.2.63 | 2026-02-28 | 修复 pathToClaudeCodeExecutable 设为裸命令名时失败;新增 supportedAgents() 方法 |
| 0.2.62 | 2026-02-27 | parity with Claude Code v2.1.61 |
| 0.2.61 | 2026-02-26 | parity with Claude Code v2.1.61 |
| 0.2.59 | 2026-02-26 | 新增 getSessionMessages() 用于从 transcript 文件读取会话历史 |
| 0.2.58 | 2026-02-25 | parity with Claude Code v2.1.58 |
| 0.2.56 | 2026-02-25 | parity with Claude Code v2.1.56 |
| 0.2.55 | 2026-02-25 | parity with Claude Code v2.1.55 |
| 0.2.54 | 2026-02-25 | parity with Claude Code v2.1.54 |
| 0.2.53 | 2026-02-24 | 新增 listSessions() 用于发现/列出历史会话 (轻量元数据) |
| 0.2.52 | 2026-02-24 | parity with Claude Code v2.1.52 |
| 0.2.51 | 2026-02-24 | 修复 Bun 编译二进制中 SDK 出现 ReferenceError;修复长会话内存无限增长;修复本地 slash 命令输出未返回;新增 task_progress 事件 |
| 0.2.50 | 2026-02-20 | parity with Claude Code v2.1.50 |
| 0.2.49 | 2026-02-19 | SDK model info 新增 supportsEffort/supportedEffortLevels/supportsAdaptiveThinking;新增 ConfigChange hook 事件 |
| 0.2.48 | 2026-02-19 | parity with Claude Code v2.1.46 |
| 0.2.47 | 2026-02-18 | Query 上新增 promptSuggestion() 方法;task_notification 事件新增 tool_use_id |
| 0.2.45 | 2026-02-17 | 新增 Claude Sonnet 4.6 支持;新增 task_started 系统消息;修复 Session.stream() 在后台 subagent 还在跑时提前返回 |
| 0.2.44 | 2026-02-16 | parity with Claude Code v2.1.44 |
| 0.2.42 | 2026-02-13 | parity with Claude Code v2.1.42 |
| 0.2.41 | 2026-02-13 | parity with Claude Code v2.1.41 |
| 0.2.40 | 2026-02-12 | parity with Claude Code v2.1.40 |
| 0.2.39 | 2026-02-10 | parity with Claude Code v2.1.39 |
| 0.2.38 | 2026-02-10 | parity with Claude Code v2.1.38 |
| 0.2.37 | 2026-02-07 | parity with Claude Code v2.1.37 |
| 0.2.36 | 2026-02-07 | parity with Claude Code v2.1.36 |
| 0.2.34 | 2026-02-06 | parity with Claude Code v2.1.34 |
| 0.2.33 | 2026-02-06 | 新增 TeammateIdle 与 TaskCompleted hook 事件;sessionId 选项允许自定义 UUID |
| 0.2.32 | 2026-02-05 | parity with Claude Code v2.1.32 |
| 0.2.31 | 2026-02-04 | SDKResultSuccess 与 SDKResultError 新增 stop_reason 字段 |
| 0.2.30 | 2026-02-03 | 新增 debug 与 debugFile 选项;FileReadToolInput 新增 pages 字段;FileReadToolOutput 新增 parts 输出类型 |
| 0.2.29 | 2026-01-31 | parity with Claude Code v2.1.29 |
| 0.2.27 | 2026-01-30 | tool() 助手新增 annotations 支持 MCP tool hints;mcpServerStatus() 包含来自 SDK 与动态添加 MCP server 的工具 |
| 0.2.26 | 2026-01-30 | parity with Claude Code v2.1.27 |
| 0.2.25 | 2026-01-29 | parity with Claude Code v2.1.25 |
| 0.2.23 | 2026-01-29 | 修复结构化输出验证错误未正确报告 |
| 0.2.22 | 2026-01-28 | 修复结构化输出处理空 assistant 消息 |
| 0.2.21 | 2026-01-28 | McpServerStatus 新增 config/scope/tools 字段;新增 reconnectMcpServer() 与 toggleMcpServer() 方法;新增 disabled 状态 |
| 0.2.20 | 2026-01-27 | 新增 additionalDirectories 选项加载对应目录的 CLAUDE.md;CLAUDE_CODE_ENABLE_TASKS env var |
| 0.2.19 | 2026-01-23 | 新增 CLAUDE_CODE_ENABLE_TASKS env var 启用新 task 系统 |
| 0.2.18 | 2026-01-22 | 新增 CLAUDE_CODE_ENABLE_TASKS env var,opt-in 新 task 系统 |
| 0.2.17 | 2026-01-22 | parity with Claude Code v2.1.17 |
| 0.2.16 | 2026-01-22 | parity with Claude Code v2.1.16 |
| 0.2.15 | 2026-01-21 | 新增 notification hook 支持;Query 接口新增 close() 强制终止运行中的 query |
| 0.2.14 | 2026-01-20 | parity with Claude Code v2.1.14 |
| 0.2.12 | 2026-01-17 | parity with Claude Code v2.1.12 |
| 0.2.11 | 2026-01-17 | parity with Claude Code v2.1.11 |
| 0.2.10 | 2026-01-17 | 自定义 agent 定义新增 skills 与 maxTurns 配置选项 |
| 0.2.9 | 2026-01-16 | parity with Claude Code v2.1.9 |
| 0.2.8 | 2026-01-15 | parity with Claude Code v2.1.8 |
| 0.2.7 | 2026-01-13 | parity with Claude Code v2.1.7 |
| 0.2.6 | 2026-01-13 | package.json 新增 claudeCodeVersion 字段用于程序化确定兼容 CLI 版本 |
| 0.2.5 | 2026-01-11 | parity with Claude Code v2.1.5 |
| 0.2.4 | 2026-01-10 | parity with Claude Code v2.1.4 |
| 0.2.3 | 2026-01-09 | parity with Claude Code v2.1.3 |
| 0.2.2 | 2026-01-08 | parity with Claude Code v2.1.2 |
| 0.2.1 | 2026-01-07 | parity with Claude Code v2.1.1 |
| 0.2.0 | 2026-01-07 | McpServerStatus 新增 error 字段;parity with Claude Code v2.1.0 |
| 0.1.77 | 2026-01-06 | parity with Claude Code v2.0.78 |
| 0.1.76 | 2025-12-22 | (无 release notes) |
| 0.1.75 | 2025-12-20 | parity with Claude Code v2.0.75 |
| 0.1.74 | 2025-12-19 | parity with Claude Code v2.0.74 |
| 0.1.73 | 2025-12-18 | 修复 Stop hook 因 Stream closed 错误不一致运行 |
| 0.1.72 | 2025-12-17 | 修复 /context 不尊重自定义 system prompt;修复非流式单轮 query 提前关闭;V2 session API receive() 改名为 stream() |
| 0.1.71 | 2025-12-16 | 新增 zod ^4.0.0 peer dep 选项;AskUserQuestion 工具支持;修复 Windows 上 spawn Claude 子进程时显示控制台窗口 |
| 0.1.70 | 2025-12-15 | (无 release notes) |
| 0.1.69 | 2025-12-13 | parity with Claude Code v2.0.69 |
| 0.1.68 | 2025-12-12 | 修复不允许的 MCP 工具对模型可见 |
| 0.1.67 | 2025-12-11 | parity with Claude Code v2.0.67 |
| 0.1.66 | 2025-12-11 | 修复 project MCP servers from .mcp.json 在 settingSources 含 project 时不可用 |
| 0.1.65 | 2025-12-11 | parity with Claude Code v2.0.66 |
| 0.1.63 | 2025-12-09 | parity with Claude Code v2.0.63 |
| 0.1.62 | 2025-12-09 | (无 release notes) |
| 0.1.61 | 2025-12-07 | parity with Claude Code v2.0.61 |
| 0.1.60 | 2025-12-05 | parity with Claude Code v2.0.60 |
| 0.1.59 | 2025-12-04 | parity with Claude Code v2.0.59 |
| 0.1.58 | 2025-12-03 | betas 选项启用 beta 特性 (context-1m-2025-08-07 让 Sonnet 4/4.5 启用 1M token 上下文) |
| 0.1.57 | 2025-12-03 | 新增 tools 选项指定可用内置工具集合 |
| 0.1.56 | 2025-12-01 | parity with Claude Code v2.0.56 |
| 0.1.55 | 2025-11-26 | Update to parity with Claude Code v2.0.55 |
| 0.1.54 | 2025-11-26 | **Experimental**: 新增 v2 session API (unstable_v2_createSession/_resumeSession/_prompt);修复 ExitPlanMode 工具 input 为空 |
| 0.1.53 | 2025-11-25 | parity with Claude Code v2.0.53 |
| 0.1.52 | 2025-11-24 | parity with Claude Code v2.0.52 |
| 0.1.51 | 2025-11-24 | 新增 Opus 4.5 支持 |
| 0.1.50 | 2025-11-21 | parity with Claude Code v2.0.50 |
| 0.1.49 | 2025-11-21 | parity with Claude Code v2.0.49 |
| 0.1.47 | 2025-11-19 | 部分消息新增 error 字段 |
| 0.1.46 | 2025-11-19 | parity with Claude Code v2.0.46 |
| 0.1.45 | 2025-11-18 | 新增 Microsoft Foundry 支持;结构化输出支持 |
| 0.1.44 | 2025-11-18 | parity with Claude Code v2.0.44 |
| 0.1.43 | 2025-11-17 | parity with Claude Code v2.0.43 |
| 0.1.42 | 2025-11-14 | parity with Claude Code v2.0.42 |
| 0.1.39 | 2025-11-14 | parity with Claude Code v2.0.41 |
| 0.1.37 | 2025-11-10 | parity with Claude Code v2.0.37 |
| 0.1.36 | 2025-11-07 | parity with Claude Code v2.0.36 |
| 0.1.35 | 2025-11-06 | parity with Claude Code v2.0.35 |
| 0.1.34 | 2025-11-05 | parity with Claude Code v2.0.34 |
| 0.1.33 | 2025-11-04 | parity with Claude Code v2.0.33 |
| 0.1.31 | 2025-11-03 | parity with Claude Code v2.0.32 |
| 0.1.30 | 2025-10-30 | 新增 --max-budget-usd flag;修复 stream 模式下 hook 偶发失败 |
| 0.1.29 | 2025-10-29 | parity with Claude Code v2.0.29 |
| 0.1.28 | 2025-10-27 | 修复自定义工具 30 秒超时而不尊重 MCP_TOOL_TIMEOUT |
| 0.1.27 | 2025-10-24 | Options 新增 plugins 字段 |
| 0.1.26 | 2025-10-23 | parity with Claude Code v2.0.26 |
| 0.1.25 | 2025-10-21 | 修复指定 project settings source 时 project-level skills 未加载;SDKSystemMessage 新增 skills 字段 |
| 0.1.23 | 2025-10-20 | (无 release notes) |
| 0.1.22 | 2025-10-17 | parity with Claude Code v2.0.22 |
| 0.1.21 | 2025-10-16 | parity with Claude Code v2.0.21 |
| 0.1.20 | 2025-10-16 | parity with Claude Code v2.0.20 |
| 0.1.19 | 2025-10-15 | parity with Claude Code v2.0.19 |
| 0.1.17 | 2025-10-15 | parity with Claude Code v2.0.18 |
| 0.1.16 | 2025-10-15 | parity with Claude Code v2.0.17 |
| 0.1.15 | 2025-10-14 | env 类型不再使用 Bun Dict;多 SDK MCP server 启动性能提升 |
| 0.1.14 | 2025-10-10 | parity with Claude Code v2.0.14 |
| 0.1.13 | 2025-10-09 | parity with Claude Code v2.0.13 |
| 0.1.12 | 2025-10-09 | SDK MCP channel 关闭超时提升到 60s |
| 0.1.11 | 2025-10-08 | parity with Claude Code v2.0.11 |
| 0.1.10 | 2025-10-07 | zod ^3.24.1 升级为 peer dependency |
| 0.1.9 | 2025-10-06 | 修复 system prompt 有时未正确设置 |
| 0.1.8 | 2025-10-04 | (无 release notes) |
| 0.1.5 | 2025-10-02 | (无 release notes) |
| 0.1.3 | 2025-10-01 | parity with Claude Code v2.0.1 |
| 0.1.2 | 2025-09-30 | (无 release notes) |
| 0.1.1 | 2025-09-30 | (无 release notes) |
| 0.1.0 | 2025-09-29 | **重大 API 重构**: 合并 customSystemPrompt/appendSystemPrompt 为单一 systemPrompt;不再注入默认 system prompt/filesystem settings;显式 settingsSources 控制;agents 选项支持编程式 subagent;forkSession 选项支持会话分叉;新增完整 API 指南 |
| 0.0.4 | 2025-09-27 | SDK 首发 (无 release notes) |

## 破坏性变更 (Breaking Changes)

- **0.0.4 → 0.1.0** (2025-09-29): system prompt/filesystem settings 字段重构,合并 customSystemPrompt/appendSystemPrompt,settingsSources 显式化
- **0.1.71 → 0.1.72** (2025-12-17): V2 session API `receive()` 改名为 `stream()`
- **0.2.0 → 0.2.0** (2026-01-07): McpServerStatus 新增 error 字段 (字段级扩展,需关注类型消费方)
- **0.2.101** (2026-04-10): 升级 @anthropic-ai/sdk 与 @modelcontextprotocol/sdk,可能影响 peer dep 锁文件
- **0.2.111** (2026-04-16): options.env 改为 overlay (0.2.110 → 0.2.111 行为变化)
- **0.2.113** (2026-04-17): **SDK 改为 spawn native Claude Code binary 而非 bundled JS**;options.env 恢复为替换;新增 sessionStore (alpha);新增 SDKMirrorErrorMessage
- **0.2.133** (2026-05-07): 废弃 V2 session API 与 allowedTools 传 Skill
- **0.2.136** (2026-05-08): 废弃 TodoWrite 工具,未来切换到 Task 工具
- **0.3.142** (2026-05-14): **移除 v2 session API**;MCP 默认后台连接;headless/SDK 改用 Task 工具替代 TodoWrite;--sdk-url 远程 transport 永久关闭时非零退出
- **0.3.143** (2026-05-15): @anthropic-ai/sdk 与 @modelcontextprotocol/sdk 改为 peerDependencies

## 各 minor 一句话总览

### 0.3.x (2026-05-14 → 2026-06-13)
**32 个版本**。从 0.2 跳到 0.3 是一次大版本 bump,反映 API 稳定化。重大动作: 移除 v2 session API、Task 工具替代 TodoWrite、SDK 内部架构迁移到 native binary、SDK/peer dep 调整、引入 MessageDisplay 与 SessionStart.reloadSkills 等新 hook 事件、model_fallback 统一报告、refusal stop_reason、新增 claude-fable-5 模型。

### 0.2.x (2026-01-07 → 2026-05-13)
**约 120+ 个版本**。SDK 功能大爆发: v2 session API 实验 → 废弃,新增 startup()/WarmQuery、MCP 动态管理 (reconnectMcpServer/toggleMcpServer/setMcpServers)、session 治理 (listSessions/getSessionInfo/getSessionMessages/renameSession/tagSession/deleteSession/forkSession)、Task 工具 (TaskCreate/TaskGet/TaskUpdate/TaskList)、OpenTelemetry、native binary 切换、resolveSettings、effort/thinking 模型元信息、permission policy、SDK 内部稳定性修复 (Windows 临时目录泄漏、Bun ReferenceError、长会话内存、Zod v4 metadata、stream abort)。

### 0.1.x (2025-09-29 → 2026-01-06)
**约 65 个版本**。SDK 从首版到大版本前的功能基线: 引入 systemPrompt/settingsSources/agents/forkSession 四大配置支柱,Claude Code parity 跟版节奏稳定 (v2.0.x),新增 Microsoft Foundry/结构化输出/Opus 4.5/v2 session API/AskUserQuestion/1M context beta/tools 选项/sessionId/stop_reason/fileRead pages/task_started/TeammateIdle/TaskCompleted hook 等关键能力。

### 0.0.x
仅 0.0.4 一个首发版本,无 release notes。

## 导航

- 完整记录: [claude-agent-sdk-full-record.md](./claude-agent-sdk-full-record.md)
- 详细章节:
  - [0.3.x 详细日志](./claude-agent-sdk-full-record.md#03x-2026-05-14--2026-06-13)
  - [0.2.x 详细日志](./claude-agent-sdk-full-record.md#02x-2026-01-07--2026-05-13)
  - [0.1.x 详细日志](./claude-agent-sdk-full-record.md#01x-2025-09-29--2026-01-06)
  - [0.0.x 详细日志](./claude-agent-sdk-full-record.md#00x)
  - [compat-2161 影响分析](./claude-agent-sdk-full-record.md#compat-2161-影响分析)

## 数据来源

- npm registry: https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk
- GitHub releases: https://github.com/anthropics/claude-agent-sdk-typescript/releases
- CHANGELOG.md: https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md
- 项目兼容层: D:/tool/tech-cc-hub/src/electron/libs/claude/ 和 claude-code-compat-registry.ts
