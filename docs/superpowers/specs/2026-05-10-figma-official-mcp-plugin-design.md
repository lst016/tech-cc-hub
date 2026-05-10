# Figma Official MCP Plugin Design

Date: 2026-05-10
Status: Draft for user review
Scope: tech-cc-hub plugin-level support for the official Figma remote MCP server

## Goal

Add a first-class Figma official MCP plugin experience to tech-cc-hub.

The first version focuses on workflow A:

- User provides a Figma file, frame, or layer URL.
- The agent uses the official Figma MCP server to fetch design context.
- The agent implements or updates UI in the current codebase using that design context.

The implementation should leave room for the later C workflow:

- Read design context from Figma.
- Write to canvas.
- Capture live UI to Figma.
- Attach Figma skills, rules, and Code Connect guidance.

## Non-Goals For Version 1

- Do not implement Figma desktop MCP support.
- Do not implement live UI capture to Figma.
- Do not implement write-to-canvas workflows.
- Do not bundle or install Figma skills yet.
- Do not rebuild the full plugin framework.
- Do not treat OAuth or token expiry as an app install failure.

## Current Context

tech-cc-hub already has:

- External MCP configuration under global runtime `mcpServers`.
- Built-in MCP registry and settings UI.
- A plugin settings page for Open Computer Use.
- Runner-side app tool gating that already allows tools from configured external MCP server names.

The current external MCP path is mainly shaped around stdio servers:

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

The official Figma remote MCP server uses HTTP:

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

## Recommended Approach

Use a plugin-level integration with a lightweight plugin abstraction.

This means:

- Add Figma as a second default plugin card beside Open Computer Use.
- Add Figma-specific Electron IPC handlers for status and install/connect.
- Extend external MCP parsing to support HTTP remote MCP servers.
- Keep stdio MCP behavior unchanged.
- Keep the first version focused on design-context reads.
- Store Figma plugin capabilities in the plugin config for future expansion.

This avoids a large plugin-platform rewrite while still making Figma feel like a real product feature.

## Architecture

### Runtime MCP Layer

Extend external MCP server parsing so `mcpServers` supports both stdio and HTTP entries.

Supported stdio shape:

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

Supported HTTP shape:

```json
{
  "type": "http",
  "url": "https://mcp.figma.com/mcp",
  "enabled": true
}
```

Rules:

- `enabled === false` disables the server.
- Missing `type` with `command` remains stdio-compatible.
- `type: "http"` requires a valid `url`.
- Invalid MCP entries are skipped and logged with server name and reason.
- A bad external MCP entry must not prevent other MCP servers from loading.

The runner should pass parsed HTTP MCP entries through to `@anthropic-ai/claude-agent-sdk` in the shape supported by the SDK version in use. If the SDK expects a slightly different transport field, adapt the parser at the boundary and keep the global config schema stable.

### Plugin Status Layer

Add Figma official plugin state derived from:

- `plugins["figma-official"]`
- `mcpServers.figma`

Suggested plugin config:

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

Suggested status values:

- `not-configured`: Figma plugin and MCP config are missing.
- `configured`: HTTP MCP config exists, but OAuth state has not been confirmed.
- `needs-auth`: first use or OAuth flow has not completed.
- `auth-expired`: Figma token expired, was revoked, or disappeared.
- `misconfigured`: config exists but type, URL, or server name is wrong.
- `ready`: future state when SDK/tool feedback confirms a working Figma connection.

Version 1 should not pretend it can always verify Figma OAuth state. The UI can honestly show "configured / authorization may be required" until a tool error or SDK signal proves more.

### Token Expiry And Reauthorization

Figma authorization tokens can expire or disappear after their validity window. This is a distinct state.

It must not be treated as:

- Plugin not installed.
- MCP config missing.
- A reason to reinstall the plugin.
- A reason to delete or rewrite unrelated MCP config.

Version 1 reminders:

- The Figma plugin card explains that Figma authorization may expire and require reauthorization.
- The guide session prompt tells the agent to classify auth expiry separately from config damage.
- Runtime error normalization should detect likely Figma auth failures when possible.

Likely auth-expiry signals include:

- HTTP 401 or 403 from the Figma MCP server.
- Tool errors containing `auth`, `authorize`, `unauthorized`, `expired`, `token`, `oauth`, or `permission`.
- MCP connection responses asking the user to authenticate again.

When detected, show:

> Figma 授权可能已过期，请通过 Figma MCP 的 OAuth 流程重新授权。

The repair action should be "reauthorize", not "reinstall".

### Plugin UI Layer

Extend `PluginsSettingsPage` from a single hard-coded plugin card into a small default plugin list.

Default plugins:

- `open-computer-use`
- `figma-official`

Figma card fields:

- Name: `Figma 官方 MCP`
- Kind: `mcp-plugin`
- Source: `https://mcp.figma.com/mcp`
- Permissions: `mcp.remote`, `figma.oauth`, `design.read`
- Capabilities: `design-context`

Figma card states:

- Not configured: primary button `接入 Figma 官方 MCP`.
- Configured or needs auth: primary button `重新写入配置`; secondary button `启动引导会话`.
- Auth expired: primary button `重新授权`; secondary button `修复配置`.
- Misconfigured: primary button `修复 Figma MCP 配置`.
- Ready: primary button can be disabled or read `已接入`; secondary button `启动引导会话`.

