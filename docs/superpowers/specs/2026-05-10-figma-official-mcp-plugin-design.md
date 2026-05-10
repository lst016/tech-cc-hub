# Figma 官方 MCP 插件设计

日期：2026-05-10
状态：待用户审阅
范围：在 tech-cc-hub 中以插件级体验接入 Figma 官方远程 MCP 服务

## 目标

为 tech-cc-hub 增加一等的 Figma 官方 MCP 插件体验。

第一版聚焦工作流 A：

- 用户提供 Figma 文件、Frame 或图层链接。
- Agent 通过 Figma 官方 MCP 服务获取设计上下文。
- Agent 基于设计上下文，在当前代码库中实现或更新 UI。

实现时要为后续工作流 C 留出扩展空间：

- 从 Figma 读取设计上下文。
- 写入 Figma canvas。
- 将本地 live UI 捕获到 Figma。
- 接入 Figma skills、rules 和 Code Connect 指引。

## 第一版不做什么

- 不接入 Figma desktop MCP。
- 不实现 live UI capture 到 Figma。
- 不实现 write-to-canvas。
- 不内置或安装 Figma skills。
- 不重构完整插件平台。
- 不把 OAuth 或 token 过期误判为插件安装失败。

## 当前上下文

tech-cc-hub 目前已经有：

- 全局运行时配置里的外部 MCP 配置：`mcpServers`。
- 内置 MCP registry 和 MCP 设置页。
- 已用于 Open Computer Use 的插件设置页。
- runner 侧 app 工具门禁逻辑；该逻辑已经允许已配置外部 MCP server name 下的工具。

当前外部 MCP 路径主要围绕 stdio server 设计：

```json
{
  "mcpServers": {
    "open-computer-use": {
      "type": "stdio",
      "command": "open-computer-use",
      "args": ["mcp"]
    }
  }
}
```

Figma 官方远程 MCP 使用 HTTP：

```json
{
  "mcpServers": {
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp",
      "enabled": true
    }
  }
}
```

## 推荐方案

采用“插件级接入 + 轻量插件抽象”。

具体含义：

- 在 Open Computer Use 旁边增加第二个默认插件卡片：Figma 官方 MCP。
- 增加 Figma 专用 Electron IPC，用于状态读取和接入/修复配置。
- 扩展外部 MCP 解析逻辑，支持 HTTP remote MCP。
- 保持已有 stdio MCP 行为不变。
- 第一版只聚焦 design-context 读取。
- 在插件配置中保存 Figma capabilities，为后续扩展预留位置。

这样既能让 Figma 像正式产品功能，又避免把本次任务扩大成插件平台大重构。

## 架构

### 运行时 MCP 层

扩展外部 MCP server 解析，让 `mcpServers` 同时支持 stdio 和 HTTP 两种配置。

支持的 stdio 形态：

```json
{
  "type": "stdio",
  "command": "open-computer-use",
  "args": ["mcp"],
  "env": {
    "OPTIONAL_KEY": "value"
  },
  "enabled": true
}
```

支持的 HTTP 形态：

```json
{
  "type": "http",
  "url": "https://mcp.figma.com/mcp",
  "enabled": true
}
```

规则：

- `enabled === false` 表示禁用该 server。
- 缺失 `type` 但存在 `command` 时，继续按 stdio 兼容处理。
- `type: "http"` 必须提供合法 `url`。
- 无效 MCP 条目只跳过，并记录 server name 和原因。
- 某个外部 MCP 配置坏了，不能拖垮其他 MCP server 加载。

runner 需要把解析后的 HTTP MCP 传给当前版本 `@anthropic-ai/claude-agent-sdk` 支持的结构。如果 SDK 实际要求的字段名略有不同，把适配逻辑收在解析边界内，全局配置 schema 保持稳定。

### 插件状态层

新增 Figma 官方插件状态，状态来源是：

- `plugins["figma-official"]`
- `mcpServers.figma`

建议插件配置：

```json
{
  "plugins": {
    "figma-official": {
      "id": "figma-official",
      "name": "Figma 官方 MCP",
      "kind": "mcp-plugin",
      "source": {
        "type": "remote-mcp",
        "url": "https://mcp.figma.com/mcp"
      },
      "enabled": true,
      "installed": true,
      "connected": false,
      "capabilities": ["design-context"],
      "authStatus": "unknown",
      "lastAuthCheckedAt": null,
      "lastAuthError": null,
      "updatedAt": 1760000000000
    }
  }
}
```

