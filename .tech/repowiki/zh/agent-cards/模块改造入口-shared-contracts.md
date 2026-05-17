# 模块改造入口：shared-contracts

<agent_card id="module-shared-contracts" kind="module">

## 什么时候用
当任务落在 shared-contracts 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/shared/slash-commands.ts`: 被依赖较多或包含关键导出
- `src/shared/attachments.ts`: 保存 UI 或运行态状态
- `src/shared/prompt-ledger.ts`: 被依赖较多或包含关键导出
- `src/shared/activity-rail-model.ts`: 被依赖较多或包含关键导出
- `src/shared/claude-agent-teams.ts`: 被依赖较多或包含关键导出
- `src/shared/workflow-markdown.ts`: 被依赖较多或包含关键导出

## 相关文件
- `src/shared/slash-commands.ts`
- `src/shared/attachments.ts`
- `src/shared/prompt-ledger.ts`
- `src/shared/activity-rail-model.ts`
- `src/shared/claude-agent-teams.ts`
- `src/shared/workflow-markdown.ts`
- `src/shared/plan-progress.ts`

## 改代码指南
- 先确认需求是否真的属于 shared-contracts，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build

## 风险点
- 改动前先确认入口文件和真实运行面，避免只根据文档猜测。

## 检索关键词
shared-contracts, slash-commands.ts, attachments.ts, event:user_prompt, event:text, event:image, event:base64, store:attachments, prompt-ledger.ts, event:prompt_ledger, activity-rail-model.ts, claude-agent-teams.ts, workflow-markdown.ts, plan-progress.ts

## 代码信号
- event:user_prompt
- event:text
- event:image
- event:base64
- store:attachments
- event:prompt_ledger
- event:user_prompt

</agent_card>
