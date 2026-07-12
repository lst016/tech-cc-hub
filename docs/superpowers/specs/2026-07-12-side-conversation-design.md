# Side Conversation Design

## Goal

Add a `侧聊` feature to the existing right Activity Rail so a user can keep the primary conversation visible while reading and continuing a second conversation beside it. Side-conversation activity must never switch or mutate the primary conversation implicitly.

## Confirmed Scope

- `侧聊` is a first-class Activity Rail tab alongside usage, preview, Git, terminal, workflow-agent, and plugin tabs.
- The primary conversation remains selected in the center workspace.
- The side panel can open an existing non-archived conversation or create a new conversation in the same workspace.
- A newly created side conversation is persisted as a normal session and remains available from the left sidebar after the panel closes.
- The panel renders the selected conversation history, streaming output, run state, errors, and permission requests.
- The panel supports text follow-ups, stopping a running turn, switching its target conversation, and closing the side view.
- Side-conversation selection is remembered per primary conversation for the lifetime of the renderer.

Version one does not add attachment picking, queued prompts, goal controls, message revision, or an additional Browser Workbench inside the side panel. These remain available when the same session is opened as the primary conversation.

## Alternatives Considered

### Activity Rail tab with a persisted session (selected)

This reuses the existing right-side layout, session protocol, store, transcript renderer, persistence, and resize behavior. It provides genuine side-by-side conversation without duplicating the complete workspace shell.

### Ephemeral renderer-only side chat

This would be smaller initially, but it would lose durable history and could not safely reuse the normal runner, tools, permission flow, or restart recovery.

### Two complete chat workspaces

This would offer full composer parity, but the current `App.tsx` and `PromptInput` are intentionally bound to one `activeSessionId`. Splitting every workspace concern into two instances would be a broad refactor that is not required for the first useful version.

## Architecture

`App.tsx` remains the owner of the primary `activeSessionId` and right-rail visibility. It stores `sideSessionIdByPrimarySessionId`, opens the Activity Rail on the `sidechat` tab, and passes the primary session id, selected side session, session list, and event dispatcher to a new `SideConversationPanel`.

`activity-workspace-tabs.ts` adds the stable `sidechat` tab id. `ActivityWorkspaceTabs` exposes the `侧聊` tab and keeps existing fallback behavior when other dynamic tabs close. `ActivityRail` delegates only the side-chat body to `SideConversationPanel`; existing usage, preview, Git, terminal, workflow, and plugin rendering stays unchanged.

`SideConversationPanel` owns its local draft, target picker, scroll-to-latest behavior, send/stop actions, and permission responses. It uses the existing `ChatTranscript` for message rendering and targets protocol events explicitly by its own session id rather than reading `activeSessionId`.

A small pure helper module owns target filtering and send eligibility. This keeps session isolation rules independently testable and avoids embedding more conditional state in `App.tsx` or `ActivityRail.tsx`.

## Background Session Activation Contract

Creating a session currently makes every newly observed session active. Side-chat creation therefore extends `session.create` and `session.start` with an optional `activation` value and an optional renderer-generated `clientRequestId`:

- omitted or `foreground`: preserve current behavior and activate a new session;
- `background`: persist and stream the session without changing `activeSessionId`.

The initial `session.status` event echoes the activation value and request id. `useAppStore` still inserts and updates the session, but skips the automatic `setActiveSessionId` calls for a background session. It also exposes the latest `{ clientRequestId, sessionId }` background-create result as transient renderer state. Later status and stream events need no special handling because the session id is already known.

The panel first sends `session.create` with `activation: "background"` and a unique request id. `App.tsx` records that request against the current primary conversation. When the matching background-create result arrives, it associates the new session id with that primary conversation and selects it in the side panel. Subsequent prompts use `session.continue`. This explicit correlation avoids relying on event ordering or title matching.

## Data Flow

1. The user opens the `侧聊` Activity Rail tab.
2. The panel defaults to the remembered side session, otherwise offers recent sessions excluding the primary conversation.
3. `新建侧聊` sends a background `session.create` using the primary conversation workspace and records its unique request id.
4. The renderer store receives the initial background status, records the session and matching request result, and keeps the primary `activeSessionId` unchanged.
5. The panel matches the request result, selects the new session, and hydrates history through the existing `session.history` event.
6. Sending text dispatches `session.continue` with the side session id and current runtime controls.
7. Stream and status events update the shared session record, so the side transcript refreshes without touching the center transcript.
8. Stop and permission actions dispatch existing session-scoped protocol events with the side session id.

## Interaction and Visual Design

- The Activity Rail tab label is `侧聊` and uses the existing tab sizing and focus treatment.
- The panel header contains the current side-session title, a compact conversation selector, `新建侧聊`, and close controls.
- The transcript fills the resizable rail body and follows new output when the user is already near the bottom.
- The composer is a compact multiline text area with Enter to send and Shift+Enter for a newline.
- While the selected side session is running, the send action becomes a stop action and the draft remains intact.
- The primary conversation cannot be selected as its own side target.
- Empty, loading, deleted, archived, and errored targets show explicit recovery actions rather than a blank rail.

## Accessibility

- The tab, target selector, transcript region, composer, send, stop, new-session, and close controls all have stable accessible names.
- The target selector exposes the currently selected conversation.
- Keyboard focus remains inside the control being used; opening the tab does not steal focus from the primary composer.
- Enter sends only when the draft is non-empty and the side session is idle. Shift+Enter inserts a newline.
- Live run and error state are exposed through concise status text without making the full transcript an assertive live region.

## Error Handling

- A missing workspace disables side-session creation with an explanatory message.
- A deleted or archived selected session clears the remembered target and returns to the picker.
- A running side session rejects additional sends and retains the draft.
- Protocol or runner errors remain scoped to the side session and render in the panel; they do not replace the primary workspace error state.
- If a background create returns an unknown request id, it remains a normal persisted session and the panel presents it in the selector rather than guessing by title.

## TDD Plan and 80-Point Gate

Implementation follows strict RED-GREEN-REFACTOR order.

1. Pure tests first require target filtering, send eligibility, background activation semantics, and per-primary target retention.
2. Protocol/store tests first prove that a background session is inserted without replacing `activeSessionId`, while foreground creation preserves existing behavior.
3. UI source/integration tests first require the `sidechat` tab, isolated event targeting, keyboard send behavior, stop behavior, and explicit empty/error states.
4. Browser QA first requires the development shim to expose two sessions and verifies that side-chat interaction never changes the center conversation.
5. Only after each test fails for the intended missing behavior is the smallest production change implemented.

The completion score is:

- Functional side-chat behavior and session isolation: 40 points
- Correct background activation and persistence: 20 points
- Interaction, accessibility, and recovery states: 15 points
- Automated regression and browser coverage: 15 points
- Code quality and scope control: 10 points

Completion requires at least 80/100, all focused tests passing, TypeScript and production build success, scoped ESLint with no errors, `git diff --check`, and a successful browser smoke run that proves the primary conversation remains unchanged.

## Scope Boundaries

- No new dependency.
- No database schema change.
- No deletion or auto-archive when the side panel closes.
- No full duplicate of `PromptInput` or the center workspace.
- No attachment, queue, goal, revision, browser, preview, or terminal controls inside the first side-chat composer.