建议状态值：

- `not-configured`：Figma 插件和 MCP 配置都不存在。
- `configured`：HTTP MCP 配置存在，但 OAuth 状态还不能确认。
- `needs-auth`：首次使用，或 OAuth 流程还没有完成。
- `auth-expired`：Figma token 过期、被撤销，或已经消失。
- `misconfigured`：配置存在，但 type、URL 或 server name 不对。
- `ready`：未来当 SDK 或工具反馈能证明 Figma 连接可用时，再进入该状态。

第一版不要假装一定能验证 Figma OAuth 状态。UI 可以诚实显示“已配置 / 可能需要授权”，直到工具错误或 SDK 信号提供更明确状态。

### Token 过期与重新授权

Figma 授权 token 可能有时效，过期后也可能消失。这是独立状态。

它不能被当成：

- 插件未安装。
- MCP 配置缺失。
- 需要重新安装插件。
- 需要删除或重写无关 MCP 配置。

第一版提醒逻辑：

- Figma 插件卡片明确说明：Figma 授权可能过期，失效后需要重新授权。
- 引导会话 prompt 要告诉 Agent：把授权过期和配置损坏分开判断。
- runtime 错误归一化尽量识别 Figma 授权失败信号。

可能表示授权过期的信号包括：

- Figma MCP 服务返回 HTTP 401 或 403。
- 工具错误中包含 `auth`、`authorize`、`unauthorized`、`expired`、`token`、`oauth`、`permission`。
- MCP 连接响应要求用户重新 authenticate。

检测到时显示：

> Figma 授权可能已过期，请通过 Figma MCP 的 OAuth 流程重新授权。

此时修复动作应该是“重新授权”，不是“重新安装”。

### 插件 UI 层

把 `PluginsSettingsPage` 从单个硬编码插件卡片，扩展成小型默认插件列表。

默认插件：

- `open-computer-use`
- `figma-official`

Figma 卡片字段：

- 名称：`Figma 官方 MCP`
- 类型：`mcp-plugin`
- 来源：`https://mcp.figma.com/mcp`
- 权限：`mcp.remote`、`figma.oauth`、`design.read`
- 能力：`design-context`

Figma 卡片状态：

- 未配置：主按钮 `接入 Figma 官方 MCP`。
- 已配置或需要授权：主按钮 `重新写入配置`，副按钮 `启动引导会话`。
- 授权过期：主按钮 `重新授权`，副按钮 `修复配置`。
- 配置异常：主按钮 `修复 Figma MCP 配置`。
- 可用：主按钮可禁用或显示 `已接入`，副按钮 `启动引导会话`。

如果 SDK 没有暴露直接触发 OAuth 的 API，第一版可以把“重新授权”实现成清晰引导，而不是完整 OAuth launcher。文案要明确：真正的 OAuth 流程由 MCP client 连接或首次工具使用时触发。

### MCP 设置页

更新 MCP 设置页，让外部 server 能正确展示 stdio 和 HTTP 两种形态。

HTTP 外部 MCP 显示：

- transport：`http`
- URL
- enabled/disabled
- 不显示空的 command 或 args

stdio 外部 MCP 显示：

- 保持当前 command、args、env key 展示。

### 引导会话

新增 Figma 引导会话 prompt builder。

prompt 需要说明：

- 目标是让 Figma 官方 MCP 可用于“基于设计上下文实现 UI”。
- 官方 server 是 `https://mcp.figma.com/mcp`。
- 预期 server name 是 `figma`。
- 第一版聚焦 Figma link/frame/layer 到 UI 实现。
- 如果 auth 失败或 token 过期，引导用户重新授权 Figma，不要重装插件。
- 不要宣称第一版已经支持 write-to-canvas 或 live UI capture。

建议引导会话 allowed tools：

- `*`，与当前 repo 为了 MCP 可用性采用的宽松默认一致。

## 数据流

1. 用户打开 Settings -> Plugins。
2. 用户点击 `接入 Figma 官方 MCP`。
3. Electron handler 写入：
   - `plugins["figma-official"]`
   - `mcpServers.figma`
