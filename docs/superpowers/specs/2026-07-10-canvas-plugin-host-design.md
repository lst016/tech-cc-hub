# Canvas Plugin Host Design

**Status:** Approved for implementation on 2026-07-10.

## Goal

Embed the complete Codex-Canvas application as a right-hand Activity Rail tab. A selected canvas asset, its recorded prompt, and a user note are sent to the currently visible tech-cc-hub chat session through the app's real session continuation path. The same host contract must support future locally installed workspace plugins.

## Decisions

- The first surface is a right-side `Canvas` tab, not a full-screen replacement. The left chat remains visible while the canvas is open.
- `plugins/codex-canvas/` holds a pinned, full upstream Codex-Canvas snapshot. The snapshot is imported with Git subtree so it is tracked as normal repository content and can be refreshed from the upstream repository.
- The only upstream behavior change is its chat transport. Canvas object lookup, asset storage, image editing, OCR, layer editing, PSD export, collection, and frontend all remain upstream implementations.
- The patched transport sends `POST /v1/session/send` to a loopback bridge started by tech-cc-hub instead of launching a temporary Codex app-server. The bridge resumes no external thread: it calls the existing `session.continue` event handler for the active tech-cc-hub session.
- The first plugin permissions are `session.snapshot` and `session.send`. The manifest is designed to add further explicit permissions without granting them implicitly.

## Plugin Layout

```
plugins/
  codex-canvas/
    tech-cc-hub.plugin.json
    UPSTREAM.md
    public/                       # upstream canvas UI
    src/                          # upstream runtime plus transport patch
      tech-cc-hub-transport.mjs   # new, isolated connection module
    scripts/tech-cc-hub-transport-smoke.mjs
```

`tech-cc-hub.plugin.json` contains the identifier, display label, tab surface, start command, and declared permissions. The host scans only `<application-root>/plugins/*/tech-cc-hub.plugin.json`; it does not execute undeclared directories. `UPSTREAM.md` records the upstream Git URL, imported revision, and the exact files intentionally changed for host integration.

## Host Contract

The Electron main process owns plugin discovery, process lifetime, loopback transport, and BrowserView bounds. The renderer owns the dynamic Activity Rail tab and asks the main process to start or hide a plugin surface.

Each plugin launch receives four process environment values:

```
TECH_CC_HUB_BRIDGE_URL=http://127.0.0.1:<ephemeral-port>
TECH_CC_HUB_BRIDGE_TOKEN=<per-launch-random-token>
TECH_CC_HUB_SESSION_ID=<active-session-id>
TECH_CC_HUB_WORKSPACE=<active-session-cwd>
```

The transport accepts only loopback requests with the matching bearer token.

`GET /v1/session/snapshot` returns the title, state, model name, latest prompt, and a bounded list of recently generated image paths for the bound session. It never returns raw configuration, credentials, or the full conversation transcript.

`POST /v1/session/send` accepts a text instruction, source metadata, and one selected local image path. The bridge realpaths the asset, requires it to remain under the active session workspace, allows only the supported image extensions, caps the file at 8 MB, converts it to the existing `PromptAttachment` representation, and invokes `handleClientEvent({ type: "session.continue", ... })`. This preserves the user's model selection, tools, session history, persistence, and normal visible chat rendering.

The response is `202` only after the continuation request is accepted. A busy session, invalid token, invalid path, unsupported media type, or bridge failure produces a structured error; the Canvas keeps its selection and note intact for retry.

## Right-Rail UI

`ActivityRailTab` gains the `plugin:<pluginId>` form. The normal activity-tab builder receives discovered plugin descriptors and adds a visible tab for each enabled plugin. Selecting Canvas mounts a small `WorkspacePluginPane` inside the existing right rail. The pane starts the plugin for the active session, opens its localhost URL in a dedicated BrowserView surface, and keeps its bounds synchronized with the pane's content rectangle. Leaving the tab detaches the BrowserView without stopping the process; changing session stops the previous launch and starts a session-scoped canvas.

The first plugin's tab is always labelled `Canvas`. Future plugins use their manifest labels and the same tab/permission path; no Canvas-specific behavior is added to the generic tab builder.

## Codex-Canvas Connection Patch

The upstream `sendObjectToBoundChat()` function already resolves a selected object to a validated local asset path. It remains responsible for that lookup. Its `sendImageToBoundChat()` and `sendMentionToBoundChat()` calls are changed to call `tech-cc-hub-transport.mjs` when the host bridge environment variables are present. Outside tech-cc-hub, the upstream app-server behavior remains unchanged.

The transport includes the selected path, the existing object prompt, and an optional user note. It maps the `send-to-chat` action to a real image attachment. It maps `mention-file` to text context with the same selected asset path. Existing Canvas image-edit jobs continue to use their upstream Codex execution path.

## Verification

- Unit tests cover manifest normalization, duplicate plugin rejection, permission validation, bridge token validation, workspace-root path checks, and generation of a `session.continue` event with an image attachment.
- Activity Rail tests prove that manifest descriptors produce `plugin:<id>` tabs without disturbing preview, Usage, Git, Terminal, Browser, or workflow-agent tabs.
- A Canvas transport smoke test starts a temporary loopback host, verifies headers and payload mapping, and verifies that an absent bridge still takes the original app-server transport path.
- Production verification opens the Canvas tab in Electron, submits an actual selected asset, and confirms the left chat receives a real user turn and model run.

## Non-Goals

- No marketplace UI, remote plugin downloads, arbitrary plugin code execution, or automatic permission escalation in the first release.
- No simulated typing, clipboard automation, screen-coordinate clicking, or external Codex app-server dependency.
- No rewrite of Codex-Canvas rendering, image jobs, editing tools, asset store, or UI design.
