# package

> Claude Agent SDK封装模块，提供与Claude Code交互的编程接口，支持Node.js和浏览器环境

Anthropic官方的Claude Agent SDK包，封装了与Claude AI交互的能力。它提供多个导出入口：主SDK用于Node.js环境，browser子模块支持WebSocket通信，bridge子模块处理会话生命周期，assistant子模块支持后台worker模式。包内包含TypeScript类型定义、CLI二进制清单和跨平台可执行文件下载信息。

## 文件

### `package/package.json`

npm包配置，定义模块入口、依赖、版本和平台特定可选依赖

- `exports` (field) - 定义5个导出入口：主入口(browser/bridge/assistant/sdk-tools)

### `package/sdk.d.ts`

主SDK入口的类型声明文件(re-export from agentSdkTypes)

### `package/sdk-tools.d.ts`

定义Claude CLI工具的输入输出Schema类型

- `ToolInputSchemas` (type_alias) - 所有工具输入的联合类型，包含AgentInput/BashInput/FileReadInput等17种工具
- `ToolOutputSchemas` (type_alias) - 所有工具输出的联合类型
- `AgentOutput` (type_alias) - agent命令的返回结果，区分completed和async_launched两种状态
- `FileReadOutput` (type_alias) - 文件读取的工具输出结果

### `package/assistant.d.ts`

后台worker模式SDK的类型定义，用于在独立进程中运行Claude查询

- `WorkerState` (type) - worker持久化状态，包含claudeSessionId和lastSSESequenceNum
- `WorkerStateAdapter` (interface) - 状态加载/保存适配器接口
- `AssistantWorkerOptions` (type) - 配置worker运行选项，包含bridge连接、sandbox模式、cron调度等
- `AssistantWorkerHandle` (type) - 返回给调用者的worker操作句柄
- `buildQueryOptions` (function) - 构建查询选项的工具函数

### `package/bridge.d.ts`

桥接会话SDK的类型定义，处理与Claude.ai的实时通信

- `SessionState` (type) - 会话状态枚举：idle/running/requires_action
- `BridgeSessionHandle` (type) - 会话句柄，包含SSE序列号追踪、消息写入、权限请求转发等方法
- `AttachBridgeSessionOptions` (type) - 附加会话的选项配置
- `RemoteCredentials` (type) - 远程认证凭证

### `package/browser-sdk.d.ts`

浏览器环境SDK的类型定义，通过WebSocket与Claude通信

- `BrowserQueryOptions` (type) - 浏览器查询配置，包含prompt流、WebSocket选项、MCP服务器等
- `query` (function) - 创建WebSocket查询的主入口函数，返回Query异步迭代器
- `OAuthCredential` (type) - OAuth认证凭证类型

### `package/agentSdkTypes.d.ts`

类型导出聚合文件，统一从sdk.js重导出所有公共类型

### `package/manifest.json`

二进制文件清单，包含8个平台的claude可执行文件校验信息和文件大小

### `package/manifest.zst.json`

Zstandard压缩格式的二进制清单，包含压缩后大小和bundle信息

### `package/README.md`

SDK使用文档和迁移指南链接

### `package/LICENSE.md`

版权声明文件

## 关键概念

- **多出口导出架构**: package.json定义5个导出入口(./ ./browser ./bridge ./assistant ./sdk-tools)，支持不同场景的按需导入，避免加载不必要的代码
- **类型定义编译策略**: 子模块的.d.ts文件只从agentSdkTypes导入，通过脚本重写导入路径为./sdk，实现类型定义的扁平化发布
- **平台二进制分发**: 通过optionalDependencies和manifest.json实现跨平台CLI二进制按需下载，支持darwin/linux/win32的x64和arm64架构
- **WebSocket浏览器模式**: browser子模块通过WebSocket传输协议在浏览器环境中运行Claude查询，适合前端集成
- **SSE序列号追踪**: BridgeSessionHandle维护SSE事件流的sequence number，断线重连时传递initialSequenceNum实现增量恢复而非全量重放
- **Worker状态持久化**: AssistantWorker支持通过WorkerStateAdapter实现状态checkpoint，用于bridge重连和进程恢复

## 内部关系

- `package/agentSdkTypes.d.ts` → `sdk.d.ts`: agentSdkTypes.d.ts re-exports sdk.js的所有类型定义
- `assistant.d.ts/bridge.d.ts/browser-sdk.d.ts` → `agentSdkTypes.d.ts`: 子模块类型文件只从agentSdkTypes导入，通过rewrite脚本统一为./sdk导入路径
- `package.json` → `sdk-tools.d.ts`: exports字段将sdk-tools映射到sdk-tools.d.ts类型定义
