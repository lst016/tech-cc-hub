# 模块改造入口：tests

<agent_card id="module-tests" kind="module">

## 什么时候用
当任务落在 tests 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `test/electron/activity-rail-model.test.ts`: 被依赖较多或包含关键导出
- `test/electron/codex-oauth-provider.test.ts`: 被依赖较多或包含关键导出

## 相关文件
- `test/electron/activity-rail-model.test.ts`
- `test/electron/codex-oauth-provider.test.ts`

## 改代码指南
- 先确认需求是否真的属于 tests，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build

## 风险点
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。

## 检索关键词
tests, activity-rail-model.test.ts, event:assistant, event:tool_use, event:user, event:tool_result, event:user_prompt, event:text, event:message, event:system, codex-oauth-provider.test.ts, event:codex, event:object, event:string, event:output_text

## 代码信号
- event:assistant
- event:tool_use
- event:user
- event:tool_result
- event:user_prompt
- event:text
- event:message
- event:system
- event:codex
- event:text
- event:tool_use
- event:tool_result
- event:object
- event:string
- event:message
- event:output_text

</agent_card>
