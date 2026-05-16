# session-engine

> Desktop Agent的会话生命周期引擎，管理Session创建、消息持久化、浏览器隔离上下文和工作流钩子

session-engine模块是Desktop Agent的核心引擎，负责管理会话的完整生命周期。核心组件SessionStore基于SQLite（better-sqlite3）实现会话和消息的持久化，支持分页历史查询、归档/恢复、cwd路径解析等能力。模块包含三组工作流钩子脚本（session-start/session-check/session-end）用于在Claude CLI会话开始、检查点、结束时的上下文加载、提醒和归档。browser-workbench-session提供隔离的浏览器会话配置，支持持久化登录状态。模块还定义了状态机规范和组件规范文档。

## 文件

### `src/electron/libs/session-store.ts`

核心Session存储引擎，使用better-sqlite3管理会话和消息的持久化、查询、归档

- `parseWorkflowState` (function) - 解析JSON格式的workflow状态，失败时返回undefined
- `isTransientStreamEventMessage` (function) - 判断消息是否为瞬态事件（如stream_event或status子类型），用于过滤
- `parseStoredMessage` (function) - 从数据库行解析StreamMessage，附加capturedAt和historyId
- `createHistoryCursor` (function) - 基于消息创建分页游标{capturedAt, historyId}
- `SessionStore` (class) - 主存储类，管理sessions Map和db连接，提供createSession/listSessions/archiveSession/startSession等API
- `LEGACY_CWD_SUFFIXES` (constant) - 历史遗留路径后缀列表，用于兼容旧版本cwd路径
- `Session` (type) - 运行时会话对象，包含pendingPermissions Map和abortController等运行时字段
- `StoredSession` (type) - 持久化会话投影，不含运行时字段
- `SessionHistory` (type) - 会话+消息的组合类型
- `SessionHistoryPage` (type) - 分页类型，包含hasMore和nextCursor

### `pro-workflow/scripts/session-start.js`

会话启动钩子，加载最近学习记录、会话历史、wiki列表

- `findProjectRoot` (function) - 向上遍历目录找到.git所在的项目根目录
- `getStore` (function) - 尝试加载dist/db/store.js获取数据库store，回退到null
- `main` (function) - 主逻辑：加载learnings、recentSessions、wikis，无数据库时读LEARNED.md文件

### `pro-workflow/scripts/session-check.js`

会话检查钩子，每轮Claude响应后运行，检测完成信号并周期性提醒

- `detectCompletionSignals` (function) - 用正则检测任务完成信号（如all changes complete/PR merged）
- `detectLargeChange` (function) - 检测大型变更信号（如X files changed）
- `main` (function) - 读取last_assistant_message，每20次响应触发一次提醒（wrap-up/compact/learn-rule）

### `pro-workflow/scripts/session-end.js`

会话结束钩子，保存会话统计到数据库或文件，提醒未提交更改

- `findProjectRoot` (function) - 向上遍历找到项目根目录
- `getStore` (function) - 加载数据库store用于保存会话
- `main` (function) - 尝试用store.endSession保存，否则写临时markdown文件；检查git status提醒未提交

### `src/electron/libs/browser-workbench-session.ts`

浏览器工作台会话的WebPreferences构建器，提供隔离的安全配置

- `BROWSER_WORKBENCH_PARTITION` (constant) - 持久化分区ID：persist:tech-cc-hub-browser
- `BrowserWorkbenchWebPreferences` (type) - WebPreferences类型：contextIsolation=true, nodeIntegration=false, sandbox=true
- `buildBrowserWorkbenchWebPreferences` (function) - 构建完整的WebPreferences对象，可选附加preload脚本

### `pro-workflow/skills/session-handoff/SKILL.md`

会话交接技能文档，定义如何生成结构化的会话交接文档

- `Handoff格式` (template) - 包含Status/What'sDone/What'sInProgress/What'sPending/KeyDecisions/Learnings/FilesTouched/Gotchas/ResumeCommand

### `test/electron/session-archive.test.ts`

测试Session归档和恢复功能

- `test` (test) - 验证archiveSession/unarchiveSession的正确性和listSessions过滤

### `test/electron/session-analysis-page.test.ts`

测试App中session analysis的入口和页面渲染

- `test` (test) - 验证App.tsx/ActivityRail.tsx/SessionAnalysisPage.tsx中的关键字存在

### `test/electron/browser-workbench-session.test.ts`

测试browser workbench session的partition和webPreferences构建

- `describe/it` (test) - 验证BROWSER_WORKBENCH_PARTITION以persist:开头，buildBrowserWorkbenchWebPreferences正确合并preload

### `doc/20-contracts/session-lifecycle/spec.md`

Session/Message/Event状态机规范文档，定义生命周期和持久化语义

- `Session状态机` (spec) - idle→running→completed/error的状态转换规则
- `SessionHistoryPage` (spec) - 游标分页接口：beforeCreatedAt和beforeId

### `doc/40-product/1.0.0/40-delivery/components/CMP-001-SessionSidebar.md`

SessionSidebar组件产品规范

- `职责` (spec) - 展示Session列表、当前选中状态、最近活动摘要，支持切换和新建

### `doc/40-product/1.0.0/40-delivery/controllers/CTR-001-SessionController.md`

SessionController产品规范

- `职责` (spec) - Session创建/查询/恢复/停止的对外边界

### `doc/90-archive/iterations/implementation-plan-session-analysis.md`

会话执行分析实现计划

- `目标` (plan) - 双轨Step（plan steps / execution steps）增强和模型层扩展

## 关键概念

- **Session运行时 vs 持久化**: Session类包含pendingPermissions Map和abortController等运行时字段，StoredSession用于数据库持久化，不含这些字段
- **双轨Step投影**: ActivityRail中plan steps和execution steps的分离投影，为后续分析页和人工标注打基础
- **Cursor分页**: SessionHistoryPage使用beforeCreatedAt和beforeId游标实现高效的向后分页
- **瞬态消息过滤**: isTransientStreamEventMessage过滤stream_event和system status消息，不写入历史
- **Legacy CWD路径兼容**: LEGACY_CWD_SUFFIXES处理旧版本工作目录路径，映射到当前appPath
- **工作流钩子链**: session-start→Claude响应→session-check（周期性）→session-end构成完整会话生命周期
- **Browser隔离分区**: persist:tech-cc-hub-browser分区保持登录状态跨会话

## 内部关系

- `session-store.ts` → `browser-workbench-session.ts`: 共享BrowserView的partition配置
- `session-start.js` → `session-end.js`: 都使用getStore加载db/store.js
- `session-check.js` → `session-store.ts`: session-check读写临时文件，session-store管理SQLite持久化
- `test/session-archive.test.ts` → `session-store.ts`: 直接测试SessionStore类的archiveSession/unarchiveSession方法
- `test/browser-workbench-session.test.ts` → `browser-workbench-session.ts`: 直接测试buildBrowserWorkbenchWebPreferences函数
