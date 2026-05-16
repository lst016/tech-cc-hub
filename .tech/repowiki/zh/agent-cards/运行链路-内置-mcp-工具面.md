# 运行链路：内置 MCP 工具面

<agent_card id="flow-内置-mcp-工具面" kind="runtime_flow">

## 什么时候用
共享 registry 描述可见工具，Electron 工厂创建真实 MCP server；Agent 能调用 browser/design/git/knowledge/plan 等能力。

## 修改入口
- `src/shared/builtin-mcp-registry.ts`: 链路证据或修改入口
- `src/electron/libs/builtin-mcp-servers.ts`: 链路证据或修改入口
- `src/electron/libs/mcp-tools/browser.ts`: 链路证据或修改入口
- `src/electron/libs/mcp-tools/design.ts`: 链路证据或修改入口
- `src/electron/libs/mcp-tools/plan.ts`: 链路证据或修改入口

## 相关文件
- `src/shared/builtin-mcp-registry.ts`
- `src/electron/libs/builtin-mcp-servers.ts`
- `src/electron/libs/mcp-tools/browser.ts`
- `src/electron/libs/mcp-tools/design.ts`
- `src/electron/libs/mcp-tools/plan.ts`

## 改代码指南
- 先从 entryFiles 的第一个文件确认入口，再按 runtimeSteps 顺序追踪调用链。
- 改动跨 UI/Electron/索引/Runner 时，同步更新 IPC 契约、持久化状态和 QA 脚本。
- 如果该链路会进入 system prompt 或 MCP，必须验证新会话里的实际注入结果。

## 运行链路
1. shared registry 提供 server 和 tool 元数据
2. builtin-mcp-servers 映射 server name 到工厂函数
3. runner 根据 runtime config 加载 MCP server
4. 工具处理器访问 BrowserView、Git、设计分析或知识库服务

## 验证方式
- npm run build
- npm run qa:knowledge

## 风险点
- UI 状态不能只存在前端内存，刷新后必须能从后端恢复。
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。
- MCP 注册、工厂映射和 tool handler 任一缺失都会导致 Agent 调用失败。

## 检索关键词
内置 MCP 工具面, builtin-mcp-registry.ts, builtin-mcp-servers.ts, browser.ts, design.ts, plan.ts

</agent_card>
