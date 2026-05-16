# Agent 问答：刷新后生成状态为什么不能丢？

<agent_card id="question-刷新后生成状态为什么不能丢" kind="agent_question">

## 什么时候用
前端状态只是展示层，真实状态必须落在 knowledge_ui_generation 和 knowledge_ui_documents；KnowledgePanel 要通过 bridge 重新拉取后端状态。

## 修改入口
- `src/ui/components/KnowledgePanel.tsx`: 回答该问题的证据文件
- `src/electron/libs/knowledge/knowledge-ui-store.ts`: 回答该问题的证据文件

## 相关文件
- `src/ui/components/KnowledgePanel.tsx`
- `src/electron/libs/knowledge/knowledge-ui-store.ts`

## 改代码指南
- 先读取证据文件，再用当前代码验证这个回答是否仍然成立。
- 如果答案涉及运行态，必须用真实 app/QA 命令复核。

## 已知问答
问：刷新后生成状态为什么不能丢？

答：前端状态只是展示层，真实状态必须落在 knowledge_ui_generation 和 knowledge_ui_documents；KnowledgePanel 要通过 bridge 重新拉取后端状态。

## 验证方式
- npm run build
- npm run qa:knowledge
- npm run qa:knowledge-chat
- npm run qa:knowledge-ui

## 风险点
- 知识库依赖 embedding 模型，不能只靠 FTS5 宣称可用。
- 生成产物、UI DB、知识索引 DB 三者可能不同步。
- UI 状态不能只存在前端内存，刷新后必须能从后端恢复。
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。

## 检索关键词
刷新后生成状态为什么不能丢？, KnowledgePanel.tsx, knowledge-ui-store.ts

</agent_card>
