# package

> Anthropic Claude Agent SDK NPM包，为桌面Agent工作台提供核心的多模型路由、任务编排、会话管理和内置浏览器功能

@anthropic-ai/claude-agent-sdk 是用于构建AI Agent的SDK包，基于Claude Code的能力构建。支持通过WebSocket在浏览器环境运行、通过Bridge进行会话管理、通过Assistant Worker进行后台任务编排，并提供完整的多平台二进制分发(涵盖darwin/linux/win32的x64和arm64架构，以及musl变体)。SDK导出分为五个子路径:主SDK(.)、浏览器SDK(/browser)、桥接层(/bridge)、助手(/assistant)、工具类型(/sdk-tools)。

## 文件

### `package.json`

NPM包配置文件，定义包名、版本、主入口、导出映射、依赖和平台可选二进制依赖

- `main` (export) - 主入口点，指向sdk.mjs
- `exports` (mapping) - 条件导出映射，定义五个子路径: .(主SDK), ./browser, ./bridge, ./assistant, ./sdk-tools
- `dependencies` (config) - 核心依赖: @anthropic-ai/sdk和@modelcontextprotocol/sdk
- `optionalDependencies` (config) - 各平台(claude agent)的二进制分发，按OS/架构/musl分组的8个可选包
- `peerDependencies` (config) - 对端依赖zod，用于运行时schema验证

### `sdk.d.ts`

主SDK的TypeScript类型定义入口，导出SDK核心类型(未在截断中提供，但agentSdkTypes.d.ts从中重新导出)

### `agentSdkTypes.d.ts`

类型定义的转发入口，仅从sdk.js重新导出全部类型，保持flat package布局的类型一致性

- `export * from './sdk.js'` (re-export) - 将sdk.js的类型重导出到agentSdkTypes命名空间，供其他.d.ts文件统一导入

### `assistant.d.ts`

/assistant导出的API类型定义，描述Assistant Worker的状态、错误处理、配置选项和工作函数

- `WorkerState` (type) - Worker持久化状态，含claudeSessionId、lastSSESequenceNum、bridgeSessionId
- `WorkerStateAdapter` (interface) - 状态适配器接口，提供load()和save()方法用于状态持久化
- `AssistantWorkerError` (type) - 结构化错误，含kind字段(cconflict/auth/network/unknown)和detail描述
- `AssistantWorkerResult` (type) - runAssistantWorker的返回结果联合类型，ok为true时含handle，为false时含error
- `AssistantWorkerOptions` (type) - Worker配置选项，含bridge连接配置、sandboxed沙箱模式、scheduling定时调度、canUseTool工具权限回调
- `AssistantWorkerHandle` (type) - Worker操作句柄，提供spawn、sendUserMessage、abort、shutdown等方法

### `bridge.d.ts`

/bridge导出的API类型定义，描述会话桥接层transport handle和状态管理

- `SessionState` (type) - 会话状态枚举:idle|running|requires_action
- `BridgeSessionHandle` (interface) - 每个会话的transport句柄，封装JWT认证和SSE流管理，含getSequenceNum、isConnected、write、sendResult、sendControlRequest/Response/CancelRequest、refreshAuth等方法

### `browser-sdk.d.ts`

/browser导出的API类型定义，提供基于WebSocket的浏览器环境查询能力

- `OAuthCredential` (type) - OAuth认证凭证类型，含type='oauth'和token字段
- `WebSocketOptions` (type) - WebSocket连接配置，含url、headers、authMessage
- `BrowserQueryOptions` (type) - 浏览器查询选项，含prompt、websocket、abortController、canUseTool、hooks、mcpServers、jsonSchema、onElicitation
- `query` (function) - 主查询函数，接收BrowserQueryOptions，返回Query类型的AsyncIterable<SDKMessage>

### `sdk-tools.d.ts`

Claude CLI内置工具的JSON Schema类型定义，用于工具输入输出的类型安全验证

