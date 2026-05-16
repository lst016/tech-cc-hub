# shared

> 提供 Electron 工作台中共用的数据类型定义、业务逻辑工具函数和工作流解析能力

shared 模块是桌面 Agent 工作台的核心共享层，聚合了活动时间线建模、附件处理、工作流解析、模型路由选择、计划进度标准化等跨模块复用的工具函数和数据类型。这些组件被聊天会话、任务执行、浏览器预览、模型路由等模块共同依赖。

## 文件

### `src/shared/activity-rail-model.ts`

活动时间线数据模型定义和 UI 渲染工具函数，包括节点类型、层级、音调、指标格式化和详情构建

- `ActivityTimelineItem` (type) - 时间线条目核心类型，包含 filterKey、layer、tone、nodeKind 等渲染属性
- `ActivityExecutionMetrics` (type) - 执行指标：输入/上下文/输出字符数、token 数、耗时、成功/失败计数
- `ActivityDetailSection` (type) - 详情区域的数据结构，支持 rows 和可选 raw 原始数据
- `formatHookEventLabel` (function) - 格式化 hook 事件标签
- `buildHookDetailSections` (function) - 构建 hook 质量信号详情分区
- `buildToolOutputSection` (function) - 构建工具输出详情分区
- `formatDuration` (function) - 格式化时长为可读字符串
- `formatCost` (function) - 格式化成本显示

### `src/shared/attachments.ts`

处理图片和文本附件的存储、预览和 prompt 字符估算，支持 data URL 和文件路径解析

- `AttachmentLike` (type) - 附件数据结构，支持 kind、data、mimeType、preview、size 等字段
- `estimateAttachmentPromptChars` (function) - 估算附件在 prompt 中的字符占用，包含图像 runtimeData 编码估算和文本摘要估算
- `resolveImageAttachmentSrc` (function) - 从 preview/runtimeData/data/storageUri 候选中解析图片实际来源
- `buildAnthropicPromptContentBlocks` (function) - 构建 Anthropic API 格式的内容块数组
- `stripDataUrlPrefix` (function) - 剥离 data URL 前缀获取纯 base64 数据

### `src/shared/lark-runtime-defaults.ts`

管理 Lark/飞书 CLI 运行时的默认配置和环境变量注入逻辑

- `LARK_CLI_SKILL_ENV_KEYS` (constant) - Lark CLI 环境变量键名数组
- `DEFAULT_LARK_CHANNEL_CONFIG` (constant) - 默认 Lark channel 配置对象，包含 provider、transport、cliCommand 等
- `ensureLarkCliRuntimeDefaults` (function) - 校验并补充运行时默认配置，确保 channels.items.lark 配置完整

### `src/shared/prompt-ledger.ts`

追踪 prompt 来源、估算 token 占用、提取历史消息内容用于优化和审计

- `PromptLedgerBucket` (type) - prompt 来源桶：包含 id、label、sourceKind、chars、tokenEstimate、ratio、sample
- `PromptLedgerSegment` (type) - prompt 段落：细粒度追踪，含 segmentKind、risks、optimizationHint
- `estimatePromptLedgerTokens` (function) - 估算字符对应的 token 数量，支持 CJK/空格差异计数
- `buildPromptLedgerMessage` (function) - 从多个来源构建完整的 prompt ledger 消息
- `extractAssistantText` (function) - 从 assistant 消息中提取文本内容
- `extractToolResults` (function) - 提取工具执行结果

### `src/shared/workflow-markdown.ts`

解析和验证工作流 markdown 文档，构建工作流规格和会话状态

- `WorkflowSpecDocument` (type) - 工作流规格文档，包含 workflowId、name、scope、steps、sections(goal/rules/inputs/outputs)
- `WorkflowStepSpec` (type) - 工作流步骤规格：id、title、executor、intent、doneWhen、dependsOn、toolsHint
- `SessionWorkflowState` (type) - 会话级工作流状态：currentStepId、status、steps 数组及各自状态
- `parseWorkflowMarkdown` (function) - 解析 markdown 文档并提取 frontmatter 和 body sections
- `createInitialSessionWorkflowState` (function) - 从文档创建初始会话工作流状态

### `src/shared/workflow-selector.ts`

根据 prompt、上下文路径和标签匹配工作流文档，计算候选评分并支持自动绑定

- `WorkflowSelectionContext` (type) - 选择上下文：prompt、cwd、activePaths、tags、strictPathFiltering
- `WorkflowSelectionResult` (type) - 选择结果：candidates 数组、recommendedWorkflowId、autoSelectedWorkflowId
- `selectWorkflowCandidates` (function) - 核心入口，对文档列表评分排序并决定是否自动选择
- `scoreWorkflowDocument` (function) - 对单个文档评分，考虑 triggers、tags、paths 匹配和 exclude 过滤

