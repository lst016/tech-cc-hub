# knowledge-ui

> 提供知识工作区管理面板组件，支持文档生成状态追踪、Git状态可视化、Wiki文档预览和知识库自动更新功能。

knowledge-ui模块是Desktop Agent工作台的核心UI组件之一，封装在KnowledgePanel组件中。该模块负责：1) 管理知识工作区（KnowledgeWorkspace）的添加、隐藏和持久化存储；2) 展示文档生成（Generation）进度状态，包含idle/generating/paused/completed四种状态；3) 实时显示Git绑定状态（分支、提交哈希、变更文件数）；4) 提供Wiki文档的树形导航和预览功能；5) 支持API配置文件的路由选择。该模块与全局状态管理（useAppStore）深度集成，通过localStorage持久化用户偏好设置。

## 文件

### `src/ui/components/KnowledgePanel.tsx`

知识面板主组件，集成工作区管理、生成状态追踪、Git状态显示和Wiki文档树形浏览功能

- `getRoutedProfiles` (function) - 根据enabled标志筛选启用的API配置Profile，若无启用则回退到第一个
- `getWorkspaceName` (function) - 从cwd路径提取工作区显示名称
- `normalizeWorkspaceKey` (function) - 标准化工作区键名格式
- `normalizeKnowledgeWorkspace` (function) - 将API响应转换为KnowledgeWorkspace类型
- `normalizeKnowledgeDocument` (function) - 规范化知识文档数据结构
- `readStoredWorkspacePaths` (function) - 从localStorage读取已存储的工作区路径列表
- `readStoredBooleanRecord` (function) - 读取布尔类型存储记录（如隐藏状态）
- `isGenerationStatus` (function) - 类型守卫，验证GenerationStatus枚举值
- `resolveHeadFromSnapshot` (function) - 从快照数据解析Git HEAD信息
- `applyGitBinding` (function) - 应用Git绑定状态到生成进度
- `Toggle` (component) - 可复用开关组件
- `ProgressBlock` (component) - 生成进度展示区块
- `SectionTree` (component) - 文档树形导航组件
- `WikiDocumentView` (component) - Wiki文档内容查看组件
- `KnowledgePanel` (component) - 主入口组件，组合上述子组件实现完整功能

## 关键概念

- **KnowledgeWorkspace**: 知识工作区实体类型，包含key、cwd、name、sessionCount、source等属性，区分session自动创建和manual手动添加两种来源
- **GenerationState**: 文档生成状态机，包含status（idle/generating/paused/completed）、进度计数（completed/total/processing/failed）、Git信息（commitId、branch）和更新时间戳
- **KnowledgeGitState**: Git状态快照，包含hasGit标志、分支名、完整/短提交哈希、变更文件数和错误状态
- **Storage Persistence**: 使用localStorage持久化存储（KNOWLEDGE_WORKSPACES_STORAGE_KEY等键名）保存工作区列表和用户隐藏偏好
- **API Routing**: 通过getRoutedProfiles实现API配置的多Profile路由选择和回退逻辑