- `ToolInputSchemas` (type) - 所有内置工具输入类型的联合类型，包括Agent、Bash、TaskOutput、FileEdit、FileRead、FileWrite、Glob、Grep、TaskStop、Mcp、NotebookEdit、TodoWrite、WebFetch、WebSearch、AskUserQuestion、Worktree等
- `ToolOutputSchemas` (type) - 所有内置工具输出类型的联合类型，与ToolInputSchemas对应
- `AgentInput/AgentOutput` (type) - Agent工具的输入输出类型，输出含completed状态下的token使用统计和toolStats，以及async_launched状态的异步Agent信息

### `manifest.json`

构建清单，记录各平台二进制的未压缩分发信息，包含二进制名、checksum和文件大小

- `version` (field) - SDK版本号2.1.137
- `commit` (field) - Git commit hash
- `platforms` (mapping) - 平台映射，含darwin-arm64/x64、linux-arm64/x64(含musl变体)、win32-x64/arm64，每项含binary名、checksum、size

### `manifest.zst.json`

构建清单，记录各平台二进制的Zstandard压缩分发信息，比manifest.json多一层bundle字段

- `binary` (field) - 压缩后的二进制文件名，含.zst后缀
- `bundle` (nested) - 打包层信息(含checksum和size)，仅macOS包含此字段

### `LICENSE.md`

法律许可文件，指向Claude Code法律协议页面

### `README.md`

包的使用文档，包含安装指南、迁移说明、反馈渠道和数据收集声明

## 关键概念

- **多导出条件导出**：package.json通过exports字段实现条件导出，主SDK(browser/mjs)、桥接层(bridge.mjs)、助手(assistant.mjs)、浏览器SDK(browser-sdk.js)、工具类型(sdk-tools.d.ts)各有独立入口，支持按需导入和tree-shaking
- **Flat Package类型布局**：各子路径的.d.ts文件统一从agentSdkTypes.js导入类型，编译脚本(build-ant-sdk-typings.sh)统一重写导入路径为./sdk，实现类型定义的扁平化，避免深度import graph
- **Bridge Session Handle**：BridgeSessionHandle封装JWT认证和SSE流管理，实例作用域隔离(非进程级env var)，支持sequenceNum持久化用于reconnect后恢复流、refreshAuth在JWT过期时刷新transport
- **Assistant Worker**：runAssistantWorker启动后台worker进程，支持沙箱模式、定时任务调度(cron-horizon)、通过bridge与Claude.ai通信，状态通过WorkerStateAdapter持久化
- **Browser WebSocket Transport**：browser-sdk提供纯WebSocket传输方式(query函数)，支持OAuth认证、WebSocket headers、canUseTool回调、hook系统、MCP服务器注入
- **平台二进制分发**：通过optionalDependencies提供8个平台变体的二进制(claude/claude.exe)，manifest记录checksum和size，zst版本使用Zstandard压缩算法进一步减小分发大小
- **Tool Schema类型安全**：sdk-tools.d.ts为每个CLI内置工具定义输入输出JSON Schema类型，通过json-schema-to-typescript自动生成，供SDK用户在TypeScript中类型安全地使用Claude Code内置工具
- **MCP集成**：SDK依赖@modelcontextprotocol/sdk，同时在browser-sdk和assistant中都支持MCP服务器配置，实现Model Context Protocol的客户端能力

## 内部关系

- `agentSdkTypes.d.ts` -> `sdk.d.ts`：agentSdkTypes.d.ts重新导出sdk.d.ts的全部类型，作为flat package的中间层类型定义
- `assistant.d.ts` -> `agentSdkTypes.d.ts`：assistant.d.ts从agentSdkTypes.js导入核心类型(InboundPrompt、Options、CanUseTool等)，保持导入路径单一便于编译时重写
- `bridge.d.ts` -> `agentSdkTypes.d.ts`：bridge.d.ts从agentSdkTypes.js导入SDKControlRequest、SDKControlResponse等类型
- `browser-sdk.d.ts` -> `agentSdkTypes.d.ts`：browser-sdk.d.ts从agentSdkTypes.js导入Query、SDKMessage、CanUseTool、McpServerConfig等类型
