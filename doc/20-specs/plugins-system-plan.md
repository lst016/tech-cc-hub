# Plugins System Plan

## Goal

Build a first-class plugin system for tech-cc-hub. Plugins are the common extension layer for desktop automation, MCP servers, skills, tools, model channels, agent modes, rule packs, UI surfaces, and workspace adapters.

The first default plugin is `open-computer-use` from `iFurySt/open-codex-computer-use`.

## Principles

- Plugins extend the app through declared contributions instead of patching core code.
- Every plugin has identity, version, source, status, permissions, and lifecycle.
- High-risk capabilities are explicit and visible in Settings.
- Skills remain useful, but become one plugin kind rather than the whole system.
- MVP should prove one real plugin end to end before generalizing too much.

## Default Plugin

`open-computer-use` is the first built-in/default plugin.

Source:

- Repository: `https://github.com/iFurySt/open-codex-computer-use`
- Plugin path: `plugins/open-computer-use`
- Manifest: `.codex-plugin/plugin.json`
- MCP config: `.mcp.json`

Initial metadata:

```json
{
  "id": "open-computer-use",
  "name": "Open Computer Use",
  "kind": "mcp-plugin",
  "builtin": true,
  "default": true,
  "source": {
    "type": "github",
    "repo": "iFurySt/open-codex-computer-use",
    "path": "plugins/open-computer-use"
  },
  "permissions": [
    "mcp.server",
    "desktop.read",
    "desktop.write",
    "accessibility",
    "screen-recording"
  ]
}
```

## Plugin Types

```ts
type PluginKind =
  | "mcp-plugin"
  | "skill"
  | "tool"
  | "channel"
  | "agent-mode"
  | "rule-pack"
  | "ui-extension"
  | "workspace-adapter";
```

## Lifecycle

1. Discover
2. Install
3. Validate manifest
4. Request permissions
5. Activate
6. Register contributions
7. Health check
8. Update
9. Deactivate
10. Uninstall

## Electron Modules

Target structure:

```txt
src/electron/libs/plugin-manager/
  index.ts
  types.ts
  registry.ts
  installer.ts
  loader.ts
  permissions.ts
  contributions.ts
  marketplace.ts
  updater.ts

src/electron/libs/plugin-host/
  mcp-plugin-host.ts
  sandbox.ts
  ipc-bridge.ts
```

## Renderer Surface

Plugins live in Settings as their own tab.

Initial views:

- Overview
- Installed plugins
- Marketplace
- Permissions
- Developer mode

MVP starts with a single default plugin card for `Open Computer Use`, including install state, permission state, MCP state, and next actions.

## MVP Phases

### Phase 1: Product Shell

- Add Settings -> Plugins tab.
- Show `Open Computer Use` as the default plugin.
- Show planned status model and required permissions.
- Link plugin planning to this document.

### Phase 2: Registry

- Add plugin types and registry store.
- Seed registry with `open-computer-use`.
- Persist enabled/disabled state.
- Expose IPC methods for list/enable/disable.

### Phase 3: Installer

- Support installing from GitHub plugin path.
- Support existing local plugin folder.
- Parse `.codex-plugin/plugin.json`.
- Parse `.mcp.json`.

### Phase 4: MCP Runtime

- Register plugin MCP servers.
- Start/stop/check health.
- Surface runtime logs and permission blockers.

### Phase 5: Skills Adapter

- Wrap existing `skill-manager` results as plugin records.
- Treat skills as plugin contributions.
- Keep current skills UI while adding plugin-level governance.

### Phase 6: Marketplace

- Load marketplace manifests.
- Support updates.
- Add plugin trust metadata and source verification.

## Acceptance Criteria

- `Open Computer Use` appears as the default plugin in Settings.
- The plugin has visible source, kind, version, permissions, and runtime states.
- The plugin can later be installed, enabled, disabled, health checked, and updated through one registry.
- Existing skills remain available and can be migrated behind the plugin model without breaking the current skills center.
