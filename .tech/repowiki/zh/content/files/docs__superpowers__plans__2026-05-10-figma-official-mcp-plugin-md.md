# docs/superpowers/plans/2026-05-10-figma-official-mcp-plugin.md

> 模块：`docs` · 语言：`markdown` · 行数：814

## 文件职责

Figma 官方 MCP 插件的详细实现计划，包含架构设计、文件结构、需要创建或修改的文件清单，以及具体的 Task 步骤

## 关键符号

- `superpowers:subagent-driven-development@0 - 子代理驱动开发模式，用于分配任务给子代理`
- `superpowers:executing-plans@0 - 执行计划模式，直接按步骤执行计划`
- `Chunk 1: 外部 MCP 解析层@0 - 计划的第一部分，定义外部 MCP 服务器的解析逻辑`
- `external-mcp-servers.ts@0 - 需要新建的运行时 helper，负责解析全局 mcpServers，支持 stdio 和 HTTP 两种 transport`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Figma 官方 MCP 插件 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 tech-cc-hub 中以插件级体验接入 Figma 官方远程 MCP，第一版支持“Figma 链接/Frame -> 设计上下文 -> UI 实现”工作流，并对授权过期做明确提醒。

**Architecture:** 新增一个聚焦外部 MCP 配置解析的运行时 helper，让 runner、IPC 列表和测试共用同一套 stdio/http 归一化逻辑。Figma 插件沿用 Open Computer Use 的插件页和 IPC 形态，但只做轻量抽象，不重写 SettingsModal 或完整插件系统。UI 侧展示 Figma 官方插件卡片、HTTP MCP 状态和 token 过期/重新授权提示。

**Tech Stack:** Electron main process, React 19, TypeScript, `@anthropic-ai/claude-agent-sdk`, Node test runner, Vite.

---

## 参考文档

- Spec: `docs/superpowers/specs/2026-05-10-figma-official-mcp-plugin-design.md`
- Figma 官方 MCP URL: `https://mcp.figma.com/mcp`
- 推荐配置 key: `plugins["figma-official"]` 和 `mcpServers.figma`

## 文件结构

- Create: `src/electron/libs/external-mcp-servers.ts`
  - 负责解析全局 `mcpServers`，支持 stdio 和 HTTP，跳过 disabled/invalid 条目。
  - 导出 `getExternalMcpServers`、`listExternalMcpServerInfos`、`isConfiguredExternalMcpTool` 和纯函数测试入口。
- Modify: `src/electron/libs/runner.ts`
  - 删除本地外部 MCP 解析重复逻辑。
  - 使用 `external-mcp-servers.ts` 结果传给 SDK。
  - 保持 `allowedTools="*"` 和外部 MCP 工具放行语义。
- Modify: `src/electron/ipc-handlers.ts`
  - `mcp.list` 使用 `listExternalMcpServerInfos`，让 MCP 设置页能收到 HTTP URL/transport。
- Modify: `src/electron/types.ts`
  - 扩展 `McpServerInfo`，加入 `transport?: "stdio" | "http"`、`url?: string`。
- Modify: `src/ui/types.ts`
  - 同步扩展 UI 侧 `McpServerInfo`。
- Modify: `src/electron/main.ts`
  - 增加 Figma 插件 status/install/repair 逻辑。
  - 增加 IPC：`plugins:getFigmaOfficialStatus`、`plugins:installFigmaOfficial`。
  - dev bridge 里同步支持这两个 channel。
- Modify: `src/ui/components/settings/PluginsSettingsPage.tsx`
  - 默认插件列表增加 `figma-official`。
  - 为 Open Computer Use 和 Figma 分流状态读取、安装动作和 guide prompt。
  - 展示 Figma remote MCP URL、能力和授权过期提醒。
- Modify: `src/ui/components/settings/McpSettingsPage.tsx`
  - 外部 MCP 卡片按 `transport=http` 展示 URL；stdio 保持 command/args/env。
- Modify: `src/ui/components/settings/plugin-toast-messages.ts`
  - 如果需要，扩展 toast 输入以支持 auth hint；保持 Open Computer Use 文案不变。
- Test: `test/electron/external-mcp-servers.test.ts`
  - 覆盖 stdio/http/disabled/invalid/工具放行。
- Test: `test/electron/figma-official-plugin.test.ts`
  - 覆盖 Figma 配置写入和状态归类。
- Modify Test: `test/electron/plugin-updates.test.ts`
  - 更新插件页源码断言，确认默认插件包含 Figma。

---

## Chunk 1: 外部 MCP 解析层

### Task 1: 验证 SDK MCP HTTP 配置形态

**Files:**
- Read: `node_modules/@anthropic-ai/claude-agent-sdk`
- Read: `src/electron/libs/runner.ts`

- [ ] **Step 1: 查 SDK 类型**

Run:

```bash
rg -n "mcpServers|McpSdkServerConfig|transport|type.*http|url" node_modules/@anthropic-ai/claude-agent-sdk
```

Expected: 找到 SDK 接受的 remote/http MCP server 配置字段。如果 worktree 没有 `node_modules`，先在项目根或安装依赖后再查。

- [ ] **Step 2: 记录最终适配字段**

在实现时选择 SDK 当前支持的形态。例如如果 SDK 接受：

```ts
{
  type: "http",
  url: "https://mcp.figma.com/mcp"
}
```

则 parser 直接输出该形态；如果 SDK 使用 `transport` 字段，则只在 parser 输出边界适配，不改变全局 `agent-runtime.json` schema。

### Task 2: 为外部 MCP parser 写失败测试

**Files:**
- Create: `test/electron/external-mcp-servers.test.ts`
- Create: `src/electron/libs/external-mcp-servers.ts`

- [ ] **Step 1: 创建空实现文件**

先创建只导出占位函数的文件，方便测试导入：

```ts
export type ExternalMcpServerInfo = {
  name: string;
  type: "external";
  transport: "stdio" | "http";
  command: string;
  args: string[];
  url?: string;
  envKeys: string[];
  enabled: boolean;
};

export function parseExternalMcpServers(_config: unknown): Record<string, unknown> {
  return {};
}

export function listExternalMcpServerInfos(_config: unknown): ExternalMcpServerInfo[] {
  return [];
}

export function isConfiguredExternalMcpTool(_toolName: string, _config: unknown): boolean {
  return false;
}
```

- [ ] **Step 2: 写 parser 测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  isConfiguredExternalMcpTool,
  listExternalMcpServerInfos,
  parseExternalMcpServers,
} from "../../src/electron/libs/external-mcp-servers.js";

test("parses stdio and http external MCP servers", () => {
  const config = {
    mcpServers: {
      "open-computer-use"
... (truncated)
```
