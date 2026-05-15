# test

> 单元测试模块，使用 Node.js 内置 test runner 验证核心功能逻辑

Electron 渲染进程和主进程的单元测试集合。通过 node:test 框架和 assert/strict 进行断言，覆盖 UI 组件工具函数、业务模型构建、浏览器工作台管理、API 配置持久化、自动更新降级逻辑、附件处理、MCP 内置注册表等功能。所有测试文件位于 test/electron/ 目录，引用 src/ 下的源码进行行为验证。

## 文件

### `test/electron/tsconfig.json`

测试专用 TypeScript 配置，输出到 dist-test 目录，配置严格模式和 NodeNext 模块系统

- `compilerOptions` (config) - 编译选项：strict=true, ESNext, NodeNext, react-jsx, 引用 node 和项目自定义类型

### `test/electron/activity-rail-dual-steps.test.ts`

验证 buildActivityRailModel 能将计划步骤和执行步骤分离展示

- `buildActivityRailModel` (function) - 被测函数：从 src/shared/activity-rail-model.js 导入，构建活动轨迹模型

### `test/electron/activity-rail-model.test.ts`

验证 buildPromptLedgerMessage 将 prompt 来源分类（system/project/skill/memory/history）以便优化 token 消耗

- `buildPromptLedgerMessage` (function) - 从 src/shared/prompt-ledger.js 导入，构建提示账本消息，测试 buckets 和 segments 结构

### `test/electron/activity-workspace-tabs.test.ts`

验证工作区标签页可见性逻辑和浏览器标签页创建时机

- `buildActivityWorkspaceTabs` (function) - 从 src/ui/utils/activity-workspace-tabs.js 导入，构建标签页列表
- `shouldShowCreateBrowserTab` (function) - 判断是否显示创建浏览器标签页按钮

### `test/electron/agent-rules-settings.test.ts`

验证 Agent 规则设置页面在切换标签时触发文档重新加载

- `onRefreshDocuments` (property) - SettingsPage 接收的刷新回调属性
- `refreshAgentRuleDocuments` (function) - SettingsModal 中的刷新逻辑，调用 electronApi.getAgentRuleDocuments

### `test/electron/api-config-save-scope.test.ts`

验证 API 配置的脏值检测机制，避免不必要的配置重写；验证 Claude 设置回退为只读

- `apiConfigDirty` (state) - dirty flag，仅当 API 配置变更时才调用 saveApiConfig
- `getFallbackClaudeSettingsConfig` (function) - 从 src/electron/libs/claude-settings.ts 获取只读回退配置

### `test/electron/app-shell-layout.test.ts`

验证 App Shell 布局移除固定宽度限制，验证反馈按钮直接跳转到 GitHub Issues

- `max-w-[920px]` (pattern) - 检查不应存在 920px 最大宽度限制
- `github.com/lst016/tech-cc-hub/issues/new` (pattern) - 检查反馈按钮直接打开 GitHub Issues URL

### `test/electron/attachments.test.ts`

验证附件处理函数：创建存储的用户 prompt 消息、估算 token 字符数、解析图片源

- `createStoredUserPromptMessage` (function) - 从 src/shared/attachments.js 导入，保留附件供历史回放
- `estimateAttachmentPromptChars` (function) - 估算附件 prompt 字符数，使用摘要文本而非原始字节
- `resolveImageAttachmentSrc` (function) - 解析图片源，保留 data URL 或转换 base64

### `test/electron/auto-updater-fallback.test.ts`

验证自动更新降级逻辑：平台元数据检测、版本比较、兼容发布版选择

- `isMissingPlatformUpdateMetadataError` (function) - 检测 electron-updater 缺失元数据错误
- `compareAppVersions` (function) - 比较带 v 前缀的 semver 版本
- `selectBestReleaseForUpdate` (function) - 选择当前版本之后且有兼容元数据的最新发布

### `test/electron/browser-annotation-hover.test.ts`

验证浏览器标注模式下的悬停预览功能通过 preload bridge 而非 console 发送

- `__techCcHubAnnotationHoverHandler` (pattern) - mousemove 事件处理器标识
- `bridge.emit` (pattern) - 通过 preload bridge 发送标注数据

### `test/electron/browser-annotation-reset.test.ts`

验证清除浏览器标注状态的函数，先清理后禁用模式，失败时仍禁用

- `resetBrowserWorkbenchAnnotationState` (function) - 从 src/ui/utils/browser-annotation-reset.js 导入，清除标注并禁用模式

### `test/electron/browser-workbench-bounds.test.ts`

验证浏览器工作台边界清理和零尺寸分离逻辑

- `sanitizeBrowserWorkbenchBounds` (function) - 从 src/electron/libs/browser-workbench-bounds.js 导入，清理边界值为整数
- `shouldDetachBrowserWorkbenchForBounds` (function) - 零尺寸边界时返回 true 分离 BrowserView

