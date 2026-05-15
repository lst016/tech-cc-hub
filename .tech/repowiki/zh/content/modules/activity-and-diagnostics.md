# activity-and-diagnostics

> 提供活动时间线、任务执行诊断和执行追踪回放功能的核心模块

ActivityRail 组件是诊断与活动追踪的核心 UI，负责渲染会话执行过程中的活动时间线、任务步骤状态、上下文使用分布和工具来源追溯。它从 store 读取会话数据，结合 prompt-ledger 和 plan-progress 模型，构建 ActivityTimelineItem 列表供用户交互式浏览。组件还支持通过 WorkspaceTabs 切换到 Git、浏览器预览等面板，形成完整的诊断视图。

## Agent 可用信息

- 通过 nodeKind 和 tone 理解事件重要程度，快速定位错误节点
- 掌握工具来源追溯机制（local/mcp/sub_agent/a2a），诊断工具调用链路
- 理解上下文 token 分布，为 prompt 优化提供数据依据
- 知晓工作区多面板切换逻辑（ActivityWorkspaceTabs），便于扩展新面板
- 通过时间线选中机制（data-timeline-id 属性）理解 UI 交互逻辑

## 优先入口

- `src/ui/components/ActivityRail.tsx`：主组件，1570 行代码涵盖所有 UI 逻辑和时间线渲染，是理解诊断模块的第一入口

## 文件

### `src/ui/components/ActivityRail.tsx`

活动时间线主组件，渲染会话中所有节点的时序视图，支持选中查看详情

- `ActivityRail` (component) - 主组件，接收会话数据并渲染时间线列表
- `ActivityTimelineItem` (type) - 时间线节点类型，含 nodeKind、tone、title、id 等字段，定义事件展示样式
- `ActivityRailTone` (type) - 语气/色调枚举（info/success/warning/error），决定节点边框颜色和背景
- `ActivityToolProvenance` (type) - 工具来源枚举（local/mcp/sub_agent/a2a/transfer_agent），追溯工具调用来源
- `toneClasses` (function) - 根据 tone 返回对应 Tailwind CSS 类名，控制颜色主题
- `getNodeKindLabel` (function) - 将 nodeKind 映射为中文标签，如'terminal'映射为'终端'
- `STAGE_ORDER` (const) - 阶段顺序常量 ['inspect', 'implement', 'verify', 'deliver']

### `src/shared/activity-rail-model.ts`

ActivityRail 的数据模型定义，导出所有关键类型和构建函数

- `ActivityAnalysisCard` (type) - 分析卡片类型，用于展示执行指标摘要
- `ActivityDetailSection` (type) - 详情区块类型，包含具体诊断信息段
- `ActivityExecutionMetrics` (type) - 执行指标类型，记录耗时、成功/失败数等
- `ActivityTaskStep` (type) - 任务步骤类型，对应 PlanStepStatus
- `ContextDistributionBucket` (type) - 上下文分布桶，用于展示 token 使用分布

### `src/ui/store/useAppStore.ts`

全局状态存储，ActivityRail 通过此模块订阅会话视图数据

- `SessionView` (type) - 会话视图类型，包含活动数据和选中状态
- `useAppStore` (hook) - Zustand store hook，提供会话状态和操作方法

### `src/shared/prompt-ledger.ts`

提示词账本模块，记录 token 消耗来源，ActivityRail 用于上下文使用分析

- `estimatePromptLedgerTokens` (function) - 估算 prompt ledger token 数量
- `PromptLedgerSourceKind` (type) - 来源类型枚举（system/project/skill/workflow 等）

### `src/ui/utils/context-usage-breakdown.ts`

上下文使用分布工具，计算并渲染 token 消耗分布图

- `buildContextUsageBreakdown` (function) - 构建上下文使用分布数据
- `ContextUsageBreakdownCategory` (type) - 分布分类类型

### `src/ui/utils/context-usage-cells.ts`

分段上下文使用单元格工具，将 token 消耗按维度切分展示

- `buildSegmentedContextUsageCells` (function) - 构建分段上下文使用单元格
- `ContextUsageCellSegment` (type) - 单元格分段类型

### `src/ui/components/ActivityWorkspaceTabs.tsx`

