# electron-runtime

> Electron主进程模块，负责窗口管理、IPC通信、MCP协议集成、Agent任务执行和插件系统协调。

这是应用程序的Electron主进程入口，负责管理BrowserWindow生命周期、注册IPC处理器、连接MCP服务器、处理插件授权（如Figma、Open Computer Use）、执行Claude Agent任务（通过runner模块）、管理会话、自动化任务调度、文件预览操作等核心桌面功能。它整合了配置存储、图像预处理、系统工作区、外部CLI命令、Git工作台、知识库和技能管理器等多个子系统，为渲染进程提供统一的后台服务。

## 文件

### `src/electron/main.ts`

Electron主进程入口文件，初始化BrowserWindow、注册所有IPC处理器、启动后台服务和插件管理器

- `ipcMain.handle listeners` (function) - 注册preview-list-directory、sessions:list、plugins:*、shell:openExternal等30+个IPC通道处理文件操作、插件管理、会话列表等功能
- `prepareOpenComputerUsePermissions` (function) - 准备Open Computer Use插件所需的系统权限
- `installOpenComputerUsePlugin` (function) - 安装Open Computer Use插件
- `getOpenComputerUsePluginStatus` (function) - 获取Open Computer Use插件安装状态和版本
- `checkOpenComputerUsePluginUpdate` (function) - 检查Open Computer Use插件更新
- `updateOpenComputerUsePlugin` (function) - 更新Open Computer Use插件
- `connectOpenComputerUsePlugin` (function) - 连接Open Computer Use MCP服务器
- `getFigmaOfficialPluginStatus` (function) - 获取Figma官方插件状态（OAuth、PAT、Desktop模式）
- `installFigmaOfficialPlugin` (function) - 安装Figma官方插件
- `connectFigmaDesktopOfficialPlugin` (function) - 通过Desktop MCP连接Figma
- `connectFigmaPatOfficialPlugin` (function) - 通过Personal Access Token连接Figma
- `fetchFigmaPatProfile` (function) - 获取Figma PAT对应的用户资料
- `parseJsonResponse` (function) - 解析JSON响应并处理错误详情
- `getOpenComputerUseVersion` (function) - 获取当前安装的Open Computer Use版本号
- `getOpenComputerUseLatestVersion` (function) - 获取Open Computer Use最新版本
- `getCodexCommand` (function) - 获取Codex CLI命令路径
- `getCodexMcpCredentialsPath` (function) - 获取Codex MCP凭证文件路径

### `src/electron/libs/runner.ts`

Agent任务执行的核心模块，调用Claude Agent SDK运行任务、管理工具集、处理MCP服务器集成

- `runClaude` (function) - 核心执行函数，调用Claude Agent SDK执行任务，整合工具、MCP服务器、提示词构建、权限处理和结果处理
- `getRequestedModelName` (function) - 从运行时配置中提取请求的模型名称
- `resolveOutputFormat` (function) - 解析输出格式（plaintext、json等）
- `maybeRunFigmaGuideOAuth` (function) - 检查并引导用户完成Figma OAuth授权流程
- `isFigmaMcpServerStatus` (function) - 检查Figma MCP服务器状态
- `buildEffectiveAllowedToolSet` (function) - 构建最终允许使用的工具集，过滤内置和外部MCP工具
- `parseAllowedTools` (function) - 解析allowedTools字符串配置
- `combineSystemPromptAppend` (function) - 组合系统提示词追加内容
- `supportsClaudeCodeAutoTruncate` (function) - 判断是否支持Claude Code自动截断功能
- `getClaudeCodeExtraArgs` (function) - 获取Claude Code额外参数
- `persistDiscoveredRuntimeConfig` (function) - 持久化发现的运行时配置
- `getBestMatchedSkillName` (function) - 根据任务找到最佳匹配技能名称
- `getSkillEnvCandidates` (function) - 获取技能环境候选变量
- `buildGlobalRuntimePromptAppend` (function) - 构建全局运行时提示词追加内容
- `getNormalizedSkillName` (function) - 规范化技能名称
- `normalizeSkillCredentialKey` (function) - 规范化技能凭证键名

### `src/electron/libs/runner-reuse.ts`

Runner复用逻辑模块，通过生成和比对复用键来确定是否可复用现有runner实例以提升效率

- `buildRunnerReuseKey` (function) - 根据输入参数构建runner复用键，包含cwd、model、allowedTools、runSurface等关键字段
- `canReuseRunner` (function) - 判断现有runner是否可复用于新请求，比较所有关键参数
- `buildRunnerReuseDescriptor` (function) - 构建runner复用描述符，包含运行时效率配置文件和内置MCP服务器列表
- `normalizeKeyPart` (function) - 规范化键值部分，处理空值和空白字符
- `parseRunnerReuseKey` (function) - 解析复用键为描述符对象
- `isBuiltinMcpServerName` (function) - 判断是否为内置MCP服务器名称

### `src/electron/libs/runner-error.ts`

错误处理和规范化模块，将底层错误转换为用户友好的中文错误消息