4. UI 刷新 Figma 插件状态。
5. 用户开始或继续一个会话。
6. runner 读取全局 `mcpServers`。
7. runner 将 `figma` 解析为 HTTP remote MCP。
8. runner 把外部 MCP servers 和内置 MCP servers 一起传给 SDK。
9. runner allow 逻辑允许以 `mcp__figma__` 开头的工具名。
10. 用户提供 Figma URL。
11. Agent 使用 Figma MCP 工具获取设计上下文。
12. Agent 基于设计上下文实现 UI。
13. 如果 Figma 返回授权过期，UI 或会话消息提示用户重新授权。

## 错误处理

### 配置缺失

状态：`not-configured`

动作：

- 提供 `接入 Figma 官方 MCP`。

### 配置错误

示例：

- `mcpServers.figma.type` 不是 `http`。
- URL 缺失或不是 `https://mcp.figma.com/mcp`。
- 插件条目存在，但 MCP 条目缺失。

状态：`misconfigured`

动作：

- 提供一键修复，只重写 Figma 插件和 Figma MCP 配置。
- 保留无关 plugins 和 MCP servers。

### 授权缺失或过期

状态：`needs-auth` 或 `auth-expired`

动作：

- 告诉用户 Figma 授权缺失或已过期。
- 说明需要通过 MCP OAuth 流程重新授权。
- 默认不要重新安装插件。

### 远程 server 不可达

状态：

- 保持插件为已配置。
- 在会话里暴露运行期错误。

动作：

- 建议稍后重试或检查网络。
- 不删除配置。

### 不支持的 MCP 类型

动作：

- 只跳过无效 server。
- 记录 server name 和原因。
- 继续加载其他 MCP servers。

## 实现边界

可能涉及文件：

- `src/electron/libs/runner.ts`
- `src/electron/ipc-handlers.ts`
- `src/electron/main.ts`
- `src/electron/types.ts`
- `src/ui/types.ts`
- `src/ui/components/settings/PluginsSettingsPage.tsx`
- `src/ui/components/settings/plugin-toast-messages.ts`
- `src/ui/components/settings/McpSettingsPage.tsx`
- `test/electron/plugin-updates.test.ts`
- 新增外部 MCP 解析和 Figma 插件状态测试。

保持改动收敛：

- 不重写 SettingsModal。
- 不改变 Open Computer Use 现有行为。
- 不改变内置 MCP registry 语义。
- 第一版不增加 Figma 视觉工作流。

## 测试计划

单元测试：

- HTTP 外部 MCP 配置能被解析并保留给 runner 使用。
- 现有 stdio MCP 配置继续可用。
- disabled 外部 MCP 条目会被跳过。
- 无效 MCP 条目不会导致崩溃。
- 配置了 `mcpServers.figma` 时，`mcp__figma__...` 能通过工具 allow 逻辑。
- Figma install handler 写入预期的 plugin 和 MCP 配置。
- Figma 状态能识别 `not-configured`、`configured`、`misconfigured` 和 auth-expired 提示。

UI/source 测试：

- 插件设置页包含 `figma-official`。
- Figma 卡片显示官方 remote MCP URL。
- MCP 设置页能渲染 HTTP 外部 MCP 条目。

构建检查：

```bash
npm run transpile:electron
npm run build
```

手动验收：

1. 打开插件设置页。
2. 点击 `接入 Figma 官方 MCP`。
3. 确认全局运行时配置包含 `plugins.figma-official` 和 `mcpServers.figma`。
4. 确认 MCP 设置页把 Figma 显示为 remote HTTP MCP。
5. 开始一个新会话。
6. 输入 Figma frame URL。
7. 确认 Agent 能尝试使用 Figma MCP。
8. 如果授权缺失或过期，确认应用引导重新授权，而不是要求重装插件。

## 验收标准

- Figma 官方 MCP 作为默认插件卡片出现。
- 点击 Figma 主按钮能写入正确的全局 plugin 和 MCP 配置。
- runner 支持 HTTP remote MCP，且不破坏 stdio MCP。
- Figma MCP 工具不会被 app-side tool gating 拦住。
- MCP 设置页能准确显示 HTTP 外部 MCP。
- token 过期或 OAuth 缺失被呈现为“需要重新授权”，不是插件安装失败。
- 第一版文案诚实：支持 design-context 工作流；write-to-canvas 和 live UI capture 是后续能力。