工作区标签页组件，与 ActivityRail 配合支持多面板切换（Git/预览等）

- `ActivityWorkspaceTab` (type) - 工作区标签类型定义

### `src/ui/components/AionWorkspacePreviewPane.tsx`

Aion 工作区预览面板，提供浏览器内嵌预览功能

- `AionWorkspacePreviewPane` (component) - 预览面板组件

### `src/ui/components/git/GitWorkbenchPanel.tsx`

Git 工作台面板组件，在诊断视图中展示版本控制状态

- `GitWorkbenchPanel` (component) - Git 面板组件

## 数据与接口契约

- **ActivityTimelineItem[]**：时间线数据数组，从 useAppStore.sessionView.activities 获取，每个元素包含 id、nodeKind、tone、title 等字段
- **SessionView**：会话视图类型，定义在 useAppStore.ts 中，包含活动列表和选中节点 ID
- **PromptLedgerSourceKind**：Token 来源类型枚举（src/shared/prompt-ledger.ts），用于上下文分布分析

## 关键概念

- **ActivityTimelineItem**：时间线核心数据结构，nodeKind 决定展示类型（context/plan/assistant_output/tool_input 等），tone 决定颜色主题，id 用于选中状态管理
- **ActivityRailTone**：色调枚举映射到 Tailwind 类，控制节点视觉状态：info 为蓝色、success 为绿色、warning 为橙色、error 为红色
- **工具来源追溯 (Provenance)**：ActivityToolProvenance 记录工具调用来源（本地/MCP/子Agent/A2A），帮助诊断工具依赖链路
- **阶段排序 (Stage Order)**：STAGE_ORDER 定义 AI 工作流四阶段：检查与理解、实施与修改、验证与确认、整理与输出
- **上下文使用分析**：结合 prompt-ledger 和 context-usage-breakdown，计算会话中各类来源的 token 消耗分布

## 内部关系

- `ActivityRail.tsx` -> `activity-rail-model.ts`：导入所有 ActivityTimeline 相关类型定义
- `ActivityRail.tsx` -> `useAppStore.ts`：订阅会话状态，获取当前选中的时间线节点和会话数据
- `ActivityRail.tsx` -> `prompt-ledger.ts`：调用 token 估算函数，用于上下文使用分析
- `ActivityRail.tsx` -> `context-usage-breakdown.ts`：使用分布工具构建上下文分析视图
- `ActivityRail.tsx` -> `context-usage-cells.ts`：使用分段单元格渲染 token 消耗详情
- `ActivityRail.tsx` -> `AionWorkspacePreviewPane.tsx`：在工作区标签中嵌入浏览器预览
- `ActivityRail.tsx` -> `ActivityWorkspaceTabs.tsx`：协调多面板布局，支持 Git/预览切换
- `ActivityRail.tsx` -> `GitWorkbenchPanel.tsx`：在诊断视图中集成 Git 状态面板

## 运行注意事项

- ActivityRail 通过 useDeferredValue 优化大量时间线项的渲染性能
- 组件使用 data-timeline-id 属性标记每个时间线节点，用于外部脚本或测试定位
- 时间线项点击触发 onSelect 回调，更新 store 中选中节点状态
- GitWorkbenchPanel 和 AionWorkspacePreviewPane 作为子面板嵌入，通过 ActivityWorkspaceTabs 协调

## 修改风险

- 修改 ActivityTimelineItem 类型字段会导致所有时间线渲染逻辑失效，需同步更新 toneClasses 和 getNodeKindLabel
- 变更 nodeKind 枚举值需同步更新 NODE_KIND_LABELS 映射表，否则显示为 undefined
- 修改 ActivityRailTone 枚举需同步更新 toneClasses 和 toneAccentClasses 函数
- 移除 ActivityWorkspaceTabs 子面板会导致工作区切换功能缺失
- 修改 store 中的活动数据结构会导致时间线渲染异常

## 验证

- 启动应用后进入任意会话，验证时间线是否正确渲染所有节点类型
- 点击时间线节点，检查是否高亮选中且详情面板正确显示
- 切换到 Git 面板，验证版本控制状态是否正确加载
- 打开浏览器预览面板，验证 URL 是否正确渲染
