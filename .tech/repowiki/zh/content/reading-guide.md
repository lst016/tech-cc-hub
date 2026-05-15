# 阅读指南

这个代码库是 Electron + React 的 Desktop Agent 工作台。核心链路有四条：会话执行（MCP工具→Runner→会话持久化）、知识库生成（切块→embedding→FTS5/vec索引→overview注入）、任务调度（provider→executor→重试恢复）、和技能管理（安装→场景绑定→工具暴露）。从 electron main 到 renderer 的 IPC 桥接是所有功能的前置依赖，先读 main.ts 再逐层深入。

## Step 1: Electron 主进程入口：IPC 通道注册和窗口创建 (10 min)

**文件：** `src/electron/main.ts`

main.ts 是 Electron 主进程唯一入口。它在 app.on('ready') 后注册所有 ipcMain.handle 通道（sessions:list、preview-*、plugins-*、knowledge-*、client-event 等），创建 BrowserWindow 并初始化数据库连接。找到 registerIpcHandlers() 和 createWindow() 两段代码，理解通道命名空间和窗口 preload 脚本的注入方式。如果要新增 IPC 通道，必须在这里注册。

## Step 2: 会话编排层：IPC handlers 和任务事件分发 (15 min)

**文件：** `src/electron/ipc-handlers.ts`

ipc-handlers.ts 定义了 session.start、client-event、getStaticData、generate-session-title 等核心通道的处理逻辑。它连接了 session-store、TaskExecutor、KnowledgeUIStore 和 Runner。当 renderer 通过 client-event 发送用户 prompt 时，这里会触发会话创建并启动 runner 循环。event:task.updated 等任务事件也在这里注册分发器。修改会话生命周期逻辑必须从这里开始。

## Step 3: Agent 执行引擎：Runner 和 MCP 工具链 (20 min)

**文件：** `src/electron/libs/runner.ts`, `src/shared/builtin-mcp-registry.ts`

runner.ts 是 Agent 执行的核心循环：接收 prompt→合并 system prompt（含 knowledge-overview）→调用 MCP server→解析 tool_use→写入会话历史。builtin-mcp-registry.ts 定义了所有内置工具的元数据（名称、描述、参数 schema）。如果要给 Agent 增加新工具，需要在这两个文件中同时注册。要理解 tool_call 循环如何结束就看 runner 的 resolveLoop 和 abort 处理。

## Step 4: UI 状态容器：Zustand store 和会话视图 (15 min)

**文件：** `src/ui/store/useAppStore.ts`, `src/ui/types.ts`

useAppStore.ts 是前端状态的一级入口，存储当前会话、消息历史、浏览器状态、任务列表等。它通过 window.electronAPI.invoke 与主进程通信，接收事件（event:session.*, event:task.*）来更新状态。types.ts 定义了所有前端事件类型（event:user_prompt、event:stream.message、event:session.status 等），新增事件必须在这里声明。修改 UI 响应逻辑要查这里的事件订阅。

## Step 5: 知识库生成：切块、embedding 和检索 (25 min)

**文件：** `src/electron/libs/knowledge/knowledge-indexer.ts`, `src/electron/libs/knowledge/knowledge-repository.ts`, `src/electron/libs/knowledge/knowledge-overview.ts`

knowledge-indexer.ts 实现 Markdown 生成→文本切块→embedding（sqlite-vec）→FTS5 写入的完整流水线。knowledge-repository.ts 定义了 knowledge_documents、knowledge_chunks、knowledge_chunks_fts、knowledge_chunk_vectors 四张表和索引。knowledge-overview.ts 生成 XML 摘要注入到 runner 的 system prompt。修改知识库逻辑要同时看这三层：生成器→存储→注入。

## Step 6: 任务执行：Executor、恢复和重试 (20 min)

**文件：** `src/electron/libs/task/executor.ts`, `src/electron/libs/task/types.ts`

executor.ts 管理任务的并发执行、自动重试、会话归档触发和执行记录写回。TaskExecutor 接收 TaskProvider 注册的任务，执行时通过独立 workspace 隔离环境。types.ts 定义了任务状态流转（event:task.execution.started、event:task.execution.completed、event:task.execution.log）。如果修改任务调度逻辑或增加新的执行策略，看 executor 的 _executeWithRetry 和 workspace 管理。

## Step 7: 技能管理：安装、场景和工具暴露 (15 min)

