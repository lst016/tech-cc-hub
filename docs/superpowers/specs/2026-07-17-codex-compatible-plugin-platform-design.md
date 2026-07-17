# Codex-Compatible Plugin Platform Design

**Status:** Approved for implementation on 2026-07-17.

## Summary

tech-cc-hub will provide a Codex-compatible plugin platform and add a host-governed Agent Runtime for trusted plugins. An unmodified Codex plugin remains installable and can contribute Skills, MCP servers, and connector Apps. A plugin that also ships an optional `tech-cc-hub.json` manifest can request additional UI, session, model, and tool capabilities.

The central product decision is to give trusted plugins broad powers without giving them direct access to Electron internals, model credentials, or unbounded background execution. Model calls, tool calls, main-session control, and BTW child sessions all pass through a versioned Capability Broker. Every privileged operation is bound to an explicit user-triggered operation in an active session, checked against a permission ledger, and written to an audit log.

The first release does not support autonomous background execution. A user-started operation may continue until it completes, is cancelled, the active session is replaced, or its lease reaches the hard limit. Once that operation graph ends, the plugin cannot start another model or tool call without a new user action.

## Current State

The repository already contains the main building blocks, but they use separate identities, manifests, storage, and lifecycle paths:

- `WorkspacePluginManager` discovers `tech-cc-hub.plugin.json`, launches session-scoped local processes, creates a loopback bearer-token bridge, and presents a BrowserView surface. Codex Canvas is the only complete consumer.
- `skill-manager` has its own SQLite registry, central store, local/Git/skills.sh installers, update flow, scenarios, and adapters for multiple coding tools.
- built-in and external MCP servers are aggregated through separate registries and runner configuration paths.
- Claude Code plugins are discovered from Claude configuration and passed to Agent SDK sessions through a compatibility layer.
- the Plugins settings page contains hard-coded Open Computer Use, Figma, Android, and iOS integrations with plugin-specific IPC handlers.

The new platform must unify these systems through adapters. It must not add another plugin-specific registry or duplicate their already working storage and runtime logic.

## Goals

- Install and run an unmodified Codex plugin package.
- Preserve Codex contributions: Skills, MCP servers, connector Apps, and marketplace metadata.
- Let an enhanced plugin request main-session control, BTW child sessions, model enumeration and invocation, and access to any host tool.
- Offer three user-facing grant profiles: Standard, Full Trust, and Custom.
- Keep model and service credentials inside the host.
- Attribute plugin-authored main-session turns visibly in the normal transcript.
- Make privileged operations executable, auditable, revocable, and cancellable.
- Reuse the existing workspace plugin, skill, MCP, and Claude compatibility systems through explicit adapters.
- Support health reporting, updates, permission-diff review, atomic activation, and rollback.
- Be honest about native local code: without an OS sandbox, it has the operating-system privileges of the user who launched it.

## Non-Goals for the First Release

- Autonomous, scheduled, or event-triggered background model and tool calls.
- Plugin-provided model accounts, API keys, or billing relationships.
- A cross-platform security sandbox for arbitrary native plugin processes.
- Silent permission escalation after install or update.
- Direct access to Electron main-process objects, unrestricted application IPC, the raw session database, or global runtime configuration.
- Breaking or replacing the Codex plugin manifest format.
- Cross-device plugin execution or remote plugin workers.

## Package Contract

### Codex compatibility manifest

The package root continues to use `.codex-plugin/plugin.json`. The normalizer accepts Codex metadata and contribution pointers without requiring tech-cc-hub-specific fields:

```json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "Example Codex-compatible plugin",
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "apps": "./.app.json",
  "interface": {
    "displayName": "Example Plugin",
    "capabilities": ["Interactive", "Read", "Write"]
  }
}
```

Codex `interface.capabilities` values are presentation metadata. They are not treated as enforceable permissions.

### tech-cc-hub enhancement manifest

An enhanced package may add `tech-cc-hub.json` beside the Codex manifest:

```json
{
  "schemaVersion": 1,
  "engine": {
    "techCcHub": ">=1.0.0"
  },
  "runtime": {
    "kind": "native-local"
  },
  "contributes": {
    "surfaces": [
      {
        "id": "workspace",
        "placement": "activity-rail",
        "entry": "http://127.0.0.1:{port}/"
      }
    ],
    "commands": [
      {
        "id": "example.run",
        "title": "Run Example Plugin"
      }
    ],
    "hooks": ["session.image.add"]
  },
  "capabilities": {
    "required": [
      "session.context.read",
      "session.child.create",
      "models.list",
      "models.invoke"
    ],
    "optional": [
      "session.main.control",
      "models.select",
      "tools.list",
      "tools.call:*"
    ]
  }
}
```

