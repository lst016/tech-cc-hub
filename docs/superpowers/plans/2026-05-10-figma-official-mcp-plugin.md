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
      "open-computer-use": { type: "stdio", command: "open-computer-use", args: ["mcp"], env: { A: "1" } },
      figma: { type: "http", url: "https://mcp.figma.com/mcp", enabled: true },
    },
  };

  const parsed = parseExternalMcpServers(config);
  assert.equal(Object.keys(parsed).includes("open-computer-use"), true);
  assert.equal(Object.keys(parsed).includes("figma"), true);

  const infos = listExternalMcpServerInfos(config);
  assert.deepEqual(infos.map((item) => item.name), ["open-computer-use", "figma"]);
  assert.equal(infos.find((item) => item.name === "figma")?.transport, "http");
  assert.equal(infos.find((item) => item.name === "figma")?.url, "https://mcp.figma.com/mcp");
});

test("skips disabled and invalid external MCP entries", () => {
  const config = {
    mcpServers: {
      disabled: { type: "http", url: "https://example.com/mcp", enabled: false },
      badHttp: { type: "http" },
      badStdio: { type: "stdio" },
      legacy: { command: "legacy-mcp" },
    },
  };

  const infos = listExternalMcpServerInfos(config);
  assert.deepEqual(infos.map((item) => item.name), ["legacy"]);
  assert.equal(infos[0]?.transport, "stdio");
});

