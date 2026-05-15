# ui-state

> Zustand状态管理模块，管理UI层核心状态：会话视图、浏览器工作台、代码引用、任务执行及工作流状态

ui-state是Desktop Agent的核心状态层，包含两个Zustand store：useAppStore管理会话、权限、API配置、浏览器预览和引用草稿；useTaskStore管理任务列表、执行记录、日志和产物。两个store通过../types共享类型定义，useAppStore还依赖shared层的workflow、slash-commands和plan-progress模块。

## Agent 可用信息

- 理解SessionView.status字段如何驱动UI禁用/启用输入框和发送按钮
- 知道PermissionRequest的toolUseId用于匹配tools.call事件和渲染审批弹窗
- 掌握codeReferencesBySessionId的__draft__机制，避免添加引用时sessionId为null导致键错误
- 了解BrowserWorkbenchAnnotation数组驱动iframe叠加层，无浏览器tab时annotations不更新
- 任务执行日志通过addExecutionLog增量追加，避免setExecutionLogs全量替换导致的UI闪烁
- 知道workflowState和workflowSpec在Markdown解析流程中的位置（parseWorkflowMarkdown输出）

## 优先入口

- `src/ui/store/useAppStore.ts`：会话状态是Desktop Agent主视图的核心，agent应首先理解SessionView和permissionRequests结构
- `src/ui/store/taskStore.ts`：任务执行面板独立于主会话视图，需单独理解tasks/executions的索引关系

## 文件

### `src/ui/store/useAppStore.ts`

主应用状态存储，管理会话生命周期、浏览器工作台、代码/消息/文件引用草稿、API配置和权限请求。核心状态枢纽，决定UI如何渲染会话列表、工具栏和预览面板

- `SessionView` (type) - 会话视图类型，包含messages、permissionRequests、workflowState、latestPlan等字段，定义单个会话的完整状态结构
- `PermissionRequest` (type) - 工具权限请求类型，包含toolUseId、toolName、input，用于运行时权限审批UI
- `BrowserWorkbenchSessionState` (type) - 浏览器工作台状态，含url、hasBrowserTab、annotations，per-session隔离
- `CodeReferenceDraft` (type) - 代码引用草稿，含filePath、code、startLine、endLine、comment，支持selection和comment两种kind
- `getCodeReferenceSessionKey` (function) - 解析sessionId，返回__draft__作为无会话时的键名，用于全局代码引用草稿存储
- `useAppStore` (store) - Zustand store实例，导出create的set函数和所有状态与actions

### `src/ui/store/taskStore.ts`

任务执行状态存储，管理UiTask列表、执行记录executionLogs、子任务subtasks、产物artifacts和任务统计stats。支撑任务面板的列表渲染、执行详情和日志流式输出

- `useTaskStore` (store) - Zustand store，含tasks/executions/executionLogs/subtasks/artifacts/stats/settings/providers等状态及其set方法
- `upsertTask` (action) - 更新或插入任务，若id存在则替换，否则前置插入
- `setExecutionData` (action) - 批量设置执行记录、日志、子任务和产物，用于任务详情页初始化
- `addExecutionLog` (action) - 追加单条执行日志，支持流式日志实时追加渲染
- `removeTask` (action) - 删除任务同时清理关联的executions/executionLogs/subtasks/artifacts，修复selectedTaskId悬空

## 数据与接口契约

- **SessionView**：会话状态完整类型定义在useAppStore.ts:32，含messages:StreamMessage[]、status:SessionStatus、permissionRequests:PermissionRequest[]等，backend通过ServerEvent驱动更新
- **UiTaskExecutionLog**：任务执行日志类型，由backend execution trace服务推送，addExecutionLog追加到executionLogs[taskId]数组，流式渲染依赖此结构
- **BrowserWorkbenchAnnotation**：浏览器标注类型，定义在types中，browserAnnotations和per-session annotations驱动iframe叠加层渲染，修改结构需同步UI组件
- **ApiConfigSettings**：API配置类型，含模型选择、API密钥等，set于useAppStore.apiConfigSettings，settingsModal消费此状态渲染配置表单