`required` means the plugin cannot activate unless the user grants the capability. `optional` means the plugin must remain usable with the associated feature disabled. The normalized manifest records which contributions depend on each optional capability so the host can disable only the affected feature.

### Canonical plugin record

The Plugin Registry stores one canonical record per installed plugin:

```ts
type PluginRecord = {
  id: string;
  version: string;
  source: PluginSource;
  installHash: string;
  installPath: string;
  codexManifest: CodexPluginManifest;
  extensionManifest?: TechCcHubPluginManifest;
  contributions: PluginContribution[];
  requestedCapabilities: CapabilityRequest[];
  grantProfile: "standard" | "full-trust" | "custom";
  grants: CapabilityGrant[];
  runtimeClass: "declarative" | "native-local";
  enabled: boolean;
  lifecycleState: PluginLifecycleState;
  health: PluginHealth;
  updateChannel: "stable" | "beta" | "dev";
};
```

Plugin identity is derived from the canonical package name and installation source. Duplicate contributions, incompatible engine ranges, unsafe paths, unknown required capabilities, and conflicting plugin identities block activation with structured validation errors.

## Architecture

### Plugin Kernel

The Plugin Kernel is the control plane and contains four focused services:

1. **Plugin Registry** owns identity, source, version, content hash, grant profile, enablement, lifecycle state, and health.
2. **Contribution Graph** normalizes Codex and tech-cc-hub contributions and detects collisions before activation.
3. **Lifecycle Coordinator** performs discover, validate, install, authorize, activate, health check, deactivate, update, rollback, and uninstall operations.
4. **Permission Ledger** stores capability requests, user grants, grant changes, lease use, revocations, and update-time permission differences.

These services do not execute models or tools. They produce the normalized, authorized runtime configuration consumed by the execution plane.

### Execution plane

The execution plane consists of:

- **Plugin Host:** owns native processes, browser surfaces, MCP processes, readiness checks, logs, process shutdown, and crash reporting.
- **Capability Broker:** authorizes and dispatches session, model, tool, workspace, network, desktop, and secret operations.
- **Agent Runtime Bridge:** translates approved model and tool requests into the existing runner and model-profile infrastructure.
- **Session Bridge:** translates approved main-session and BTW operations into the existing session event path.
- **Audit Service:** records privileged requests and their outcomes without persisting raw secrets.

The BrowserView transport uses a narrow, versioned preload API. Native plugin processes use authenticated loopback RPC. Both transports expose the same protocol and capability semantics.

### Existing subsystem adapters

- `WorkspacePluginManager` becomes the browser-surface and native-process runtime adapter. Its discovery, readiness, per-session lifecycle, loopback token, and close behavior are retained.
- `skill-manager` remains the source of truth for skill installation and multi-tool synchronization. A Skill Contribution Adapter exposes its records through the Plugin Registry.
- built-in and external MCP registries become MCP Contribution Adapters. They continue to create fresh server instances for the runner.
- Claude Code plugin discovery becomes a foreign-plugin adapter. Claude remains the installation authority until a plugin is explicitly imported into tech-cc-hub.
- hard-coded settings integrations become bundled plugin records and typed runtime adapters instead of renderer constants and plugin-specific tables.

Adapters must not copy package contents or create duplicate enablement state. The canonical registry stores references to the existing authority and its normalized status.

## Capability Model

### Effective grants

The effective capabilities for a request are:

```text
host capabilities available in the active session
INTERSECT plugin manifest requests
INTERSECT user grants
INTERSECT active operation lease scope
```

A plugin cannot gain a host capability merely because the current user or model has it. The plugin must declare it and the user must grant it.

### Grant profiles

**Standard** grants declarative contributions and low-risk read capabilities. It does not grant main-session control, arbitrary tool calls, or native local code execution.

**Full Trust** grants every required and optional host capability declared by the installed version, including `tools.call:*`. It suppresses repeated capability prompts while a valid operation lease is active. It does not permit secret reads, disabled auditing, background autonomy, or operating-system permission bypass.

**Custom** stores individual atomic grants and scoped values such as tool names, workspace roots, network origins, or desktop-control categories.

If an update adds a required or optional capability, the plugin returns to `awaiting-permission-review`. The previous version remains active until the user accepts the new permission set and activation succeeds.

