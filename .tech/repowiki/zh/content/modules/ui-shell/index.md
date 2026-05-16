# ui-shell

> Electron应用的UI外壳，整合聊天会话、任务执行、浏览器预览、模型路由等功能的React组件层

ui-shell是桌面Agent工作台的前端UI模块，提供完整的Electron渲染进程界面。该模块以App.tsx为主入口，包含会话管理(Sidebar)、消息渲染(EventCard)、活动时间轴(ActivityRail)、文件预览(AionWorkspacePreviewPane)、浏览器模拟(BrowserWorkbenchPage)、Prompt输入(PromptInput)等核心组件。模块通过IPC与主进程通信，处理流式消息渲染、进程组分组、权限请求决策、定时任务管理、Git工作台集成等功能。数据层使用Zustand store管理应用状态，支持多会话、上下文管理和资源追踪。

## 文件

### `src/ui/App.tsx`

主应用组件，负责整体布局、会话管理、消息渲染和IPC事件处理

- `SCROLL_THRESHOLD` (constant) - 滚动阈值常量，值为50
- `INITIAL_HISTORY_LIMIT` (constant) - 初始历史消息加载限制，值为400
- `HISTORY_PAGE_LIMIT` (constant) - 历史消息分页加载限制，值为200
- `isRecord` (function) - 类型守卫函数，判断值是否为普通对象
- `getMessageContentItems` (function) - 从消息中提取content数组，支持envelope.message格式
- `isProcessMessage` (function) - 判断消息是否为工具调用/结果类型
- `getProcessGroupSummary` (function) - 汇总进程组中的工具使用情况，返回工具数和标签统计
- `ProcessGroupCard` (component) - 进程组卡片组件，渲染工具调用汇总
- `CompactProcessRow` (component) - 紧凑型进程行组件，用于折叠视图
- `App` (component) - 主应用组件，整合所有UI面板和状态管理

### `src/ui/components/PromptInput.tsx`

Prompt输入框组件，支持文本输入、文件提及、slash命令、代码引用等功能

- `normalizeSlashCommandList` (function) - 规范化slash命令列表，去重并处理名称描述格式
- `hasDraggedFiles` (function) - 检测DataTransfer是否包含文件
- `buildBrowserAnnotationsPrompt` (function) - 根据浏览器标注生成prompt内容
- `mergePromptWithBrowserAnnotations` (function) - 合并prompt与浏览器标注信息
- `buildCodeReferencesPrompt` (function) - 构建代码引用prompt
- `mergePromptWithCodeReferences` (function) - 合并prompt与代码引用
- `buildMessageReferencesPrompt` (function) - 构建消息引用prompt
- `buildFileReferencesPrompt` (function) - 构建文件引用prompt
- `collectFileMentionOptions` (function) - 收集可提及的文件选项，支持目录扫描
- `buildQueuedPrompt` (function) - 构建待发送的完整prompt，包含所有引用和附件

### `src/ui/components/EventCard.tsx`

消息卡片组件，渲染AI消息、工具调用、工具结果等各类流式消息

- `toolStatusMap` (Map) - 工具ID到状态的映射表
- `setToolStatus` (function) - 设置工具执行状态
- `useToolStatus` (hook) - 订阅工具状态变化的hook
- `formatTime` (function) - 格式化时间戳为HH:mm格式
- `formatTokens` (function) - 格式化token数量显示
- `MessageCardBase` (component) - 基础消息卡片组件，处理markdown渲染和交互

### `src/ui/components/ActivityRail.tsx`

活动时间轴组件，展示会话执行过程中的上下文使用、token消耗、计划进度等分析数据