## 关键概念

- **SessionView状态机**：每个SessionView含status(pending/running/done/error)、messages、permissionRequests、workflowState，会话状态决定工具栏按钮和输入框可用性
- **PermissionRequest权限审批流**：RuntimePermissionMode决定是否需要人工审批toolUse，useAppStore维护pending权限队列，UI消费permissionRequests渲染审批按钮
- **CodeReferenceDraft会话隔离**：codeReferencesBySessionId以sessionId为键，getCodeReferenceSessionKey处理null→__draft__转换，支持全局草稿和会话绑定草稿两种模式
- **BrowserWorkbenchSessionState**：浏览器预览状态per-session隔离，含url、hasBrowserTab、annotations，annotations驱动iframe叠加层高亮和交互
- **任务执行日志流式追加**：addExecutionLog以taskId为键追加日志数组，用于执行详情页的流式日志渲染，无需全量替换
- **upsertTask原子性**：findIndex判断后选择替换或前置插入，避免全量重置tasks数组触发不必要的React重渲染

## 内部关系

- `src/ui/store/useAppStore.ts` -> `src/ui/types`：从types导入ApiConfigProfile、RuntimePermissionMode、SessionStatus、StreamMessage等会话和权限相关类型
- `src/ui/store/useAppStore.ts` -> `src/shared/workflow-markdown`：导入SessionWorkflowState、WorkflowSpecDocument用于工作流Markdown解析和状态同步
- `src/ui/store/useAppStore.ts` -> `src/shared/slash-commands`：导入extractSlashCommandsFromMessages和mergeSlashCommandLists用于斜杠命令解析
- `src/ui/store/useAppStore.ts` -> `src/shared/plan-progress`：导入normalizeTodoWriteArgs和SessionPlanSnapshot用于计划进度管理
- `src/ui/store/taskStore.ts` -> `src/ui/types`：导入UiTask、UiTaskExecution、UiTaskExecutionLog、UiTaskArtifact等任务执行类型定义

## 运行注意事项

- useAppStore使用Zustand create默认导出useAppStore hook，组件通过useAppStore((s)=>s.field)订阅
- taskStore的syncing字段控制任务列表加载态，UI据此显示骨架屏而非空白
- removeTask同时清理selectedTaskId，防止已删任务仍显示详情面板
- workflowMarkdown解析后状态存于workflowState，workflowSpec为原始文档结构，两者分离避免重复解析
- CODE_REFERENCE_DRAFT_SESSION_ID='__draft__'是固定常量，任何传入null/undefined的getCodeReferenceSessionKey调用都返回此值

## 修改风险

- 在SessionView.messages字段添加新属性会触发所有消费messages的UI组件重渲染，注意性能
- BrowserWorkbenchAnnotation类型变更需同步更新iframe叠加层组件，否则类型不匹配
- removeTask的级联清理逻辑依赖state键命名，修改executions/executionLogs/subtasks/artifacts的键结构会导致内存泄漏
- upsertTask的前置插入逻辑依赖tasks数组顺序，改为后置插入会影响任务列表默认排序
- PermissionRequest.toolUseId作为唯一标识，若backend推送的toolUseId格式变化，权限审批匹配逻辑失效

## 验证

- 运行pnpm lint检查useAppStore.ts和taskStore.ts类型导出是否完整
- 验证useAppStore中SessionView的status状态机能覆盖pending/running/done/error所有枚举值
- 检查BrowserWorkbenchAnnotation的annotations数组变更能触发iframe叠加层重新渲染
- 测试getCodeReferenceSessionKey(null)和getCodeReferenceSessionKey(undefined)都返回__draft__
- 验证任务详情页addExecutionLog流式追加不触发整页重渲染