### Capability vocabulary

The first version includes:

- `session.context.read`
- `session.main.message.create`
- `session.main.run.start`
- `session.main.run.cancel`
- `session.main.model.set`
- `session.main.control` as a UI bundle expanded into the four main-session atomic grants
- `session.child.create`
- `session.child.read`
- `session.child.publish`
- `models.list`
- `models.select`
- `models.invoke`
- `tools.list`
- `tools.call:<tool-name>`
- `tools.call:*`
- `workspace.read:<root>`
- `workspace.write:<root>`
- `network.connect:<origin>`
- `desktop.observe`
- `desktop.control`
- `secrets.use:<secret-id>`

The ledger stores atomic grants. Bundle names are only manifest and UI conveniences.

`tools.call:*` resolves against the tool catalog currently exposed to the active session at call time. Under Full Trust, newly available host tools are included. The audit UI highlights first use of a newly observed tool. Under Custom, users can replace the wildcard with named tools.

## Active Session Lease

Privileged model, tool, and session operations require an Active Session Lease. The host creates a lease only when a user explicitly invokes a plugin command, clicks a plugin action, or submits an action from the plugin surface while a tech-cc-hub session is active.

A lease contains:

```ts
type PluginOperationLease = {
  id: string;
  pluginId: string;
  sessionId: string;
  userGestureId: string;
  rootOperationId: string;
  effectiveCapabilities: AtomicCapabilityGrant[];
  limits: {
    maxConcurrentRuns: number;
    maxModelCalls: number;
    maxToolCalls: number;
    maxTokens?: number;
  };
  createdAt: number;
  lastActivityAt: number;
  hardExpiresAt: number;
  cancelledAt?: number;
};
```

The lease is scoped to one root operation graph. Descendant model turns and tool calls may continue under that lease. It expires when the root operation completes, the user cancels it, the active session changes, the plugin is disabled, or the 60-minute hard limit is reached. A long operation approaching the hard limit requires a visible user extension.

Lease limits are derived from the active session and host policy. Full Trust does not raise those ceilings. A user may lower the limits for a plugin or a single operation, but a plugin cannot raise them or create a nested lease.

Finishing an operation cannot leave a reusable token that starts another run. This enforces the first-release decision that plugins do not run autonomously in the background.

## Agent Runtime Protocol

The initial protocol is versioned as `techcc.plugin.v1` and supports:

```text
context.get
models.list
models.select
models.invoke
tools.list
tools.call
runs.create
runs.stream
runs.cancel
btw.get
btw.publish
```

Every request includes `protocolVersion`, `requestId`, `pluginId`, `leaseId`, and `sessionId`. The broker obtains plugin identity from the authenticated transport and rejects a payload whose self-reported identity differs.

### Model operations

- `models.list` returns only model profiles already configured and currently available to the user.
- `models.select` chooses a model profile for a plugin-created run. It does not expose provider credentials.
- `models.invoke` starts a host-owned, streamed model call and charges the user's configured provider account.
- changing the persistent main-session default additionally requires `session.main.model.set`.
- plugins cannot add a provider, carry a provider key, or receive an API key in the first release.

### Tool operations

- `tools.list` returns the active session's normalized tool names and input schemas after host filtering.
- `tools.call` invokes a named host tool through the same dispatch and cancellation infrastructure used by the runner.
- a model-created tool loop is represented as descendants of the same root operation.
- direct plugin tool calls are allowed when the lease and grant include the tool.
- tool-specific operating-system, service, and account restrictions continue to apply.

### Main-session operations

A plugin-authored main-session action is rendered as a visible attributed turn. The transcript shows the plugin name, selected model, and whether the turn was started by a plugin command or plugin surface.

The plugin cannot silently interleave with an active main run. `runs.create({ target: "main" })` returns `SESSION_BUSY` while the main session is running. A plugin with `session.main.run.cancel` may visibly request cancellation and then start a new run after the cancellation completes.

The host persists plugin-authored turns through the normal session path so history, model state, attachments, notifications, and recovery remain consistent.

### BTW child-session operations

`runs.create({ target: "btw" })` creates an isolated child session with a bounded snapshot of the parent context and the same workspace. It receives its own run ID, stream, cancellation state, and audit trail.

BTW output returns to the plugin first. Publishing it to the main transcript requires `session.child.publish` and an explicit `btw.publish` request. Publication contains provenance linking to the child run and does not masquerade as a user-authored message.