### `src/shared/codex-oauth.ts`

处理 Codex OAuth 模型的 ID 规范化和后缀管理，支持 compact 模型变体

- `CODEX_BASE_MODELS` (constant) - 基础 Codex 模型 ID 列表
- `CODEX_OAUTH_MODELS` (constant) - 合并后的完整 Codex 模型列表
- `withCodexCompactModelSuffix` (function) - 为模型列表添加 -openai-compact 后缀变体
- `mergeCodexModelIds` (function) - 合并缓存模型和 fallback 模型，去重排序

### `src/shared/plan-progress.ts`

标准化来自 update_plan 和 todo_write 工具的输出，构建会话计划快照

- `SessionPlanSnapshot` (type) - 会话计划快照：包含 sessionId、plan 步骤数组、source、updatedAt
- `normalizeUpdatePlanArgs` (function) - 标准化 update_plan 工具参数
- `normalizeTodoWriteArgs` (function) - 标准化 todo_write 工具参数，支持 todos/items/plan 字段兼容

### `src/shared/preview-quick-open.ts`

对文件路径候选进行评分和过滤，用于快速打开面板的模糊匹配

- `PreviewQuickOpenEntry` (type) - 快速打开条目：name、path、relativePath、size
- `scorePreviewQuickOpenEntry` (function) - 对单个条目评分，考虑路径和名称中的 token 匹配度
- `filterPreviewQuickOpenEntries` (function) - 过滤并返回排序后的条目列表，限制数量为 limit

### `src/shared/model-provider-routing.ts`

根据 API provider 模式决定模型兼容性，辅助模型选择

- `SharedApiProviderMode` (type) - provider 模式：custom、deepseek、codex
- `isCodexModelName` (function) - 判断模型名是否为 Codex 系列（gpt-5.* 或包含 codex）
- `pickProviderCompatibleModel` (function) - 从 primary/fallback 模型中选择与 provider 兼容的第一个

### `src/shared/slash-commands.ts`

从消息中提取斜杠命令并合并去重

- `extractSlashCommandsFromMessages` (function) - 遍历消息列表，提取 type=system subtype=init 中的 slash_commands
- `mergeSlashCommandLists` (function) - 合并多个命令列表并按小写 key 去重

### `src/shared/channel-config.ts`

检查 channel 聊天功能是否启用

- `isChannelChatEnabled` (function) - 判断 ChannelChatToggleConfig 是否允许聊天

### `src/shared/lark-channel.ts`

占位空文件，原 lark-cli IM 功能已移除

## 关键概念

- **ActivityTimelineItem**: 活动时间线的核心数据单元，每个条目关联 filterKey（用于过滤视图）、layer（上下文/工具/结果/流程层级）、tone（neutral/info/success/warning/error 音调）、nodeKind（工具输入/retrieval/browser 等节点类型）和 detail（详情展示内容）
- **PromptLedger**: 追踪完整 prompt 构建过程的数据结构，将 prompt 来源分为 system、project、skill、workflow、current、attachment、memory、history、tool 等 Bucket，每个 Bucket 包含 chars/tokenEstimate/ratio/sample，用于分析和优化 token 消耗
- **WorkflowSpecDocument**: 工作流的规格文档格式，基于 markdown + frontmatter，包含 workflowId、steps（每步有 executor/intent/doneWhen/dependsOn）、sections（goal/rules/inputs/outputs），支持系统/用户/项目/会话级别的 scope
- **Workflow auto-bind**: workflow-selector 根据 prompt 匹配度、tag 命中、路径命中计算评分，当显式信号充足且 scoreGap >= 10 时自动绑定工作流到当前会话
- **Codex compact model suffix**: OpenAI Codex 支持 -openai-compact 后缀变体，codex-oauth.ts 提供 normalize 和 merge 功能确保模型列表包含所有变体
- **Plan normalization**: 统一处理 update_plan 和 todo_write 工具的不同输出格式（字段名不同：step/content/text、status 的 inProgress/complete 等变体），提取 PlanItemArg 构建 SessionPlanSnapshot

## 内部关系

- `src/shared/activity-rail-model.ts` → `src/shared/prompt-ledger.ts`: ActivityTimelineItem 等类型使用 PromptLedgerMessage 作为消息类型之一
- `src/shared/workflow-selector.ts` → `src/shared/workflow-markdown.ts`: workflow-selector 导入 WorkflowSpecDocument 和 WorkflowScope 类型进行候选评分
- `src/shared/model-provider-routing.ts` → `src/shared/codex-oauth.ts`: model-provider-routing 导入 CODEX_OAUTH_COMPACT_MODEL_SUFFIX 用于 suffix 剥离
