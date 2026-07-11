# Collapsed Session Rail Design

## Goal

Keep recent conversations reachable when the full left sidebar is collapsed. The collapsed state becomes a narrow visual rail, and each rail item exposes a reference-style hover card containing the conversation title and its latest useful assistant response. The existing expanded sidebar and `/goal` behavior remain unchanged.

## Confirmed Scope

The selected direction is the collapsed-session-rail interpretation of the supplied screenshot:

- Collapsing the sidebar leaves a narrow rail instead of removing all conversation navigation.
- Recent conversations appear as short horizontal marks ordered by the same recency rule as the expanded sidebar.
- The active conversation has a darker, longer mark; running and unread states remain distinguishable without adding text.
- Hovering or keyboard-focusing a mark opens a floating preview card to its right.
- The card shows the conversation title and the latest non-empty assistant text, clamped to three lines.
- Clicking a mark, or pressing Enter/Space while it is focused, switches to that conversation.
- Expanding the sidebar removes the rail and restores the existing sidebar without changing its behavior.

This feature does not replace the prompt composer's current goal banner, alter goal tools, or add a plan-checklist popover.

## Interaction

The header's existing sidebar toggle continues to control `showSidebar`. When `showSidebar` is false, the application mounts `CollapsedSessionRail` at the left edge and reserves its width from the center workspace and prompt composer.

The rail displays a bounded set of the most recently updated, non-archived conversations. Pointer hover and keyboard focus open the preview. A short close grace period allows the pointer to travel from the mark to the card without flicker. The card stays open while either the trigger or card is hovered or focused. Escape closes it.

Selecting a rail item switches the active session and clears any unread marker exactly as selection from the expanded sidebar does. The active preview closes after selection. The sidebar toggle remains reachable from the application header.

## Visual Design

The rail follows the supplied reference:

- approximately 64 pixels wide with a subtle right divider;
- vertically stacked short neutral marks with generous spacing;
- one darker and longer mark for the active conversation;
- a white preview card with a light border, large rounded corners, and a soft shadow;
- a bold single-line title and muted three-line assistant summary;
- viewport-clamped fixed positioning so the card is never clipped by the rail or window edge.

The design uses existing color tokens where practical and avoids labels, badges, or dense metadata that are absent from the reference.

## Architecture

`App.tsx` remains the owner of expanded/collapsed sidebar state. It mounts either the existing `Sidebar` or a new `CollapsedSessionRail`, and computes the center/composer left offset from the visible surface.

`CollapsedSessionRail.tsx` owns rail rendering, hover/focus state, anchor measurement, and the preview portal. Pure helpers in `session-rail-preview.ts` select recent sessions and extract a readable assistant summary from existing `SessionView.messages`. No Electron IPC, database, or session persistence changes are required.

The helper accepts only the session fields it needs. This keeps message-shape parsing independently testable and prevents another large block of conditional UI from accumulating in `Sidebar.tsx`.

## Data Flow

1. `useAppStore` continues receiving session list, status, history, and streaming message updates.
2. `App.tsx` passes the current session map and selection callback to the collapsed rail.
3. A pure selector sorts conversations by `updatedAt` and applies the visible limit.
4. A pure summary extractor scans messages from newest to oldest, skips tool-only/system/empty content, normalizes assistant text, and returns the first readable excerpt.
5. Hover or focus records the session id and trigger rectangle; a portal renders the card using live store data.
6. Streaming updates refresh an open card without reopening or moving it unnecessarily.

## Empty, Error, and Loading States

- No conversations: render the empty rail shell without preview triggers.
- No assistant response: show a short neutral fallback such as `暂无回复摘要`, while preserving the title.
- Partial streaming response: use the currently visible assistant text when it is non-empty.
- Deleted or archived session while preview is open: close the preview safely.
- Narrow viewport: clamp the card within a 12-pixel window margin and cap its width to available space.
- Malformed message content: ignore unsupported blocks rather than surfacing raw objects or tool payloads.

## Accessibility

- Every rail mark is a real button with a session-specific accessible label.
- The active mark exposes `aria-current="page"`.
- A trigger uses `aria-expanded` and `aria-controls` while its preview is open.
- The preview is a labelled region and does not steal focus on hover.
- Enter and Space select a conversation; Escape closes the preview.
- Focus-visible styling remains discernible even though the visual marks are intentionally minimal.

## Verification and 85-Point Gate

Implementation follows TDD. Automated tests first prove summary extraction, recency selection, fallback behavior, and source-level accessibility/integration contracts. A query-gated development fixture then drives a Playwright smoke test against `npm run dev:react`, because the Electron browser shim is required for representative session data.

The visual smoke test will collapse the sidebar, verify the rail, hover an inactive and active session, assert the title and assistant summary, switch conversations, exercise keyboard controls, and save a screenshot for direct comparison with the reference.

The final score uses this 100-point rubric:

- Functional behavior: 35 points
- Reference visual fidelity: 25 points
- Interaction and accessibility: 15 points
- Regression safety and automated tests: 15 points
- Code quality and scope control: 10 points

Completion requires at least 85 points, passing targeted tests, TypeScript/Vite build success, scoped lint with zero errors, a successful Playwright smoke run, and direct inspection of its screenshot.