## Runtime and Isolation Classes

### Declarative runtime

Plugins containing only Skills, connector Apps, and remote MCP declarations can use Standard or Custom grants. They do not receive a general local process.

### Native local runtime

Plugins that start a local MCP server, Node process, executable, or local UI server are marked `native-local`. In the first release they require Full Trust before execution.

The host still applies these protections:

- a minimal environment instead of inheriting the entire Electron process environment;
- a random per-launch bridge token;
- loopback-only bridge binding;
- request size and schema validation;
- canonical path and workspace-root validation for brokered file operations;
- a separate persistent BrowserView partition per plugin rather than the ordinary browser partition;
- process readiness, cancellation, logs, and deterministic shutdown;
- no generic renderer or Electron IPC access.

These controls protect host APIs and state. They do not claim to restrict what an unsandboxed native process can do through ordinary operating-system APIs. The installation UI must state that a native local plugin runs as the current operating-system user. A future sandbox runtime can provide stronger filesystem, process, and network enforcement without changing the capability protocol.

## Secrets

Plugin processes never receive raw model-provider credentials. A plugin that needs another service declares `secrets.use:<secret-id>`. The host stores the secret using the platform credential facility and performs a scoped request or injects a single-use credential into a brokered operation.

The audit log records that a secret capability was used, but it redacts the secret, authorization headers, known credential fields, and raw environment values.

## Lifecycle

The lifecycle states are:

```text
discovered
validated
awaiting-permission-review
installed
activating
active
degraded
deactivating
disabled
update-staged
rollback-required
broken
uninstalled
```

Installation performs source resolution, package hashing, manifest normalization, engine validation, contribution conflict detection, native-code classification, and permission review before activation.

Updates are staged beside the active version. The coordinator validates the staged version, computes the manifest and permission difference, runs package health checks, and performs an atomic registry switch. If activation or health checks fail, the previous version remains active and the staged failure is retained for diagnostics.

Uninstall first revokes leases and grants, deactivates contributions, stops runtime processes, removes adapter references, and then removes package files owned by the Plugin Registry. Files owned by an external authority such as the Claude plugin manager or skill-manager are not deleted by the registry adapter.

## Management UI

Settings gains a registry-backed Plugins section with:

- Overview
- Installed
- Marketplace
- Permissions
- Activity and audit
- Developer mode

Each plugin shows source, version, content hash, runtime class, contributions, grant profile, effective capabilities, health, resource use, update state, and recent privileged calls.

The permission review distinguishes host capabilities from native operating-system exposure. A native local plugin cannot be presented as safely restricted merely because it requested a short host capability list.

The active chat displays plugin attribution for main-session turns, BTW publication, model selection, tool activity, cancellation, and permission failures.

## Structured Errors

The broker returns stable codes with a human-readable message, retryability, capability name when relevant, and a remediation action:

- `MANIFEST_INVALID`
- `ENGINE_INCOMPATIBLE`
- `PERMISSION_REQUIRED`
- `PERMISSION_DENIED`
- `LEASE_REQUIRED`
- `LEASE_EXPIRED`
- `SESSION_NOT_ACTIVE`
- `SESSION_BUSY`
- `MODEL_UNAVAILABLE`
- `TOOL_UNAVAILABLE`
- `TOOL_INPUT_INVALID`
- `PLUGIN_UNHEALTHY`
- `PLUGIN_CRASHED`
- `REQUEST_CANCELLED`
- `UPDATE_ROLLED_BACK`

A plugin crash revokes its active leases, cancels related model and tool operations, closes its bridge, preserves logs, and marks health as `degraded` or `broken`. The first release does not automatically restart the plugin in the background. The user can restart it from an active session.

## Audit Model

Each privileged operation records:

- timestamp, plugin ID, installed version, and install hash;
- session ID, lease ID, root operation ID, and request ID;
- requested and effective capability;
- selected model profile without credentials;
- tool name and redacted input summary;
- result state, duration, token usage, cancellation, and structured error;
- whether the result was published into the main transcript.

Audit retention follows the application's existing local data policy. Disabling or uninstalling a plugin does not erase prior audit records automatically.

## Migration Strategy

Migration is adapter-first and keeps existing user behavior working:

