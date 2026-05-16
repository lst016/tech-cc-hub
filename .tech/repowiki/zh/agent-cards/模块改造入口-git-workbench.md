# 模块改造入口：git-workbench

<agent_card id="module-git-workbench" kind="module">

## 什么时候用
当任务落在 git-workbench 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/electron/libs/git/types.ts`: 被依赖较多或包含关键导出
- `src/electron/libs/git/README.md`: 配置文件，会影响运行、构建或模型能力

## 相关文件
- `src/electron/libs/git/types.ts`
- `src/electron/libs/git/README.md`

## 改代码指南
- 先确认需求是否真的属于 git-workbench，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build
- npm run qa:knowledge

## 风险点
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。

## 检索关键词
git-workbench, types.ts, README.md, config:src/electron/libs/git/README.md

## 代码信号
- config:src/electron/libs/git/README.md

</agent_card>
