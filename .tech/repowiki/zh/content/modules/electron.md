# electron

> Electron主进程模块，提供桌面应用核心功能包括AI Agent执行、数据库管理、渠道集成和自动更新

这是tech-cc-hub桌面应用的主进程模块，运行在Electron主进程中。它负责管理AI Agent执行引擎、SQLite数据库操作（skills、memories、learnings）、外部渠道集成（Telegram、飞书、钉钉等）、自动更新、Claude Code插件管理以及进程间通信。模块采用分层架构，libs目录下包含各类子系统的具体实现，通过IPC handlers与渲染进程交互。

## 文件

### `src/electron/libs/skill-manager/db.ts`

Skill和Scenario的SQLite数据库管理，使用better-sqlite3实现CRUD操作和迁移

- `getDb` (function) - 获取或创建SQLite数据库单例，确保WAL模式和外键启用
- `migrate` (function) - 执行数据库迁移，创建skills、scenarios、scenario_skills、skill_targets、skill_tags、settings等表及索引
- `getAllSkills` (function) - 获取所有技能记录，按名称排序
- `insertSkill` (function) - 插入新技能记录
- `updateSkillAfterInstall` (function) - 技能安装后更新状态和元数据
- `getAllScenarios` (function) - 获取所有场景配置
- `addSkillToScenario` (function) - 将技能添加到场景
- `reorderScenarios` (function) - 重新排序场景列表

### `src/electron/libs/skill-manager/index.ts`

skill-manager模块的统一导出入口，重导出所有子模块的公开API

- `模块导出` (export) - 从db.js导出数据库操作、从central-repo.js导出中央仓库、从tool-adapters.js导出工具适配器、从sync-engine.js导出同步引擎、从installer.js导出安装器、从scanner.js导出扫描器、从scenarios.js导出场景管理、从marketplace.js导出市场API

### `src/electron/libs/memory/memory-repository.ts`

记忆/笔记的SQLite仓库，提供全文搜索支持（FTS5）

- `MemoryRepository` (class) - 记忆仓储类，管理memories表和memories_fts虚拟表
- `create` (method) - 创建新记忆条目，同时写入主表和FTS表
- `upsertByTitle` (method) - 按标题存在性判断插入或更新
- `search` (method) - 使用FTS5全文搜索记忆内容
- `serializeTags` (function) - 序列化标签数组为逗号分隔字符串
- `compact` (function) - 截断文本到指定长度并添加省略号

### `src/electron/libs/learning-store.ts`

学习纠正数据的SQLite存储，自动记录Agent的规则学习

- `LearningStore` (class) - 学习存储类，管理learnings表和learnings_sessions会话表
- `addLearning` (method) - 添加新的学习记录（规则、错误、纠正）
- `getRecentLearnings` (method) - 获取最近的学习记录，支持按项目过滤
- `getApplicableLearnings` (method) - 根据关键词获取适用的学习规则
- `incrementTimesApplied` (method) - 增加学习规则的命中次数统计

### `src/electron/tsconfig.json`

TypeScript编译配置，针对Electron主进程

- `compilerOptions` (config) - 配置strict模式、ESNext目标、NodeNext模块系统，输出到dist-electron目录

### `src/electron/dev-backend-bridge.ts`

开发模式下的HTTP桥接服务，允许渲染进程调用主进程处理函数和订阅事件

- `startDevBackendBridge` (function) - 启动HTTP服务器，监听JSON-RPC式请求并返回结果，同时支持SSE事件推送
- `pushSseEvent` (function) - 向所有连接的SSE客户端推送事件
- `DEV_BACKEND_BRIDGE_PORT` (constant) - 桥接服务默认端口4317

### `src/electron/ipc-handlers.ts`

Electron IPC处理器注册，管理会话、运行器、任务执行和渠道通信

