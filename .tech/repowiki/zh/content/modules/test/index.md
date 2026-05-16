# test

> Electron进程测试套件，验证工作台核心功能（插件配置、模型路由、工作流引擎、外部集成）的正确性

该模块包含16个测试文件（另有44个文件被省略），使用Node.js内置test_runner验证Electron主进程和渲染进程的关键功能。测试覆盖：Figma官方插件配置构建、模型上下文压缩设置、活动轨道数据结构、无状态延续提示生成、Codex OAuth凭证处理、斜杠命令发现、外部CLI的Windows .cmd兼容层、工作流文档解析与候选筛选、反馈提交、IDEA启动器版本选择、飞书CLI运行时默认值、外部MCP服务器解析、运行时效率配置、Claude Code SDK插件解析、技能扫描器性能优化。

## 文件

### `test/electron/tsconfig.json`

TypeScript编译配置，指定测试输出到dist-test目录，包含node和项目自定义types

### `test/electron/figma-official-plugin.test.ts`

测试Figma官方插件配置构建函数，包括MCP远程/桌面配置、运行时配置合并、插件状态检测（未配置/已配置/配置错误）、OAuth回调数据脱敏、桌面模式切换

- `buildFigmaOfficialMcpConfig` (function) - 构建官方Figma MCP配置，支持Bearer token认证头
- `buildFigmaDesktopMcpConfig` (function) - 构建本地桌面MCP配置，指向127.0.0.1:3845
- `getFigmaOfficialPluginStatusFromConfig` (function) - 检测插件状态：not-configured/configured/misconfigured
- `isFigmaMcpOAuthCallbackPrompt` (function) - 检测是否是OAuth回调提示
- `redactFigmaMcpOAuthCallbackPrompt` (function) - 脱敏OAuth回调中的敏感数据

### `test/electron/model-context-settings.test.ts`

验证模型上下文压缩字段在各配置源中的存在性，包括API profiles设置、UI类型定义、配置存储、Claude设置、设置模态框等，并测试模型搜索评分和分组选项构建

- `getModelSearchScore` (function) - 计算模型搜索关键词匹配得分
- `buildGroupedModelOptions` (function) - 将模型列表按分组构建为选项数组
- `normalizeProfile` (function) - 规范化API profile配置

### `test/electron/activity-rail-model.test.ts`

测试活动轨道模型和提示账本的构建，验证提示源分离、历史消息分段、工具输入输出统计、记忆源聚合

- `buildActivityRailModel` (function) - 构建活动轨道数据模型
- `buildPromptLedgerMessage` (function) - 构建提示账本消息，分离系统预设/项目规则/技能文档等来源

### `test/electron/stateless-continuation.test.ts`

测试无状态延续模式下的提示构建，验证图片附件标记、上下文压缩（上下文窗口不足时）、最新轮次文本附件预算计算

- `buildStatelessContinuationPrompt` (function) - 在无状态模式下构建延续提示，处理压缩和附件

### `test/electron/codex-oauth-provider.test.ts`

测试Codex OAuth profile的创建和规范化、模型池兼容性检查、缓存模型ID提取与合并、OAuth凭证解析、合成流响应构建

- `createCodexOAuthProfile` (function) - 创建Codex OAuth profile，包含官方endpoint和内置模型列表
- `mergeCodexModelIds` (function) - 合并缓存模型和内置模型，去重-openai-compact后缀
- `parseCodexOAuthCredential` (function) - 解析access_token和account_id的JSON凭证

### `test/electron/slash-commands.test.ts`

测试斜杠命令的发现、缓存和合并功能，验证项目/user级别命令目录扫描、嵌套目录支持、技能命令识别、缓存克隆一致性

- `discoverSlashCommandsInRoots` (function) - 在指定根目录发现斜杠命令markdown文件
- `mergeSlashCommandLists` (function) - 合并本地发现的命令与运行时初始化命令

### `test/electron/external-cli.test.ts`

测试外部CLI执行时的Windows .cmd垫片兼容层，验证JSON参数正确传递、显式.cmd名称解析、带空格路径的正确引号包裹

- `runExternalCli` (function) - 运行外部CLI，处理Windows .cmd shim重定向

### `test/electron/workflow-markdown.test.ts`

测试工作流Markdown文档解析，验证workflow元数据（id/name/priority/tags/triggers）、步骤配置（depends_on/tools_hint/user_actions）、运行时字段拒绝、非数字优先级拒绝

- `parseWorkflowMarkdown` (function) - 解析工作流Markdown文档，返回document或errors数组

### `test/electron/workflow-selector.test.ts`

测试工作流候选筛选逻辑，验证路径和标签匹配优先、排除标签/路径过滤、autoBind自动选中

- `selectWorkflowCandidates` (function) - 根据prompt/cwd/activePaths/tags选择最合适的工作流候选

### `test/electron/feedback-submission.test.ts`

测试反馈提交功能，验证图片数据省略和附件名保留、token缺失时打开网页草稿、token存在时POST到GitHub API

- `buildFeedbackIssueDraftUrl` (function) - 构建GitHub issue草稿URL，省略base64图片数据
- `submitFeedbackIssue` (function) - 提交反馈issue，支持网页草稿或API创建

### `test/electron/idea-launcher.test.ts`

测试IntelliJ IDEA启动器选择逻辑，验证Toolbox脚本优先（存活于热更新）、版本号解析（年.主格式）、最新版本优先

- `selectBestIdeaInstallation` (function) - 选择最佳IDEA安装位置，优先Toolbox脚本
- `parseIdeaVersionFromPath` (function) - 从Windows安装路径解析IDEA版本号

### `test/electron/channel-config.test.ts`

测试通道配置和飞书CLI运行时默认值，验证chatEnabled开关、env变量设置、skill凭证env列表追加

