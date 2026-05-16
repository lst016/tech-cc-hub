# 模块改造入口：root

<agent_card id="module-root" kind="module">

## 什么时候用
当任务落在 root 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `vite.config.ts`: 开发服务、预览构建和 watcher 忽略目录配置
- `package.json`: 开发、构建、QA、打包命令和关键依赖来源
- `types.d.ts`: 被依赖较多或包含关键导出

## 相关文件
- `vite.config.ts`
- `package.json`
- `types.d.ts`

## 改代码指南
- 先确认需求是否真的属于 root，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build
- npm run qa:knowledge-ui

## 风险点
- 改动前先确认入口文件和真实运行面，避免只根据文档猜测。

## 检索关键词
root, vite.config.ts, config:vite.config.ts, event:file, package.json, config:package.json, types.d.ts, event:text, event:image, event:browser.state, event:browser.console, event:browser.annotation, event:directory

## 代码信号
- config:vite.config.ts
- event:file
- config:package.json
- event:text
- event:image
- event:browser.state
- event:browser.console
- event:browser.annotation
- event:directory
- event:file

</agent_card>
