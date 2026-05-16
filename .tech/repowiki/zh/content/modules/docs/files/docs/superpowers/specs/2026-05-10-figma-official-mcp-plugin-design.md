# docs/superpowers/specs/2026-05-10-figma-official-mcp-plugin-design.md

> 模块：`docs` · 语言：`markdown` · 行数：397

## 文件职责

Figma 官方 MCP 插件的设计规格说明，定义目标、范围、技术方案、架构和插件状态机

## 关键符号

- `工作流 A@0 - Figma 链接/Frame -> 设计上下文 -> UI 实现的核心工作流`
- `工作流 C@0 - 未来的扩展工作流，包含设计上下文读取、写入 Figma canvas、live UI 捕获等`
- `Plugin State Machine@0 - 插件状态机：not-configured -> configured -> needs-auth -> auth-expired`
- `stdio transport@0 - 标准输入输出模式的 MCP 服务器配置`
- `http transport@0 - HTTP 传输模式的 MCP 服务器配置（Figma 使用此模式）`
- `OAuth token@0 - Figma 官方 MCP 使用的认证机制，涉及 token 过期提醒`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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

stdio 外部 MCP 显示
... (truncated)
```
