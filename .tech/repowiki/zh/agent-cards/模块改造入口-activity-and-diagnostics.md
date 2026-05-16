# 模块改造入口：activity-and-diagnostics

<agent_card id="module-activity-and-diagnostics" kind="module">

## 什么时候用
当任务落在 activity-and-diagnostics 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/ui/components/SessionAnalysisPage.tsx`: 保存 UI 或运行态状态
- `src/ui/components/ActivityRail.tsx`: 保存 UI 或运行态状态

## 相关文件
- `src/ui/components/SessionAnalysisPage.tsx`
- `src/ui/components/ActivityRail.tsx`

## 改代码指南
- 先确认需求是否真的属于 activity-and-diagnostics，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build
- npm run qa:knowledge-ui

## 风险点
- UI 状态不能只存在前端内存，刷新后必须能从后端恢复。

## 检索关键词
activity-and-diagnostics, SessionAnalysisPage.tsx, store:SessionAnalysisPage, ActivityRail.tsx, store:ActivityRail

## 代码信号
- store:SessionAnalysisPage
- store:ActivityRail

</agent_card>
