# 模块改造入口：electron

<agent_card id="module-electron" kind="module">

## 什么时候用
当任务落在 electron 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/electron/types.ts`: 被依赖较多或包含关键导出
- `src/electron/libs/codex-oauth.ts`: 被依赖较多或包含关键导出
- `src/electron/browser-manager.ts`: 被依赖较多或包含关键导出
- `src/electron/libs/figma-official-plugin.ts`: 被依赖较多或包含关键导出
- `src/electron/libs/image-preprocessor.ts`: 被依赖较多或包含关键导出
- `src/electron/libs/note-types.ts`: 被依赖较多或包含关键导出

## 相关文件
- `src/electron/types.ts`
- `src/electron/libs/codex-oauth.ts`
- `src/electron/browser-manager.ts`
- `src/electron/libs/figma-official-plugin.ts`
- `src/electron/libs/image-preprocessor.ts`
- `src/electron/libs/note-types.ts`
- `src/electron/libs/learning-store.ts`
- `src/electron/libs/idea-launcher.ts`
- `src/electron/libs/memory/memory-repository.ts`
- `src/electron/libs/claude-settings.ts`

## 改代码指南
- 先确认需求是否真的属于 electron，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build
- npm run qa:knowledge

## 风险点
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。
- 数据库 schema 变更要考虑旧数据和向量维度。

## 检索关键词
electron, types.ts, event:user_prompt, event:builtin, event:stream.message, event:stream.user_prompt, event:session.status, event:session.plan.updated, event:session.workflow, event:session.workflow.catalog, codex-oauth.ts, event:text, event:tool_use, event:message, event:codex, event:output_text, event:message_start, event:content_block_start, event:content_block_delta, browser-manager.ts, event:image, event:browser.state, event:browser.console, event:browser.annotation

## 代码信号
- event:user_prompt
- event:builtin
- event:stream.message
- event:stream.user_prompt
- event:session.status
- event:session.plan.updated
- event:session.workflow
- event:session.workflow.catalog
- event:text
- event:tool_use
- event:message
- event:codex
- event:output_text
- event:message_start
- event:content_block_start
- event:content_block_delta
- event:text
- event:image
- event:browser.state
- event:browser.console
- event:browser.annotation
- event:char
- event:http
- event:desktop-mcp
- event:figma-rest-api
- event:input_text
- event:input_image
- event:text
- event:image
- event:base64
- event:image_url
- event:note.list
- event:note.created
- event:note.updated
- event:note.deleted
- event:note.error
- event:note.create
- event:note.get
- event:note.update
- database:learnings

</agent_card>
