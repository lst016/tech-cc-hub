# 模块改造入口：sdk-package

<agent_card id="module-sdk-package" kind="module">

## 什么时候用
当任务落在 sdk-package 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `package/sdk.d.ts`: 被依赖较多或包含关键导出
- `package/sdk-tools.d.ts`: 被依赖较多或包含关键导出
- `package/package.json`: 配置文件，会影响运行、构建或模型能力
- `package/README.md`: 配置文件，会影响运行、构建或模型能力

## 相关文件
- `package/sdk.d.ts`
- `package/sdk-tools.d.ts`
- `package/package.json`
- `package/README.md`

## 改代码指南
- 先确认需求是否真的属于 sdk-package，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build

## 风险点
- MCP 注册、工厂映射和 tool handler 任一缺失都会导致 Agent 调用失败。

## 检索关键词
sdk-package, sdk.d.ts, event:error, event:success, event:json_schema, event:claudeai-proxy, event:http, event:sdk, event:sse, event:preset, sdk-tools.d.ts, event:text, event:image, event:notebook, event:pdf, event:parts, event:file_unchanged, event:create, event:code, package.json, config:package/package.json, README.md, config:package/README.md

## 代码信号
- event:error
- event:success
- event:json_schema
- event:claudeai-proxy
- event:http
- event:sdk
- event:sse
- event:preset
- event:text
- event:image
- event:notebook
- event:pdf
- event:parts
- event:file_unchanged
- event:create
- event:code
- config:package/package.json
- config:package/README.md

</agent_card>