- `initializeSessionRepository` (function) - 初始化会话仓储
- `initializeTaskExecutor` (function) - 初始化任务执行器，支持Lark、钉钉、飞书项目等任务源
- `listStoredSessionsForRenderer` (function) - 列出存储的会话供渲染进程使用
- `getReusableRunnerHandle` (function) - 获取可复用的Agent运行器句柄
- `scheduleWarmRunnerCleanup` (function) - 调度闲置运行器的清理任务
- `broadcast` (function) - 向所有监听器广播服务器事件

### `src/electron/libs/agent-resolver.ts`

解析Agent运行时上下文，发现和选择Agent配置文件/Profile

- `resolveAgentRuntimeContext` (function) - 核心函数，根据cwd、surface和agentId解析完整的运行时上下文，包括选中的profile、提示词来源、技能列表和允许的工具
- `discoverAgentProfiles` (function) - 扫描文件系统发现用户和项目级别的Agent profiles
- `BUILT_IN_SYSTEM_PROFILES` (constant) - 内置的系统维护Agent配置
- `mergeAllowedTools` (function) - 合并多个profile的allowedTools配置

### `src/electron/libs/auto-updater-fallback.ts`

GitHub Releases更新元数据解析和版本比较的备用逻辑

- `compareAppVersions` (function) - 语义化版本比较，支持v前缀和构建后缀
- `getPlatformUpdateMetadataCandidates` (function) - 根据平台和架构返回可能的更新元数据文件名列表
- `summarizeGitHubReleaseForUpdates` (function) - 从GitHub Release提取更新信息，查找对应的平台元数据文件
- `createReleaseUpdatePlan` (function) - 构建更新计划，选择最佳候选版本

### `src/electron/libs/auto-updater.ts`

基于electron-updater的应用自动更新管理

- `AppAutoUpdater` (class) - 自动更新器类，管理更新检查、下载和安装流程
- `checkForUpdates` (method) - 检查更新并返回结果状态
- `downloadUpdate` (method) - 下载可用更新
- `installUpdate` (method) - 安装已下载的更新并重启应用
- `AppUpdateStatus` (type) - 更新状态类型，包含status、progress、error等字段

### `src/electron/libs/channel-bridge.ts`

外部聊天渠道（Telegram、Webhook等）的消息桥接和分发

- `startChannelBridge` (function) - 启动渠道桥接服务，根据配置选择Telegram轮询、Webhook或其他方式
- `startHermesWeixinInboundBridge` (function) - 启动微信渠道桥接（通过Hermes代理）
- `pollTelegram` (function) - 轮询Telegram Bot API获取新消息
- `extractTelegramMessage` (function) - 解析Telegram更新中的消息内容

### `src/electron/libs/channel-workspace.ts`

渠道会话工作区管理，为每个渠道对话创建独立的文件系统工作区

- `ensureChannelWorkspace` (function) - 确保渠道工作区存在，创建目录结构和README
- `recordChannelInboundMessage` (function) - 记录入站消息到messages.jsonl日志文件
- `buildChannelReplyTarget` (function) - 构建回复目标对象，包含provider、conversationId和workspaceRoot
- `sanitizePathSegment` (function) - 清理路径片段，防止路径注入和特殊字符问题

### `src/electron/libs/claude-code-plugins.ts`

Claude Code SDK插件集成和MCP服务器名称解析

- `resolveEnabledClaudeCodeSdkPlugins` (function) - 读取installed_plugins.json和enabledPlugins配置，返回启用的SDK插件列表
- `listClaudeCodePluginMcpServerNames` (function) - 从插件的.mcp.json读取关联的MCP服务器名称
- `isClaudeCodePluginMcpTool` (function) - 判断工具名是否属于Claude Code插件MCP服务器

### `src/electron/libs/claude-project-memory.ts`

Claude项目记忆目录管理，支持加载项目级别的memory.md等文档