test("allows tools from configured external MCP server names", () => {
  const config = { mcpServers: { figma: { type: "http", url: "https://mcp.figma.com/mcp" } } };

  assert.equal(isConfiguredExternalMcpTool("mcp__figma__get_code", config), true);
  assert.equal(isConfiguredExternalMcpTool("figma__get_code", config), true);
  assert.equal(isConfiguredExternalMcpTool("figma:get_code", config), true);
  assert.equal(isConfiguredExternalMcpTool("other:get_code", config), false);
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/external-mcp-servers.test.js
```

Expected: FAIL，因为实现仍是占位。

### Task 3: 实现外部 MCP parser

**Files:**
- Modify: `src/electron/libs/external-mcp-servers.ts`

- [ ] **Step 1: 实现纯 parser**

实现要点：

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRawMcpServers(config: unknown): Record<string, unknown> {
  return isRecord(config) && isRecord(config.mcpServers) ? config.mcpServers : {};
}
```

解析规则：

- `enabled === false` 跳过。
- `type === "http"` 且 `url` 是非空字符串，输出 HTTP server。
- `type` 缺失但 `command` 存在，按 stdio。
- stdio 输出 `type: "stdio"`、`command`、`args`、`env`。
- HTTP 输出以 Task 1 验证的 SDK 类型为准。

- [ ] **Step 2: 实现 list 和 allow helper**

`listExternalMcpServerInfos` 输出 UI 需要的字段：

```ts
{
  name,
  type: "external",
  transport: "http",
  command: "",
  args: [],
  url,
  envKeys: [],
  enabled: true
}
```

`isConfiguredExternalMcpTool` 复用已解析 server names，支持：

- `mcp__${serverName}__`
- `${serverName}__`
- `${serverName}:`
- `${serverName}/`

- [ ] **Step 3: 运行测试确认通过**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/external-mcp-servers.test.js
```

Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/electron/libs/external-mcp-servers.ts test/electron/external-mcp-servers.test.ts
git commit -m "feat: parse http external mcp servers"
```

---

## Chunk 2: runner 和 MCP 设置列表接入

### Task 4: runner 使用共享外部 MCP parser

**Files:**
- Modify: `src/electron/libs/runner.ts`
- Test: `test/electron/external-mcp-servers.test.ts`

- [ ] **Step 1: 删除 runner 内本地 `ExternalMcpServer` 和 `getExternalMcpServers`**

从 `runner.ts` 移除重复解析逻辑，改为导入：

```ts
import {
  getExternalMcpServers,
  isConfiguredExternalMcpTool,
} from "./external-mcp-servers.js";
```

- [ ] **Step 2: 更新 runner 调用**

在 `mcpServers` 传入处保持：

```ts
mcpServers: {
  ...getExternalMcpServers(),
  ...builtinMcpServers,
},
```

在 `isAlwaysAllowedTool` 中保留：

```ts
if (isConfiguredExternalMcpTool(toolName)) {
  return true;
}
```

- [ ] **Step 3: 运行构建型检查**

Run:

```bash
npm run transpile:electron
```

Expected: PASS。

### Task 5: MCP list IPC 支持 HTTP 外部 MCP

**Files:**
- Modify: `src/electron/ipc-handlers.ts`
- Modify: `src/electron/types.ts`
- Modify: `src/ui/types.ts`

- [ ] **Step 1: 扩展类型**

把两处 `McpServerInfo` 扩展为：

```ts
export type McpServerInfo = {
  name: string;
  type: "builtin" | "external";
  transport?: "stdio" | "http";
  command: string;
  args: string[];
  url?: string;
  envKeys: string[];
  enabled: boolean;
};
```

- [ ] **Step 2: 更新 IPC**

在 `ipc-handlers.ts` 的 `mcp.list` 分支中，用：

```ts
const external = listExternalMcpServerInfos(config);
```

替代手写遍历。

- [ ] **Step 3: 更新 MCP 设置页显示**

**Files:**
- Modify: `src/ui/components/settings/McpSettingsPage.tsx`

在外部 server 展开区：

```tsx
{server.transport === "http" ? (
  <div className="space-y-2">
    <DetailRow label="类型" value="http" mono />
    {server.url && <DetailRow label="URL" value={server.url} mono />}
  </div>
) : (
  <div className="space-y-2">
    <DetailRow label="命令" value={server.command} mono />
    {server.args.length > 0 && <DetailRow label="参数" value={server.args.join(" ")} mono />}
    {server.envKeys.length > 0 && (
      <div>
        <span className="text-xs font-medium text-ink-500">环境变量</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {server.envKeys.map((key) => (
            <code key={key} className="rounded-md bg-surface-secondary px-2 py-0.5 text-xs text-ink-600">{key}=***</code>
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

卡片摘要里 HTTP server 显示 `HTTP · ${server.url}`，stdio 仍显示 `server.command`。

- [ ] **Step 4: 运行检查**

Run:

```bash
npm run transpile:electron
npm run build
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/electron/libs/runner.ts src/electron/ipc-handlers.ts src/electron/types.ts src/ui/types.ts src/ui/components/settings/McpSettingsPage.tsx
git commit -m "feat: surface http mcp servers in runtime"
```

---

## Chunk 3: Figma 官方插件状态和 IPC

### Task 6: 写 Figma 插件状态测试

**Files:**
- Create: `test/electron/figma-official-plugin.test.ts`
- Modify: `src/electron/main.ts`

- [ ] **Step 1: 先提取可测试 helper**

在 `src/electron/main.ts` 或新建 helper 前，计划实现并导出这些纯函数：

```ts
export function buildFigmaOfficialPluginConfig(now = Date.now()): Record<string, unknown>;
export function buildFigmaOfficialMcpConfig(): Record<string, unknown>;
export function getFigmaOfficialPluginStatusFromConfig(config: unknown): FigmaOfficialPluginStatus;
export function connectFigmaOfficialPlugin(now = Date.now()): FigmaOfficialPluginActionResult;
```

如果 `main.ts` 继续变大，优先新建 `src/electron/libs/figma-official-plugin.ts`，然后 `main.ts` 只负责 IPC 注册。

- [ ] **Step 2: 写测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFigmaOfficialMcpConfig,
  buildFigmaOfficialPluginConfig,
  getFigmaOfficialPluginStatusFromConfig,
} from "../../src/electron/libs/figma-official-plugin.js";

test("builds official Figma remote MCP config", () => {
  assert.deepEqual(buildFigmaOfficialMcpConfig(), {
    type: "http",
    url: "https://mcp.figma.com/mcp",
    enabled: true,
  });
});

test("detects missing, configured, and misconfigured Figma plugin status", () => {
  assert.equal(getFigmaOfficialPluginStatusFromConfig({}).status, "not-configured");

  const configured = {
    plugins: { "figma-official": buildFigmaOfficialPluginConfig(1000) },
    mcpServers: { figma: buildFigmaOfficialMcpConfig() },
  };
  assert.equal(getFigmaOfficialPluginStatusFromConfig(configured).status, "configured");

  const misconfigured = {
    plugins: { "figma-official": buildFigmaOfficialPluginConfig(1000) },
    mcpServers: { figma: { type: "stdio", command: "figma" } },
  };
  assert.equal(getFigmaOfficialPluginStatusFromConfig(misconfigured).status, "misconfigured");
});

test("detects Figma auth expiry hints without marking config broken", () => {
  const status = getFigmaOfficialPluginStatusFromConfig({
    plugins: {
      "figma-official": {
        ...buildFigmaOfficialPluginConfig(1000),
        authStatus: "auth-expired",
        lastAuthError: "401 unauthorized token expired",
      },
    },
    mcpServers: { figma: buildFigmaOfficialMcpConfig() },
  });

  assert.equal(status.status, "auth-expired");
  assert.match(status.authHint ?? "", /重新授权/);
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/figma-official-plugin.test.js
```

Expected: FAIL，helper 还不存在。

### Task 7: 实现 Figma 插件 helper 和 IPC

**Files:**
- Create: `src/electron/libs/figma-official-plugin.ts`
- Modify: `src/electron/main.ts`

- [ ] **Step 1: 实现 helper**

核心常量：

```ts
export const FIGMA_OFFICIAL_PLUGIN_ID = "figma-official";
export const FIGMA_MCP_SERVER_NAME = "figma";
export const FIGMA_MCP_URL = "https://mcp.figma.com/mcp";
```

状态结果：

```ts
export type FigmaOfficialPluginStatus = {
  id: "figma-official";
  installed: boolean;
  connected: boolean;
  status: "not-configured" | "configured" | "needs-auth" | "auth-expired" | "misconfigured" | "ready";
  message: string;
  authHint?: string;
  url: string;
  capabilities: string[];
  updatedAt?: number;
};
```

`connectFigmaOfficialPlugin` 要：

- `loadGlobalRuntimeConfig()`
- 保留当前 `plugins` 和 `mcpServers`
- 只写 `plugins["figma-official"]`
- 只写 `mcpServers.figma`
- `saveGlobalRuntimeConfig(next)`

- [ ] **Step 2: 在 main 注册 IPC**

新增：

```ts
ipcMain.handle("plugins:getFigmaOfficialStatus", () => getFigmaOfficialPluginStatus());
ipcMain.handle("plugins:installFigmaOfficial", () => connectFigmaOfficialPlugin());
```

dev bridge `invoke` 同步支持两个 channel。

- [ ] **Step 3: 运行测试**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/figma-official-plugin.test.js
```

Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/electron/libs/figma-official-plugin.ts src/electron/main.ts test/electron/figma-official-plugin.test.ts
git commit -m "feat: add figma official plugin config"
```

---

## Chunk 4: 插件设置页 UI

### Task 8: 插件页增加 Figma 卡片

**Files:**
- Modify: `src/ui/components/settings/PluginsSettingsPage.tsx`
- Modify: `test/electron/plugin-updates.test.ts`

- [ ] **Step 1: 更新插件源码断言测试**

在 `test/electron/plugin-updates.test.ts` 加：

```ts
test("includes the Figma official MCP default plugin", () => {
  const source = readFileSync("src/ui/components/settings/PluginsSettingsPage.tsx", "utf8");
  assert.match(source, /id:\s*"figma-official"/);
  assert.match(source, /https:\/\/mcp\.figma\.com\/mcp/);
});
```

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/plugin-updates.test.js
```

Expected: FAIL。

- [ ] **Step 2: 扩展 UI 类型**

在 `PluginsSettingsPage.tsx` 增加 Figma status/result 类型，或把通用字段合并进现有 `PluginRuntimeStatus`：

```ts
type FigmaPluginRuntimeStatus = PluginRuntimeStatus & {
  status?: "not-configured" | "configured" | "needs-auth" | "auth-expired" | "misconfigured" | "ready";
  authHint?: string;
  url?: string;
  capabilities?: string[];
};
```

- [ ] **Step 3: 增加 DEFAULT_PLUGINS Figma 条目**

```ts
{
  id: "figma-official",
  name: "Figma 官方 MCP",
  kind: "mcp-plugin",
  version: "remote",
  description: "Figma 官方远程 MCP，用于从 Figma 链接和 Frame 获取设计上下文并辅助实现 UI。",
  sourcePath: "https://mcp.figma.com/mcp",
  permissions: ["mcp.remote", "figma.oauth", "design.read"],
}
```

- [ ] **Step 4: 分插件读取状态**

不要让 Figma 调 Open Computer Use 的 IPC。新增 helper：

```ts
function getStatusChannel(pluginId: string): string {
  return pluginId === "figma-official"
    ? "plugins:getFigmaOfficialStatus"
    : "plugins:getOpenComputerUseStatus";
}
```

如果当前页面状态只支持一个插件，改成：

```ts
const [runtimeStatuses, setRuntimeStatuses] = useState<Record<string, PluginRuntimeStatus | FigmaPluginRuntimeStatus>>({});
```

- [ ] **Step 5: 分插件主按钮动作**

Figma 主按钮调用 `plugins:installFigmaOfficial`。Open Computer Use 继续调用原 install/update。

Figma 文案：

- `not-configured`: `接入 Figma 官方 MCP`
- `misconfigured`: `修复 Figma MCP 配置`
- `auth-expired`: `重新授权`
- default: `重新写入配置`

第一版 `重新授权` 可以启动 guide session 或显示 toast，不要承诺应用已经完成 OAuth。

- [ ] **Step 6: 增加 Figma guide prompt**

新增：

```ts
function buildFigmaOfficialGuidePrompt(status: FigmaPluginRuntimeStatus | null): string {
  return [
    "你在 tech-cc-hub 的系统工作区里，目标是使用 Figma 官方 MCP 获取设计上下文并实现 UI。",
    "第一版只聚焦 Figma 链接/Frame/图层到 UI 实现，不要宣称 write-to-canvas 或 live UI capture 已完成。",
    "官方 MCP URL: https://mcp.figma.com/mcp",
    "预期 server name: figma",
    "如果出现 401/403/auth/token/expired/oauth/unauthorized，请判断为 Figma 授权缺失或过期，引导用户重新授权，不要重装插件。",
    "",
    "当前 Figma 插件状态快照：",
    "```json",
    JSON.stringify(status ?? { installed: false, connected: false }, null, 2),
    "```",
  ].join("\\n");
}
```

- [ ] **Step 7: 运行测试和 build**

Run:

```bash
npm run transpile:electron
node --test dist-test/test/electron/plugin-updates.test.js
npm run build
```

Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add src/ui/components/settings/PluginsSettingsPage.tsx test/electron/plugin-updates.test.ts
git commit -m "feat: add figma official plugin card"
```

---

## Chunk 5: 授权过期提示与最终验证

### Task 9: 增加 Figma 授权错误识别

**Files:**
- Modify: `src/electron/libs/runner-error.ts`
- Test: `test/electron/runner-error.test.ts`

- [ ] **Step 1: 写失败测试**

在 `runner-error.test.ts` 增加：

```ts
test("normalizes Figma auth expiry errors with reauthorization guidance", () => {
  const message = normalizeRunnerError(
    new Error("mcp__figma__get_code failed: 401 unauthorized token expired"),
    "claude-sonnet-4-5",
  );

  assert.match(message, /Figma 授权可能已过期/);
  assert.match(message, /重新授权/);
});
```

- [ ] **Step 2: 实现识别**

在 `normalizeRunnerError` 中增加轻量判断：

```ts
const FIGMA_AUTH_ERROR_PATTERN = /figma[\s\S]*(401|403|auth|authorize|unauthorized|expired|token|oauth|permission)/i;
```

如果命中，在原错误后追加：

```ts
"Figma 授权可能已过期，请通过 Figma MCP 的 OAuth 流程重新授权。"
```

- [ ] **Step 3: 跑测试**

Run:

```bash
npm run transpile:electron && node --test dist-test/test/electron/runner-error.test.js
```

Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/electron/libs/runner-error.ts test/electron/runner-error.test.ts
git commit -m "feat: guide figma mcp reauthorization"
```

### Task 10: 全量验证

**Files:**
- All touched files

- [ ] **Step 1: 运行目标测试**

Run:

```bash
npm run transpile:electron
node --test dist-test/test/electron/external-mcp-servers.test.js
node --test dist-test/test/electron/figma-official-plugin.test.js
node --test dist-test/test/electron/plugin-updates.test.js
node --test dist-test/test/electron/runner-error.test.js
```

Expected: PASS。

- [ ] **Step 2: 运行完整 build**

Run:

```bash
npm run build
```

Expected: PASS。

- [ ] **Step 3: 人工检查配置写入**

启动应用后：

1. 打开 Settings -> Plugins。
2. 点击 `接入 Figma 官方 MCP`。
3. 检查 `~/Library/Application Support/tech-cc-hub/agent-runtime.json` 包含：

```json
{
  "plugins": {
    "figma-official": {
      "id": "figma-official",
      "capabilities": ["design-context"]
    }
  },
  "mcpServers": {
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp",
      "enabled": true
    }
  }
}
```

- [ ] **Step 4: 人工检查 MCP 设置页**

确认 Settings -> MCP -> 外部 MCP 中：

- 有 `figma`。
- 类型显示 `http`。
- URL 显示 `https://mcp.figma.com/mcp`。
- 不显示空 command。

- [ ] **Step 5: 最终 commit**

如果前面 task 都已各自 commit，这一步只提交遗漏修正：

```bash
git status --short
git add src/electron/libs/external-mcp-servers.ts src/electron/libs/figma-official-plugin.ts src/electron/libs/runner.ts src/electron/libs/runner-error.ts src/electron/ipc-handlers.ts src/electron/main.ts src/electron/types.ts src/ui/types.ts src/ui/components/settings/PluginsSettingsPage.tsx src/ui/components/settings/McpSettingsPage.tsx test/electron/external-mcp-servers.test.ts test/electron/figma-official-plugin.test.ts test/electron/plugin-updates.test.ts test/electron/runner-error.test.ts
git commit -m "test: verify figma official mcp plugin"
```

如果没有遗漏变更，不需要空提交。

---

## 执行注意事项

- 不要改动主 worktree 中未跟踪文件。
- 不要改变 Open Computer Use 现有安装、更新、权限逻辑。
- 不要把 Figma token 过期描述成安装失败。
- 不要把 `mcpServers.figma` 之外的 MCP 配置重写掉。
- 不要在第一版文案里承诺 write-to-canvas、live UI capture 或 Figma skills 已完成。
- 如果 SDK 当前不支持 HTTP MCP 直传，立即停下记录阻塞点，不要退回到伪 stdio 配置。
