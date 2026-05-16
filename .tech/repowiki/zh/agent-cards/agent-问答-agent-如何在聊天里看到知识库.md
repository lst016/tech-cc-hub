# Agent 问答：Agent 如何在聊天里看到知识库？

<agent_card id="question-agent-如何在聊天里看到知识库" kind="agent_question">

## 什么时候用
runner 拼 system prompt 时追加 knowledge-overview 生成的 XML 摘要，Agent 先看到标题/摘要，再按需用知识库工具或 UI 内容深取。

## 修改入口
- `src/electron/libs/runner.ts`: 回答该问题的证据文件
- `src/electron/libs/knowledge/knowledge-overview.ts`: 回答该问题的证据文件

## 相关文件
- `src/electron/libs/runner.ts`
- `src/electron/libs/knowledge/knowledge-overview.ts`

## 改代码指南
- 先读取证据文件，再用当前代码验证这个回答是否仍然成立。
- 如果答案涉及运行态，必须用真实 app/QA 命令复核。

## 已知问答
问：Agent 如何在聊天里看到知识库？

答：runner 拼 system prompt 时追加 knowledge-overview 生成的 XML 摘要，Agent 先看到标题/摘要，再按需用知识库工具或 UI 内容深取。

## 验证方式
- npm run build
- npm run qa:knowledge
- npm run qa:knowledge-chat
- npm run qa:knowledge-ui

## 风险点
- 知识库依赖 embedding 模型，不能只靠 FTS5 宣称可用。
- 生成产物、UI DB、知识索引 DB 三者可能不同步。
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。

## 检索关键词
Agent 如何在聊天里看到知识库？, runner.ts, knowledge-overview.ts

</agent_card>