- `toClaudeProjectSlug` (function) - 将工作目录路径转换为Claude项目slug格式，处理Windows驱动器路径
- `loadClaudeProjectMemory` (function) - 加载项目memory目录下的所有.md文件，有字数限制
- `buildClaudeProjectMemoryPromptAppend` (function) - 构建追加到系统提示的记忆内容字符串
- `MEMORY_DIR_NAME` (constant) - 记忆目录名称常量'memory'

## 关键概念

- **Electron IPC通信**: 主进程通过ipcMain.handle注册处理器，渲染进程通过preload暴露的API调用。ipc-handlers.ts是主入口，管理会话、任务、Agent执行等核心IPC通道。
- **SQLite数据库分层**: 使用better-sqlite3进行同步操作。db.ts管理skill-manager数据库，memory-repository.ts管理记忆数据库，learning-store.ts管理学习数据库，session-store.ts管理会话数据。
- **Agent Profile解析**: agent-resolver.ts发现并加载.user/claude、.claude等目录下的Agent配置文件，支持system/user/project三种作用域，通过mergeAllowedTools合并工具权限。
- **渠道工作区**: channel-workspace.ts为每个外部渠道对话（飞书、钉钉、Telegram等）创建独立工作区，作为cwd供Agent使用，实现渠道消息与会话绑定。
- **Runner复用**: libs/runner-reuse.js实现Agent运行器的复用机制，根据cwd、agentId等key缓存RunnerHandle，减少进程启动开销。
- **Dev桥接**: dev-backend-bridge.ts在开发模式下启动HTTP服务器，提供JSON-RPC式调用和SSE事件推送，模拟主进程功能供开发调试使用。
- **Skill与Scenario管理**: skill-manager系统管理AI技能包，支持将多个技能组合成Scenario场景，通过central-repo和tool-adapters实现技能安装和同步。
- **任务执行框架**: TaskExecutor支持多种任务源（Lark、钉钉、飞书项目），通过TaskProvider接口抽象，ipc-handlers.ts初始化并注册提供者。
- **自动更新**: auto-updater.ts基于electron-updater实现，检查GitHub Releases并下载更新，auto-updater-fallback.ts处理缺少平台元数据文件时的备用方案。
- **Claude Code插件集成**: claude-code-plugins.ts读取Claude Code的插件配置，解析MCP服务器名称，允许应用使用Claude Code生态的插件能力。

## 内部关系

- `ipc-handlers.ts` → `libs/runner.js`: 导入runClaude和RunnerHandle类型用于Agent执行
- `ipc-handlers.ts` → `libs/agent-resolver.js`: 导入resolveAgentRuntimeContext解析Agent上下文
- `ipc-handlers.ts` → `libs/session-store.js`: 导入SessionStore管理会话持久化
- `ipc-handlers.ts` → `libs/task/index.js`: 导入TaskExecutor和多种TaskProvider实现任务管理
- `ipc-handlers.ts` → `libs/note-repository.js`: 导入NoteRepository管理笔记
- `ipc-handlers.ts` → `libs/channel-workspace.js`: 导入渠道工作区管理函数处理消息
- `libs/agent-resolver.ts` → `libs/system-prompt-presets.js`: 导入系统提示预设源
- `libs/agent-resolver.ts` → `../../shared/prompt-ledger.js`: 导入PromptLedgerSource类型
- `libs/auto-updater.ts` → `libs/auto-updater-fallback.js`: 导入版本比较和发布摘要函数
- `libs/channel-bridge.ts` → `libs/claude-settings.js`: 导入全局运行时环境配置
- `libs/channel-bridge.ts` → `libs/external-cli.js`: 导入runExternalCli执行外部命令
- `libs/channel-bridge.ts` → `libs/channel-workspace.js`: 导入渠道工作区相关类型和函数
- `dev-backend-bridge.ts` → `node:http`: 使用原生HTTP模块创建开发桥接服务器
- `libs/skill-manager/db.ts` → `libs/skill-manager/types.js`: 导入SkillRecord、ScenarioRecord等类型定义
- `libs/memory/memory-repository.ts` → `libs/memory/memory-types.js`: 导入记忆相关类型定义