- `toneClasses` (function) - 根据活动音色返回对应CSS类名
- `getNodeKindLabel` (function) - 获取节点类型的本地化标签
- `renderTimelineWithStages` (function) - 按阶段渲染时间轴项目
- `summarizeAttachments` (function) - 汇总附件信息
- `buildMaterialStatusItems` (function) - 构建素材状态列表
- `ContextUsagePanel` (component) - 上下文使用面板，显示token分布
- `PlanProgressPanel` (component) - 计划进度面板
- `MetricsStrip` (component) - 指标条组件
- `AnalysisCard` (component) - 分析卡片组件

### `src/ui/components/BrowserWorkbenchPage.tsx`

浏览器工作台页面组件，提供本地开发服务器的预览和标注功能

- `probeLocalTarget` (function) - 探测本地浏览器目标是否在线，支持超时控制
- `LocalTargetPreview` (component) - 本地目标预览组件，显示服务器状态
- `isCurrentAppUrl` (function) - 判断URL是否为当前应用URL
- `isLoopbackHost` (function) - 判断是否为localhost相关主机
- `readRecentLocalBrowserTargets` (function) - 从localStorage读取最近使用的本地浏览器目标
- `rememberRecentLocalBrowserTarget` (function) - 保存最近使用的本地浏览器目标到localStorage
- `buildLocalBrowserTargets` (function) - 构建本地浏览器目标列表
- `BrowserWorkbenchPage` (component) - 浏览器工作台页面主组件

### `src/ui/components/AionWorkspacePreviewPane.tsx`

工作区文件预览面板，使用Monaco Editor渲染代码和markdown文件

- `getRelativePath` (function) - 计算相对路径
- `inferContentType` (function) - 推断内容类型
- `formatBytes` (function) - 格式化字节数为人类可读格式
- `configurePreviewMonacoDefaults` (function) - 配置Monaco Editor的TypeScript默认选项
- `NativeExplorer` (component) - 原生文件浏览器组件
- `QuickOpenPalette` (component) - 快速打开文件面板(Ctrl+P)
- `PreviewSurface` (component) - 文件预览表面组件
- `AionWorkspacePreviewPane` (component) - 工作区预览面板主组件

### `src/ui/components/DecisionPanel.tsx`

决策面板组件，处理AskUserQuestion工具的权限请求和用户交互

- `DecisionPanel` (component) - 决策面板主组件，渲染问题选项和输入
- `toggleOption` (function) - 切换选项选中状态
- `buildAnswers` (function) - 构建用户答案对象

### `src/ui/components/FeedbackDialog.tsx`

反馈对话框组件，允许用户提交问题反馈和截图附件

- `createAttachment` (function) - 创建附件对象
- `readFileAsDataUrl` (function) - 异步读取文件为DataURL
- `addAttachments` (function) - 添加图片附件，支持拖放和粘贴
- `FeedbackDialog` (component) - 反馈对话框主组件

### `src/ui/components/cron/ScheduledTasksPage.tsx`

定时任务管理页面，展示和操作所有定时任务

- `formatWorkspaceName` (function) - 格式化工作区名称显示
- `ScheduledTasksPage` (component) - 定时任务页面主组件，按工作区分组展示任务

### `src/ui/components/cron/CreateTaskDialog.tsx`

创建和编辑定时任务的对话框组件

- `parseCronExpr` (function) - 解析cron表达式，识别频率类型和时间设置
- `WEEKDAYS` (constant) - 星期几的中文标签数组
- `CreateTaskDialog` (component) - 创建任务对话框，支持手动/每小时/每天/工作日/每周/自定义频率

### `src/ui/pages/cron/useCronJobs.ts`

定时任务相关的React hooks，提供任务列表查询和CRUD操作

- `useCronJobActions` (hook) - 暂停、恢复、删除、更新任务的actions hook
- `useCronJobs` (hook) - 获取指定会话的定时任务列表，支持实时事件订阅
- `useAllCronJobs` (hook) - 获取所有定时任务，支持分页和状态管理

### `src/ui/components/git/index.ts`

Git工作台面板的导出入口

- `GitWorkbenchPanel` (component) - Git工作台面板主组件，导出自GitWorkbenchPanel.tsx

