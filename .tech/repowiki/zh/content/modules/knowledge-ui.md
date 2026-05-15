# knowledge-ui

> 知识面板组件，管理知识工作区、文档生成、Git状态追踪和本地持久化

KnowledgePanel 是知识库 UI 的核心组件，负责：(1) 通过 ui_ipc:knowledge:* 信号与后端通信管理工作区和文档；(2) 追踪文档生成状态（idle/generating/paused/completed）并显示进度；(3) 定期刷新 Git 状态（30s间隔，快照超时4s）获取分支和提交信息；(4) 使用 localStorage 持久化工作区列表、隐藏状态、生成状态和自动更新设置；(5) 组织文档按 section 分类，支持搜索、排序和手动刷新。组件依赖 useAppStore 获取路由 profiles，并导出多个工具函数（getWorkspaceName、normalizeWorkspaceKey、normalizeKnowledgeWorkspace 等）供内部使用。

## Agent 可用信息

- 了解 KnowledgePanel 如何通过 IPC 与后端通信管理工作区文档
- 理解 GenerationState 状态机如何驱动 UI 进度显示
- 掌握 Git 状态刷新的时机和超时配置
- 知道 localStorage 中知识面板相关数据的存储键前缀（tech-cc-hub:knowledge-panel-*）
- 理解 normalizeKnowledgeWorkspace/Document 等工具函数如何保证数据一致性

## 优先入口

- `src/ui/components/KnowledgePanel.tsx`：知识面板的单一组件入口，代理应从这里了解完整业务逻辑和数据流

## 文件

### `src/ui/components/KnowledgePanel.tsx`

唯一的 UI 入口文件，定义 KnowledgePanel 组件及其所有子类型、工具函数和业务逻辑。代理应从此文件开始了解知识面板的完整行为

- `KnowledgePanel` (component) - 主组件，接收 onBack 和 onOpenSettings prop，控制面板的返回和设置导航
- `type GenerationStatus` (type) - 定义生成状态枚举：idle | generating | paused | completed
- `type GenerationState` (type) - 包含 completed/total/processing/failed 计数、commitId、branch 等，用于进度追踪
- `type KnowledgeWorkspace` (type) - 工作区实体，包含 key（唯一标识）、cwd、name、sessionCount、source（session|manual）、updatedAt
- `type KnowledgeDocument` (type) - 文档实体，包含 id、workspaceKey、section、title、content、sortOrder
- `type KnowledgeGitState` (type) - Git 状态，包含 loading/hasGit/branch/commitId/changedCount/error
- `const GIT_REFRESH_INTERVAL_MS` (const) - Git 状态刷新间隔，30秒
- `const GIT_SNAPSHOT_TIMEOUT_MS` (const) - Git 快照请求超时，4秒
- `getRoutedProfiles` (function) - 过滤启用的 profiles，无启用时取第一个作为回退
- `normalizeWorkspaceKey` (function) - 将 cwd 转换为标准工作区 key（去除空格，为空返回空字符串）
- `normalizeKnowledgeWorkspace` (function) - 将 API 响应记录规范化为 KnowledgeWorkspace，确保 key 有效
- `normalizeKnowledgeDocument` (function) - 安全地将未知输入转换为 KnowledgeDocument，验证必需字段

## 数据与接口契约

- **ui_ipc:knowledge:list**：列出所有工作区和生成状态，返回 KnowledgeListResponse，无参数
- **ui_ipc:knowledge:run-generation**：触发文档生成，参数包含 workspaceKey/branch/commitId 等，返回 KnowledgeRunGenerationResponse（含 report.indexedDocuments/indexedChunks/generatedFiles）
- **ui_ipc:knowledge:update-generation**：轮询更新生成状态，返回 GenerationState（completed/total/processing/failed）
- **ui_ipc:knowledge:complete-generation**：标记生成完成，返回最终 GenerationState
- **ui_ipc:knowledge:list-documents**：列出指定工作区的文档，参数 workspaceKey，返回 KnowledgeDocumentsResponse
- **ui_ipc:knowledge:add-workspace**：添加工作区，参数 cwd/name/source，返回新创建的 KnowledgeWorkspace
- **ui_ipc:knowledge:remove-workspace**：删除工作区，参数 workspaceKey，无返回值
- **ui_ipc:knowledge:git-snapshot**：获取当前 Git 状态，参数 cwd，返回 KnowledgeGitState

## 关键概念

- **工作区（Workspace）**：由 key（cwd路径）或手动创建的知识单位，分为 session（会话生成）和 manual（手动添加）两种来源
- **文档生成（Generation）**：异步过程，状态流转 idle→generating→paused/completed，通过 ui_ipc:knowledge:run-generation 触发，通过 ui_ipc:knowledge:update-generation 接收进度
- **Git 快照**：通过 ui_ipc:knowledge:git-snapshot 获取当前分支/commit/变更数，用于在生成报告中标注关联的 Git 状态
- **LocalStorage 持久化**：工作区列表、隐藏状态、生成状态、自动更新偏好通过 localStorage 保存，重启后恢复

## 内部关系

- `KnowledgePanel.tsx` -> `src/ui/store/useAppStore.ts`：导入 useAppStore 用于访问全局状态（如路由 profiles）
- `KnowledgePanel.tsx` -> `src/ui/types.ts`：导入 ApiConfigProfile、SettingsPageId 类型定义

## 运行注意事项

- Git 状态每 30 秒自动刷新，调用 git-snapshot 时设置 4 秒超时，超时后标记 error
- GenerationState 的 updatedAt 用于判断生成是否已过时，可触发重新生成
- localStorage 持久化策略：工作区列表存 tech-cc-hub:knowledge-panel-workspaces，隐藏列表存 tech-cc-hub:knowledge-panel-hidden-workspaces，生成状态存 tech-cc-hub:knowledge-panel-generation
- normalizeKnowledgeDocument 对输入做类型守卫，避免渲染时类型错误崩溃
- getRoutedProfiles 保证即使无启用 profile 也能进行知识操作（回退到第一个 profile）

## 修改风险

- 修改 GenerationState 结构可能导致现有生成记录无法解析，进度条显示异常
- 修改工作区 key 规范化逻辑可能导致现有工作区匹配失败，造成重复或丢失
- Git 刷新间隔或超时调整会影响快照成功率，4秒超时是测试后的平衡值
- localStorage 存储键变更会导致已有用户数据丢失
- 修改 normalizeKnowledgeWorkspace 的 key 去空格逻辑会影响已有工作区的标识一致性

## 验证

- UI 验证：在知识面板检查工作区列表是否正确显示，切换工作区是否刷新文档
- 生成流程验证：触发生成后观察进度条是否更新，completed/total 计数是否准确
- Git 状态验证：检查面板是否显示正确的分支名和 commit 短哈希，changedCount 是否反映实际变更
- 持久化验证：刷新页面后检查工作区列表、隐藏状态、生成状态是否恢复