- `isChannelChatEnabled` (function) - 判断通道的聊天功能是否启用
- `ensureLarkCliRuntimeDefaults` (function) - 确保飞书CLI运行时默认值，不覆盖用户已有选择

### `test/electron/external-mcp-servers.test.ts`

测试外部MCP服务器解析，验证stdio/http双模式解析、CLAUDE_PROJECT_DIR注入、禁用/无效条目跳过、工具名格式兼容（mcp__xxx__xxx和xxx:xxx）

- `parseExternalMcpServers` (function) - 解析外部MCP服务器配置，注入项目目录环境变量
- `isConfiguredExternalMcpTool` (function) - 检查工具名是否属于已配置的外部MCP服务器

### `test/electron/runtime-efficiency.test.ts`

测试运行时效率配置选择，验证标准/视觉/自动化三种配置profile及其内置MCP服务器差异、runner复用key稳定性

- `resolveRuntimeEfficiencyProfile` (function) - 根据prompt和attachments解析运行时效率profile
- `buildRunnerReuseKey` (function) - 构建runner复用key，仅包含cwd/model，不含prompt

### `test/electron/claude-code-plugins.test.ts`

测试Claude Code SDK插件解析，验证installed_plugins.json读取、settings.json enabledPlugins过滤、.mcp.json MCP服务器提取、工具名格式验证

- `resolveEnabledClaudeCodeSdkPlugins` (function) - 解析已启用的Claude Code SDK本地插件
- `isClaudeCodePluginMcpTool` (function) - 检查工具名是否为Claude Code插件MCP工具

### `test/electron/skill-manager-scan-ui.test.ts`

测试技能管理器UI扫描行为，验证轻量级扫描（不哈希每个目录）、跳过node_modules等重量级目录、技能市场卡片不依赖远程GitHub头像、git导入IPC处理程序连接

## 关键概念

- **MCP (Model Context Protocol)**: 外部工具通过stdio或http协议接入的标准化协议，测试覆盖Figma、open-computer-use等服务器配置构建和工具名验证
- **运行时效率Profile**: 根据prompt内容和附件类型选择不同的工具表面：standard（小型基础工具）、visual（含浏览器和设计工具）、automation（含定时任务工具）
- **Prompt Ledger**: 将对话提示分解为多个bucket（当前提示/历史工具输入输出/摘要/项目规则/技能文档等）和segment，支持细粒度统计和优化
- **Workflow候选筛选**: 基于路径匹配、标签匹配、优先级、autoBind状态选择最合适的工作流，支持自动执行
- **Windows .cmd Shim**: 外部CLI在Windows上通过.cmd文件垫片执行时需要特殊处理参数转义和路径引号
- **Skill轻量级扫描**: UI侧技能发现不使用哈希而是用fingerprint:null快速标识，允许跳过node_modules等重量级目录提升性能
- **Codex OAuth模型池**: Codex OAuth支持的模型列表（含gpt-5.5/gpt-5.3-codex-spark等），与缓存模型合并时需去重和过滤-hidden模型

## 内部关系

- `figma-official-plugin.test.ts` → `src/electron/libs/figma-official-plugin.js`: 测试Figma插件配置构建逻辑
- `model-context-settings.test.ts` → `src/ui/components/settings/settings-utils.js`: 测试profile创建和规范化
- `model-context-settings.test.ts` → `src/ui/components/settings/model-routing-utils.js`: 测试模型路由状态构建
- `model-context-settings.test.ts` → `src/ui/components/ModelSelect.js`: 测试模型搜索和分组选项
- `activity-rail-model.test.ts` → `src/shared/activity-rail-model.js`: 测试活动轨道模型构建
- `activity-rail-model.test.ts` → `src/shared/prompt-ledger.js`: 测试提示账本消息构建
- `stateless-continuation.test.ts` → `src/electron/stateless-continuation.js`: 测试无状态延续提示构建
- `codex-oauth-provider.test.ts` → `src/electron/libs/codex-oauth.js`: 测试Codex OAuth凭证处理和流解析
- `codex-oauth-provider.test.ts` → `src/shared/model-provider-routing.js`: 测试模型提供商兼容性检查
- `slash-commands.test.ts` → `src/electron/libs/slash-command-discovery.js`: 测试命令发现和缓存逻辑
- `slash-commands.test.ts` → `src/shared/slash-commands.js`: 测试命令列表合并
- `external-cli.test.ts` → `src/electron/libs/external-cli.js`: 测试外部CLI执行和Windows .cmd处理
- `workflow-markdown.test.ts` → `src/shared/workflow-markdown.js`: 测试工作流文档解析
- `workflow-selector.test.ts` → `src/shared/workflow-selector.js`: 测试工作流候选筛选
- `feedback-submission.test.ts` → `src/electron/libs/feedback.js`: 测试反馈提交到GitHub
- `idea-launcher.test.ts` → `src/electron/libs/idea-launcher.js`: 测试IDEA安装选择和版本比较
- `channel-config.test.ts` → `src/shared/channel-config.js`: 测试通道聊天开关
- `channel-config.test.ts` → `src/shared/lark-runtime-defaults.js`: 测试飞书CLI运行时默认值
- `external-mcp-servers.test.ts` → `src/electron/libs/external-mcp-servers.js`: 测试外部MCP服务器解析
- `runtime-efficiency.test.ts` → `src/electron/libs/runtime-efficiency.js`: 测试运行时效率profile解析
- `runtime-efficiency.test.ts` → `src/electron/libs/runner-reuse.js`: 测试runner复用key构建
- `claude-code-plugins.test.ts` → `src/electron/libs/claude-code-plugins.js`: 测试Claude Code SDK插件解析