- `stringifyRunnerError` (function) - 将任意错误对象转换为字符串，处理Error类型、cause链和JSON序列化
- `normalizeRunnerError` (function) - 规范化错误消息，特别处理模型不可用（404、not found）和Figma认证错误，返回中文提示
- `buildFigmaAuthGuidance` (function) - 根据当前Figma配置模式（REST/PAT或OAuth）生成相应的重新授权指导信息
- `isLikelyFigmaAuthError` (function) - 检测错误消息是否包含Figma认证相关的问题

### `src/shared/runner-status.ts`

共享的状态判断工具模块，用于判断runner执行结果是否成功

- `isSuccessfulRunnerResult` (function) - 判断消息是否为成功的runner结果（type=result且subtype=success）
- `shouldSuppressRunnerErrorAfterSuccessfulResult` (function) - 判断在已发送成功结果后是否应抑制后续错误

### `src/shared/runner-prompt.ts`

共享的提示词构建模块，负责将prompt和附件转换为Agent SDK所需的格式

- `buildRunnerPromptContentBlocks` (function) - 构建runner提示词内容块，整合用户prompt和附件，返回Anthropic格式的内容数组

### `test/electron/runner-attachments.test.ts`

测试runner提示词和附件处理逻辑

- `attachmentPriorityContext` (const) - 测试用的附件优先级上下文文本
- `promptAfterAttachments` (function) - 测试辅助函数，用于生成带附件的提示词文本
- `contentBlocks` (variable) - 测试验证构建的内容块格式正确性

### `test/electron/runner-claude-code-plugins.test.ts`

测试Claude Code插件集成功能

- `source` (variable) - 读取runner.ts源码用于字符串匹配测试，验证插件集成、auto-truncate和技能启用逻辑

### `test/electron/runner-error.test.ts`

测试错误规范化功能

- `message` (variable) - 测试变量，验证normalizeRunnerError对模型缺失、Figma认证等错误的处理

### `test/electron/runner-status.test.ts`

测试runner状态判断逻辑

## 关键概念

- **MCP (Model Context Protocol)**: Model Context Protocol协议，用于与MCP服务器（如Figma、浏览器工具）通信的标准接口，sdk/client提供Client、StreamableHTTPClientTransport等组件
- **Runner复用机制**: 通过buildRunnerReuseKey生成唯一键，比对cwd、model、allowedTools、runSurface等参数，判断是否可复用已有runner进程，避免重复启动提升效率
- **插件系统**: 支持Open Computer Use、Figma官方插件等多种插件的安装、更新、授权和连接，通过IPC通道与渲染进程交互
- **Figma认证模式**: 支持三种Figma连接模式：Desktop MCP模式、OAuth官方授权模式、PAT（Personal Access Token）本地Token模式，各有不同配置流程
- **Agent执行表面**: 通过runSurface区分执行场景（development、production等），影响运行时效率配置、可用工具集和系统提示词
- **运行时效率配置**: 根据prompt长度、附件数量、runSurface等动态选择builtinMcpServers配置，优化执行性能和资源使用
- **学习钩子**: 通过createLearnCaptureHook、createSecretScanHook等钩子在Agent执行过程中注入质量检查和审计能力
- **图像预处理**: 通过image-preprocessor模块对附件图像进行摘要处理，支持base64和本地文件两种方式

## 内部关系

- `src/electron/main.ts` → `src/electron/libs/runner.ts`: main.ts导入runner.ts中导出的函数，在IPC处理器中调用runClaude等方法执行Agent任务
- `src/electron/main.ts` → `src/electron/libs/runner-reuse.ts`: 通过runner-reuse.ts判断是否可复用现有runner实例，优化执行效率
- `src/electron/libs/runner.ts` → `src/electron/libs/runner-error.ts`: runner.ts导入runner-error.ts中的normalizeRunnerError函数处理执行过程中的错误
- `src/electron/libs/runner.ts` → `src/shared/runner-prompt.ts`: runner.ts使用shared/runner-prompt.ts中的buildRunnerPromptContentBlocks构建提示词
- `src/electron/libs/runner.ts` → `src/shared/runner-status.ts`: runner.ts使用runner-status.ts判断执行结果是否成功
- `src/electron/libs/runner-reuse.ts` → `src/electron/libs/runner-error.ts`: runner-reuse.ts不直接使用，但与runner.ts共享对错误处理模块的依赖
- `src/shared/runner-prompt.ts` → `src/shared/attachments.js`: runner-prompt.ts导入attachments.js的buildAnthropicPromptContentBlocks函数处理附件
- `src/electron/main.ts` → `src/electron/libs/claude-settings.js`: main.ts使用config-store和claude-settings管理API配置和运行时环境
- `src/electron/main.ts` → `src/electron/libs/mcp-tools/browser.js`: 通过browser.ts设置浏览器工具主机
- `src/electron/main.ts` → `src/electron/libs/mcp-tools/design.js`: 通过design.ts设置设计工具主机
- `src/electron/main.ts` → `src/electron/libs/auto-updater.js`: 集成自动更新功能
- `src/electron/main.ts` → `src/electron/ipc-handlers.js`: main.ts导入ipc-handlers.ts中的会话管理和任务执行相关函数
