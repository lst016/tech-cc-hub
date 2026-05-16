# Agent 问答：为什么知识库功能必须有 embedding 模型？

<agent_card id="question-为什么知识库功能必须有-embedding-模型" kind="agent_question">

## 什么时候用
knowledge-indexer 在缺少 embedding 设置时直接返回 missing-embedding-model，设计上不允许只开 FTS5；上线验证要检查 vectorStoreReady、FTS 行数和 vector 行数一致。

## 修改入口
- `src/electron/libs/knowledge/knowledge-indexer.ts`: 回答该问题的证据文件
- `src/electron/libs/knowledge/embedding-client.ts`: 回答该问题的证据文件
- `src/electron/libs/knowledge/knowledge-repository.ts`: 回答该问题的证据文件

## 相关文件
- `src/electron/libs/knowledge/knowledge-indexer.ts`
- `src/electron/libs/knowledge/embedding-client.ts`
- `src/electron/libs/knowledge/knowledge-repository.ts`

## 改代码指南
- 先读取证据文件，再用当前代码验证这个回答是否仍然成立。
- 如果答案涉及运行态，必须用真实 app/QA 命令复核。

## 已知问答
问：为什么知识库功能必须有 embedding 模型？

答：knowledge-indexer 在缺少 embedding 设置时直接返回 missing-embedding-model，设计上不允许只开 FTS5；上线验证要检查 vectorStoreReady、FTS 行数和 vector 行数一致。

## 验证方式
- npm run build
- npm run qa:knowledge
- npm run qa:knowledge-chat
- npm run qa:knowledge-ui

## 风险点
- 知识库依赖 embedding 模型，不能只靠 FTS5 宣称可用。
- 生成产物、UI DB、知识索引 DB 三者可能不同步。
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。
- 数据库 schema 变更要考虑旧数据和向量维度。

## 检索关键词
为什么知识库功能必须有 embedding 模型？, knowledge-indexer.ts, embedding-client.ts, knowledge-repository.ts

</agent_card>