**文件：** `src/electron/libs/skill-manager/ipc-handlers.ts`, `src/electron/libs/skill-manager/db.ts`, `src/ui/components/settings/InstallSkillsView.tsx`

skill-manager 处理技能的安装、删除、场景绑定和工具生成。ipc-handlers.ts 定义了 skills:installLocal、skills:batchImportFolder 等通道。db.ts 定义了 skills、scenarios、scenario_skills 表。renderer 侧通过 InstallSkillsView.tsx 调用这些通道。修改技能安装流程要同时看主进程 IPC handlers 和前端 UI 调用。

## Step 8: MCP 工具面：内置工具实现 (20 min)

**文件：** `src/electron/libs/mcp-tools/browser.ts`, `src/electron/libs/mcp-tools/cron.ts`, `src/electron/libs/mcp-tools/design.ts`

browser.ts 实现了所有浏览器操作工具（open、navigate、click、fill、eval 等），使用 CDP 连接。cron.ts 暴露任务调度工具（create_scheduled_task、list_scheduled_tasks）。design.ts 实现设计对比工具（design_capture_current_view、design_compare_images 等）。这些工具通过 builtin-mcp-servers.ts 创建为真实 MCP server。修改工具行为直接看这些文件。

## Step 9: UI 渲染层：App 入口和知识面板 (15 min)

**文件：** `src/ui/App.tsx`, `src/ui/components/KnowledgePanel.tsx`

App.tsx 是 React 渲染入口，注册事件监听（event:separator、event:message、event:session.*），组装各功能面板。KnowledgePanel.tsx 是知识库 UI 入口，通过 bridge 调用 knowledge:run-generation、knowledge:add-workspace 等通道。修改 UI 交互逻辑从这两个文件开始，它们是 renderer 到主进程通信的边界。

## Tips

- 新增 IPC 通道必须在 src/electron/main.ts 的 registerIpcHandlers() 中注册，并在 src/ui/types.ts 中声明对应事件类型，否则类型检查会失败。
- 修改 MCP 工具时，registry 元数据和实现必须同步更新：src/shared/builtin-mcp-registry.ts 定义 schema，mcp-tools/*.ts 实现逻辑，runner.ts 负责调用循环。
- 知识库状态必须双写：前端只负责展示，真实状态落在 knowledge_ui_generation 和 knowledge_ui_documents，刷新后通过 bridge 重新拉取。
- task executor 的 workspace 隔离是关键：每个任务在独立目录执行，修改 workspace 管理逻辑会影响任务隔离性。
- 使用 npm run dev:electron 启动开发模式，src/ui/dev-electron-shim.ts 提供了 Electron API 的开发替身，适合纯前端调试。

## 按任务阅读

### 修改知识库生成流程

knowledge-indexer 是生成主链路（切块→embedding→索引），knowledge-repository 定义存储 schema，knowledge-overview 负责注入 runner 的 system prompt。三层联动，缺一不可。

文件：`src/electron/libs/knowledge/knowledge-indexer.ts`, `src/electron/libs/knowledge/knowledge-repository.ts`, `src/electron/libs/knowledge/knowledge-overview.ts`

### 新增 IPC 通道

main.ts 注册 ipcMain.handle，ipc-handlers.ts 实现处理逻辑，types.ts 声明事件类型。必须同步修改才能通过类型检查。

文件：`src/electron/main.ts`, `src/electron/ipc-handlers.ts`, `src/ui/types.ts`

### 给 Agent 增加新工具

registry 定义工具元数据（名称、schema），mcp-tools 实现工具逻辑，builtin-mcp-servers.ts 将工具包装成真实 MCP server。runner.ts 调用这些 server。

文件：`src/shared/builtin-mcp-registry.ts`, `src/electron/libs/mcp-tools/*.ts`, `src/electron/libs/builtin-mcp-servers.ts`

### 修改任务执行策略

executor 负责并发、重试、恢复，types 定义状态流转，workspace.ts 管理任务隔离目录。修改调度逻辑看这三层。

文件：`src/electron/libs/task/executor.ts`, `src/electron/libs/task/types.ts`, `src/electron/libs/task/workspace.ts`

### 修改 UI 事件响应

useAppStore 是 Zustand 状态容器，接收主进程事件并更新视图。types 定义事件类型，App.tsx 是渲染入口和事件注册处。

文件：`src/ui/store/useAppStore.ts`, `src/ui/types.ts`, `src/ui/App.tsx`