The first version can implement "重新授权" as guidance, not a full OAuth launcher, if the SDK does not expose a direct auth trigger. The copy should be clear that the actual OAuth flow is initiated through MCP client connection/use.

### MCP Settings UI

Update MCP settings display so external servers can show either stdio or HTTP details.

For HTTP external MCP:

- Show transport: `http`.
- Show URL.
- Show enabled or disabled.
- Do not show empty command or args fields.

For stdio external MCP:

- Keep current command, args, and env key display.

### Guide Session

Add a Figma guide session prompt builder.

The prompt should say:

- The goal is to make the official Figma MCP available for design-context driven UI implementation.
- The official server is `https://mcp.figma.com/mcp`.
- The expected server name is `figma`.
- First version focuses on Figma link/frame/layer to UI implementation.
- If auth fails or token expired, guide the user to reauthorize Figma instead of reinstalling.
- Do not claim write-to-canvas or live UI capture is complete in version 1.

Suggested allowed tools for the guide session:

- `*`, matching the repo's current practical default for MCP usability.

## Data Flow

1. User opens Settings -> Plugins.
2. User clicks `接入 Figma 官方 MCP`.
3. Electron handler writes:
   - `plugins["figma-official"]`
   - `mcpServers.figma`
4. UI refreshes Figma plugin status.
5. User starts or continues a session.
6. Runner reads global `mcpServers`.
7. Runner parses `figma` as HTTP remote MCP.
8. Runner passes external MCP servers plus built-in MCP servers to the SDK.
9. Runner allow logic permits tools whose names start with `mcp__figma__`.
10. User provides a Figma URL.
11. Agent uses Figma MCP tools to fetch design context.
12. Agent implements UI using the design context.
13. If Figma reports expired auth, UI/session messaging asks the user to reauthorize.

## Error Handling

### Config Missing

Status: `not-configured`

Action:

- Offer `接入 Figma 官方 MCP`.

### Config Wrong

Examples:

- `mcpServers.figma.type` is not `http`.
- URL is missing or not `https://mcp.figma.com/mcp`.
- Plugin entry exists but MCP entry is missing.

Status: `misconfigured`

Action:

- Offer one-click repair that rewrites only Figma plugin and Figma MCP config.
- Preserve unrelated plugins and MCP servers.

### Auth Missing Or Expired

Status: `needs-auth` or `auth-expired`

Action:

- Tell user Figma authorization is missing or expired.
- Explain that reauthorization should happen through the MCP OAuth flow.
- Do not reinstall the plugin by default.

### Remote Server Unreachable

Status:

- Keep plugin configured.
- Surface runtime error in the session.

Action:

- Suggest retrying later or checking network.
- Do not delete config.

### Unsupported MCP Type

Action:

- Skip only the invalid server.
- Log server name and reason.
- Continue loading other MCP servers.

## Implementation Boundaries

Likely files:

- `src/electron/libs/runner.ts`
- `src/electron/ipc-handlers.ts`
- `src/electron/main.ts`
- `src/electron/types.ts`
- `src/ui/types.ts`
- `src/ui/components/settings/PluginsSettingsPage.tsx`
- `src/ui/components/settings/plugin-toast-messages.ts`
- `src/ui/components/settings/McpSettingsPage.tsx`
- `test/electron/plugin-updates.test.ts`
- New tests for external MCP parsing and Figma plugin status.

Keep changes scoped:

- Do not rewrite the settings modal.
- Do not change existing Open Computer Use behavior.
- Do not change built-in MCP registry semantics.
- Do not add Figma visual workflows in version 1.

## Testing Plan

Unit tests:

- HTTP external MCP config is parsed and preserved for runner use.
- Existing stdio MCP config still works.
- Disabled external MCP entries are skipped.
- Invalid MCP entries are skipped without crashing.
- `mcp__figma__...` is allowed when `mcpServers.figma` is configured.
- Figma install handler writes the expected plugin and MCP config.
- Figma status detects `not-configured`, `configured`, `misconfigured`, and auth-expired hints.

UI/source tests:

- Plugin settings page includes `figma-official`.
- Figma card displays the official remote MCP URL.
- MCP settings page can render HTTP external MCP entries.

Build checks:

```bash
npm run transpile:electron
npm run build
```

Manual validation:

1. Open plugin settings.
2. Click `接入 Figma 官方 MCP`.
3. Confirm global runtime config contains `plugins.figma-official` and `mcpServers.figma`.
4. Confirm MCP settings shows Figma as remote HTTP MCP.
5. Start a new session.
6. Prompt with a Figma frame URL.
7. Confirm the agent can attempt Figma MCP use.
8. If auth is missing or expired, confirm the app guides reauthorization instead of reinstall.

## Acceptance Criteria

- Figma official MCP appears as a default plugin card.
- Clicking the Figma primary action writes correct global plugin and MCP config.
- Runner supports HTTP remote MCP entries without breaking stdio MCP entries.
- Figma MCP tools are not blocked by app-side tool gating.
- MCP settings displays HTTP external MCP entries accurately.
- Token expiry or missing OAuth is shown as a reauthorization problem, not a plugin install failure.
- First version messaging is honest: design-context workflow is supported; write-to-canvas and live UI capture are future capabilities.