### `src/ui/components/settings/PluginsSettingsPage.tsx`

插件设置页面，管理Open Computer Use和Figma等MCP插件

- `OPEN_COMPUTER_USE_ID` (constant) - Open Computer Use插件ID
- `FIGMA_OFFICIAL_ID` (constant) - Figma官方插件ID
- `getPluginStatusMeta` (function) - 获取插件状态元数据
- `getUpdateHint` (function) - 生成更新提示信息
- `PluginsSettingsPage` (component) - 插件设置页面主组件

## 关键概念

- **IPC通信**: 通过window.electron.invoke与主进程通信，支持sessions:list、cron:*、plugins:*等通道
- **流式消息渲染**: 处理SDKAssistantMessage、SDKUserMessage等流式消息类型，提取tool_use和tool_result
- **进程组**: 将连续的tool_use/tool_result消息分组显示，支持折叠和展开视图
- **上下文分布**: ActivityRail展示token在不同来源间的分布，包括system、project、skill、history等
- **定时任务**: 基于cron表达式的任务调度，支持manual/hourly/daily/weekdays/weekly/custom频率
- **文件预览**: Monaco Editor渲染代码文件，支持语法高亮、文件树导航、快速打开面板
- **浏览器工作台**: 集成本地开发服务器预览，支持URL标注和截图附件
- **权限决策**: 处理AskUserQuestion工具请求，渲染选择题或文本输入界面
- **Slash命令**: /开头的快捷命令，支持文件提及、代码引用等增强prompt
- **模型路由**: 通过ModelSelect组件选择不同的API配置文件和模型

## 内部关系

- `App.tsx` → `store/useAppStore.ts`: App使用Zustand store管理全局状态
- `App.tsx` → `components/Sidebar.tsx`: App渲染侧边栏组件
- `App.tsx` → `components/EventCard.tsx`: App使用MessageCard组件渲染消息
- `App.tsx` → `components/ActivityRail.tsx`: App渲染活动时间轴组件
- `App.tsx` → `components/PromptInput.tsx`: App渲染Prompt输入组件
- `App.tsx` → `components/BrowserWorkbenchPage.tsx`: App嵌入浏览器工作台页面
- `App.tsx` → `components/AionWorkspacePreviewPane.tsx`: App嵌入文件预览面板
- `App.tsx` → `components/cron/ScheduledTasksPage.tsx`: App渲染定时任务页面
- `EventCard.tsx` → `components/DecisionPanel.tsx`: EventCard嵌入决策面板处理权限请求
- `EventCard.tsx` → `render/markdown.tsx`: EventCard使用MDContent组件渲染markdown
- `PromptInput.tsx` → `components/ModelSelect.tsx`: PromptInput嵌入模型选择组件
- `PromptInput.tsx` → `components/ComposerContextCard.tsx`: PromptInput嵌入上下文卡片
- `AionWorkspacePreviewPane.tsx` → `render/markdown.tsx`: 预览面板使用MDContent渲染markdown
- `ScheduledTasksPage.tsx` → `pages/cron/useCronJobs.ts`: 定时任务页面使用useAllCronJobs hook
- `ScheduledTasksPage.tsx` → `components/cron/CreateTaskDialog.tsx`: 任务页面嵌入创建任务对话框
- `CreateTaskDialog.tsx` → `pages/cron/useCronJobs.ts`: 创建对话框调用IPC操作任务
- `hooks/useIPC.ts` → `store/useAppStore.ts`: IPC hook与store交互
- `ActivityRail.tsx` → `shared/activity-rail-model`: ActivityRail使用共享模型构建数据
- `ActivityRail.tsx` → `shared/prompt-ledger`: 使用prompt-ledger计算token
- `BrowserWorkbenchPage.tsx` → `utils/browser-workbench-visibility.ts`: 判断浏览器工作台可见性