### `test/electron/browser-workbench-session.test.ts`

验证浏览器工作台 WebPreferences 构建，使用持久化 partition

- `BROWSER_WORKBENCH_PARTITION` (constant) - 持久化分区前缀 persist:tech-cc-hub-browser-workbench
- `buildBrowserWorkbenchWebPreferences` (function) - 从 src/electron/libs/browser-workbench-session.js 构建带 preload 的 WebPreferences

### `test/electron/browser-workbench-visibility.test.ts`

验证浏览器工作台可见性判断逻辑（活动状态、标签页存在、遮罩阻塞）

- `shouldAttachBrowserWorkbench` (function) - 从 src/ui/utils/browser-workbench-visibility.js 导入，判断是否附加 BrowserView
- `hasRenderableBrowserWorkbenchBounds` (function) - 零尺寸边界视为不可渲染

### `test/electron/builtin-mcp-registry.test.ts`

验证内置 MCP 服务器注册表的数据完整性和工具名唯一性

- `BUILTIN_MCP_SERVERS` (constant) - 内置 MCP 服务器列表
- `listBuiltinMcpToolNames` (function) - 列出所有内置 MCP 工具名并验证唯一性
- `buildBuiltinMcpPromptHints` (function) - 构建 MCP 提示 hints 字符串

### `test/electron/channel-bridge.test.ts`

空占位文件，备注 Lark-IM 功能已移除，待后续补充其他 IM 渠道测试

## 关键概念

- **dirty checking**：API 配置保存使用脏值标志，仅当配置变更时才写入磁盘，避免不必要的文件重写和磁盘 IO
- **prompt ledger**：prompt 账本模式将用户输入、上下文来源、历史消息等分类到独立 bucket，支持精细化的 token 消耗估算和优化
- **activity rail dual steps**：活动轨迹模型将 LLM 规划步骤（plan）和执行步骤（execution）分离展示，用户可切换查看
- **BrowserView lifecycle**：BrowserWorkbench 使用 Electron BrowserView，通过 bounds 变化控制附加/分离，零尺寸自动分离优化性能
- **MCP builtin registry**：内置 MCP 服务器注册表定义工具元数据（描述、高亮、工具组），驱动设置页展示和 prompt hints 生成
- **auto-updater fallback**：当 electron-updater 无法获取平台元数据时，从 GitHub Releases 列表筛选兼容发布作为降级方案
- **browser annotation bridge**：标注模式通过 preload bridge 而非 console.log 传递数据，保证隔离性和安全性

## 内部关系

- `activity-rail-dual-steps.test.ts` -> `src/shared/activity-rail-model.js`：测试活动轨迹模型的步骤分离逻辑
- `activity-rail-model.test.ts` -> `src/shared/prompt-ledger.js`：测试 prompt 账本的来源分类和 token 估算
- `activity-workspace-tabs.test.ts` -> `src/ui/utils/activity-workspace-tabs.js`：测试工作区标签页构建和浏览器标签显示逻辑
- `agent-rules-settings.test.ts` -> `src/ui/components/settings/AgentRulesSettingsPage.tsx`：验证设置页面的文档刷新回调
- `agent-rules-settings.test.ts` -> `src/ui/components/SettingsModal.tsx`：验证设置弹窗中的刷新逻辑实现
- `api-config-save-scope.test.ts` -> `src/ui/components/SettingsModal.tsx`：验证脏值检测避免不必要保存
- `api-config-save-scope.test.ts` -> `src/electron/libs/claude-settings.ts`：验证 Claude 设置回退为只读
- `app-shell-layout.test.ts` -> `src/ui/App.tsx`：验证应用布局无固定宽度限制
- `app-shell-layout.test.ts` -> `src/ui/components/ActivityRail.tsx`：验证活动轨迹包含执行计划文案
- `app-shell-layout.test.ts` -> `src/ui/components/PromptInput.tsx`：验证 prompt 输入框无固定宽高限制
- `attachments.test.ts` -> `src/shared/attachments.js`：测试附件创建、估算和解析函数
- `auto-updater-fallback.test.ts` -> `src/electron/libs/auto-updater-fallback.js`：测试自动更新降级逻辑函数
- `browser-annotation-hover.test.ts` -> `src/electron/browser-manager.ts`：验证标注悬停处理和 bridge 通信
- `browser-annotation-reset.test.ts` -> `src/ui/utils/browser-annotation-reset.js`：测试标注重置函数
- `browser-workbench-bounds.test.ts` -> `src/electron/libs/browser-workbench-bounds.js`：测试边界清理和分离判断
- `browser-workbench-session.test.ts` -> `src/electron/libs/browser-workbench-session.js`：测试 WebPreferences 构建和 partition 配置
- `browser-workbench-visibility.test.ts` -> `src/ui/utils/browser-workbench-visibility.js`：测试可见性判断函数
