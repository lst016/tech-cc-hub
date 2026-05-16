# 模块改造入口：ui-shell

<agent_card id="module-ui-shell" kind="module">

## 什么时候用
当任务落在 ui-shell 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/ui/types.ts`: 被依赖较多或包含关键导出
- `src/ui/App.tsx`: 入口文件，适合从这里跟踪启动链路
- `src/ui/components/PromptInput.tsx`: 定义或调用跨进程接口
- `src/ui/components/TaskPanel.tsx`: 保存 UI 或运行态状态
- `src/ui/dev-electron-shim.ts`: 被依赖较多或包含关键导出
- `src/ui/components/git/git-ui-utils.ts`: 被依赖较多或包含关键导出

## 相关文件
- `src/ui/types.ts`
- `src/ui/App.tsx`
- `src/ui/components/PromptInput.tsx`
- `src/ui/components/TaskPanel.tsx`
- `src/ui/dev-electron-shim.ts`
- `src/ui/components/git/git-ui-utils.ts`
- `src/ui/components/EventCard.tsx`
- `src/ui/components/ModelSelect.tsx`
- `src/ui/components/AionWorkspacePreviewPane.tsx`
- `src/ui/components/cron/ScheduledTasksPage.tsx`

## 改代码指南
- 先确认需求是否真的属于 ui-shell，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build
- npm run qa:knowledge-ui
- npm run qa:knowledge

## 风险点
- UI 状态不能只存在前端内存，刷新后必须能从后端恢复。
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。

## 检索关键词
ui-shell, types.ts, event:user_prompt, event:stream.message, event:stream.user_prompt, event:session.status, event:session.plan.updated, event:session.workflow, event:session.workflow.catalog, event:session.list, App.tsx, entrypoint:src/ui/App.tsx, ui_ipc:sessions:list, ui_ipc:shell:openExternal, event:separator, event:message, event:process_group, event:session.history, PromptInput.tsx, ui_ipc:slash-commands:list, event:browser_annotations, event:browser_annotation, event:text, event:code_references

## 代码信号
- event:user_prompt
- event:stream.message
- event:stream.user_prompt
- event:session.status
- event:session.plan.updated
- event:session.workflow
- event:session.workflow.catalog
- event:session.list
- entrypoint:src/ui/App.tsx
- ui_ipc:sessions:list
- ui_ipc:shell:openExternal
- event:separator
- event:message
- event:process_group
- event:session.history
- event:session.list
- ui_ipc:slash-commands:list
- event:browser_annotations
- event:browser_annotation
- event:text
- event:code_references
- event:message_references
- event:file_references
- event:session.start
- event:task.list
- event:task.stats
- event:task.settings.get
- event:task.providers
- event:task.execution.logs
- event:task.sync
- event:task.execute
- event:task.control
- event:session.list
- event:session.history
- event:user_prompt
- event:agent.list
- event:mcp.list
- event:builtin
- event:user_prompt
- event:tool_use

</agent_card>
