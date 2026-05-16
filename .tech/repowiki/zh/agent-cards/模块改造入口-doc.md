# 模块改造入口：doc

<agent_card id="module-doc" kind="module">

## 什么时候用
当任务落在 doc 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `doc/adr/README.md`: 配置文件，会影响运行、构建或模型能力
- `doc/README.md`: 配置文件，会影响运行、构建或模型能力

## 相关文件
- `doc/adr/README.md`
- `doc/README.md`

## 改代码指南
- 先确认需求是否真的属于 doc，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build

## 风险点
- 改动前先确认入口文件和真实运行面，避免只根据文档猜测。

## 检索关键词
doc, README.md, config:doc/adr/README.md, config:doc/README.md

## 代码信号
- config:doc/adr/README.md
- config:doc/README.md

</agent_card>