1. Introduce the canonical registry and manifest normalizer without changing existing runtime ownership.
2. Accept the existing `tech-cc-hub.plugin.json` workspace manifest through a compatibility normalizer and map it to the new runtime and surface contributions. New enhanced packages use `tech-cc-hub.json`; current packages keep working during migration.
3. Register current workspace plugins, managed skills, built-in/external MCP servers, and Claude plugins as adapter-backed records.
4. Replace the hard-coded Plugins settings table with registry queries while retaining the current plugin-specific installers behind typed adapters.
5. Add the Permission Ledger and require grants only for new enhanced capabilities; existing behavior retains compatibility grants during migration.
6. Route Codex Canvas through the canonical registry and Capability Broker. Canvas is the first real enhanced-plugin integration because it already contains a Codex manifest, MCP declaration, tech-cc-hub surface manifest, local process, and session bridge.
7. Route new plugin Agent Runtime calls through the existing runner and session event path.
8. Move installation and update ownership into the Lifecycle Coordinator only after adapter parity tests pass.

A test-only conformance plugin exercises every protocol method and failure mode. It is not included as a user-facing bundled plugin.

## Data Flows

### Install and activate

```text
source resolver
  -> package hash
  -> Codex + tech-cc manifest normalization
  -> contribution validation
  -> runtime classification
  -> permission review
  -> registry transaction
  -> adapter registration
  -> health check
  -> active
```

### User-triggered privileged run

```text
explicit user action in active session
  -> create operation lease
  -> plugin requests model, tool, or session action
  -> authenticate transport identity
  -> intersect host, manifest, user, and lease grants
  -> dispatch to runner/session/tool service
  -> stream visible progress
  -> append audit record
  -> complete or cancel root operation
  -> revoke lease
```

## Verification Strategy

### Unit tests

- Codex manifest fixtures normalize without a tech-cc-hub manifest.
- enhanced manifest validation rejects unknown required capabilities, unsafe paths, incompatible engines, and duplicate contributions.
- grant-profile expansion produces the correct atomic capabilities.
- capability intersection rejects undeclared, ungranted, unavailable, and out-of-lease calls.
- Full Trust expands `tools.call:*`; Custom grants preserve named-tool restrictions.
- lease creation, descendant calls, cancellation, session replacement, completion, and hard expiry behave deterministically.
- audit redaction removes secrets and sensitive headers.

### Integration tests

- an unmodified Codex plugin contributes Skills and an MCP server.
- an enhanced plugin lists host model profiles without receiving credentials.
- an enhanced plugin invokes a selected user model and receives a streamed response.
- an enhanced plugin creates a BTW session, calls a host tool, and publishes attributed output.
- a main-session call is rejected while the main run is busy.
- revoking a grant immediately blocks the next privileged call.
- a native plugin crash cancels its runs and revokes its lease.
- an update with new capabilities waits for review and preserves the active old version.

### End-to-end tests

- install and enable an unmodified Codex plugin from a supported marketplace source.
- enable Codex Canvas as a native Full Trust plugin and open its isolated Activity Rail surface.
- from Canvas or the conformance fixture, select a configured model, create a BTW run, call an arbitrary available tool, and publish a result to the main transcript.
- verify that the transcript attribution and audit record agree on plugin, model, tool, run, and result.
- close or switch the active session and verify that all subsequent calls using the old lease fail.

## Acceptance Criteria

- Existing Codex plugin packages install without tech-cc-hub-specific edits.
- Enhanced plugins can request, receive, and use model, tool, main-session, and BTW capabilities through one protocol.
- Full Trust can grant all declared host capabilities, including every tool available to the active session.
- Model credentials never enter a plugin process or RPC response.
- Main-session effects are visible, attributed, persisted, and cancellable.
- BTW runs are isolated and require an explicit publish operation to enter the main transcript.
- No privileged model or tool request succeeds without a valid user-triggered operation lease.
- Native local code is clearly identified and requires Full Trust in the first release.
- Current workspace plugins, skills, MCP servers, and Claude plugins remain available throughout adapter migration.
- Permission changes, crashes, update failures, and denied calls produce structured errors and audit evidence.

## Delivery Decomposition

The implementation plan should divide work into five sequential milestones:

1. canonical manifests, registry, contribution graph, and adapter records;
2. permission ledger, grant-profile UI, and migration compatibility grants;
3. Active Session Lease, Capability Broker, Agent Runtime RPC, and audit service;
4. main-session, BTW, model, and tool integrations plus Codex Canvas migration;
5. lifecycle-owned installation, marketplace sources, health, updates, and rollback.

Each milestone must preserve existing behavior and ship with its own unit and integration coverage before the next subsystem is migrated.
