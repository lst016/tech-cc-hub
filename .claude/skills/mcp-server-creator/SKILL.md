---
name: mcp-server-creator
description: SOP for creating new MCP Server tools in tech-cc-hub. Use when the user asks to expose a capability as MCP tools, "封装成系统 tools", "add MCP server", or wrap internal APIs for Agent use.
---

# MCP Server 封装 SOP

在 tech-cc-hub 中新增 MCP Server 的标准流程。每个 Phase 必须中断确认后才能进入下一 Phase。

## Phase 设计原则

- 每 Phase 最多写入 3 个文件
- 每个 Phase 必须以 `npm run build && npm run transpile:electron` 检验通过结束
- Phase 间必须中断，等用户说"继续"才能推进

## Phase 1 — 探查（只读，无需中断）

1. 并发 Read 三个文件：
   - `src/electron/libs/runner.ts` — 定位 `ALWAYS_ALLOWED_TOOLS`（第 63 行附近）和 `mcpServers` 注册区（第 312 行附近）
   - `src/electron/main.ts` — 定位现有 MCP setter 调用（如 `setCronService`），判断是否需要依赖注入
   - 一个现有 MCP 工具文件（如 `src/electron/libs/mcp-tools/cron.ts`）作为模板参考

2. 输出：需要修改的精确位置（行号）、新工具列表、参数 schema 草案。等待用户确认。

## Phase 2 — 创建工具文件

1. 新建 `src/electron/libs/mcp-tools/<name>.ts`，按模板结构：
   ```typescript
   // 来源：tech-cc-hub 内部 MCP 工具模板
   import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
   import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
   import { z } from "zod";

   export const <NAME>_TOOL_NAMES = ["tool_a", "tool_b"] as const;
   const <NAME>_TOOLS_SERVER_NAME = "tech-cc-hub-<name>";
   const <NAME>_MCP_SERVER_VERSION = "1.0.0";

   // 如需依赖注入
   let serviceRef: SomeService | null = null;
   let mcpServer: McpSdkServerConfigWithInstance | null = null;
   export function set<Name>Service(service: SomeService): void { serviceRef = service; }

   function toTextToolResult(payload: unknown, isError = false): CallToolResult {
     return { isError, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
   }

   export function create<Name>McpServer(): McpSdkServerConfigWithInstance {
     if (mcpServer) return mcpServer;
     mcpServer = createSdkMcpServer({
       name: <NAME>_TOOLS_SERVER_NAME,
       version: <NAME>_MCP_SERVER_VERSION,
       tools: [
         tool({ name: "tool_a", description: "...", schema: z.object({...}), handler: async (args) => { ... } }),
       ],
     });
     return mcpServer;
   }
   ```

2. 每个工具必须包含：
   - Zod schema 校验所有输入参数
   - 安全边界（如 cron 限制 ≥60s、只能删除 Agent 创建的任务等）
   - handler 内 try/catch 返回 `isError: true`

3. 写入后运行 `npm run build && npm run transpile:electron`，中断并汇报。

## Phase 3 — 注册 + 注入

修改 2 个文件（并发写入）：

### runner.ts
- 顶部新增 `import { <NAME>_TOOL_NAMES, create<Name>McpServer } from "./libs/mcp-tools/<name>.js"`
- `ALWAYS_ALLOWED_TOOLS` 追加 `...<NAME>_TOOL_NAMES`
- `mcpServers` 对象中追加 `"tech-cc-hub-<name>": () => create<Name>McpServer()`

### main.ts（如需依赖注入）
- 新增 `import { set<Name>Service } from "./libs/mcp-tools/<name>.js"`
- 在对应 service 初始化后调用 `set<Name>Service(service)`

写入后运行 `npm run build && npm run transpile:electron`，中断并汇报注册位置。

## Phase 4 — QA 验证

1. 重启 `npm run dev`
2. 在聊天中让 Agent 调用新工具，确认调用成功
3. 在聊天中让 Agent 调用新工具但传入非法参数，确认 Zod 校验生效
4. 输出：工具名称、调用成功截图/日志、错误处理证据

## 命名约定

| 项目 | 约定 |
|------|------|
| 工具名 | `snake_case`（如 `create_scheduled_task`）|
| Server 名 | `tech-cc-hub-<kebab-case>`（如 `tech-cc-hub-cron`）|
| 导出常量 | `UPPER_SNAKE_TOOL_NAMES` |
| 创建函数 | `create<PascalCase>McpServer` |
| Setter | `set<PascalCase>Service` |

## 禁止行为

- 禁止一回合写完所有文件不中断
- 禁止跳过 `npm run build && npm run transpile:electron` 验证
- 禁止在未确认参数 schema 前就开始写 handler 代码
- 工具描述和错误信息使用中文
