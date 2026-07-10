# Chat Selection Popover Visual Polish Design

Date: 2026-07-11
Status: Ready for written-spec review

## Goal

Restyle the chat text-selection popover to match the compact segmented toolbar shown in the target screenshot. Preserve every existing action, label, data path, and dismissal behavior.

## Scope

The change is limited to the selection popover rendered by `SelectableText` in `src/ui/components/EventCard.tsx` and focused regression coverage for its presentation contract.

The existing actions remain unchanged:

- `添加到对话` adds the selected text as a selection reference.
- `评论` expands or collapses the comment composer.
- `取消` closes the comment composer and clears its draft.
- `加入评论` adds the selected text and comment as a comment reference.
- `直接发送` sends the comment through the existing workflow path.

## Visual Design

### Default state

- Render the actions as one compact, content-width segmented toolbar.
- Use a 38px control height, a 10px outer radius, a one-pixel neutral border, and a low-strength shadow.
- Separate actions with a one-pixel vertical divider instead of independent pill borders.
- Keep the toolbar white and reserve the existing orange accent for the leading action and interactive emphasis.
- Keep text at 13px with medium weight so the toolbar reads as contextual chrome rather than a primary call to action.
- Retain the existing selection anchor and viewport positioning behavior.

### Comment-expanded state

- Keep the segmented toolbar visible as the visual anchor.
- Show the comment composer immediately below it, using the same neutral border, white surface, restrained shadow, and 12px radius.
- Use a 318px-wide composer capped at `calc(100vw - 24px)` to avoid the oversized empty shell visible in the current UI without overflowing narrow windows.
- Keep the textarea visually quiet with a light neutral fill, a 9px radius, and clear focus feedback.
- Align the three footer actions to the right. `取消` stays neutral, `加入评论` uses an outlined accent treatment, and `直接发送` remains the filled primary action.
- Highlight `评论` while the composer is open without changing its label or click behavior.

## Interaction and State

No behavior changes are introduced.

- Clicking `评论` continues to toggle `commentOpen` on the current selection draft.
- Clicking outside, scrolling, or resizing continues to dismiss through the existing listeners.
- The existing selection, comment trimming, reference creation, and send handlers remain intact.
- The popover remains portaled to `document.body` and keeps the current stacking context.
- The layout must stay within the existing maximum-width boundary on narrow windows.

## Component Boundary

Keep state and event handling inside `SelectableText`. Extract only presentation constants or class groupings if doing so materially improves readability; do not introduce a new dependency or a new shared abstraction for this one component.

Implement this as a small JSX/class update in `EventCard.tsx`. Reuse existing Tailwind utilities so the change stays local and reversible.

## Accessibility

- Preserve semantic `button` and `textarea` elements.
- Add an accessible pressed/expanded signal to the `评论` toggle if it is not already present.
- Keep visible keyboard focus treatment on all controls.
- Do not reduce target height below 38px.
- Preserve readable foreground/background contrast for neutral, accent, and primary states.

## Verification

- Run the focused selection-comment regression test in `test/electron/chat-selection-comment-actions.test.ts`.
- Run the focused Playwright smoke path in `scripts/qa/chat-selection-comment-smoke.cjs` when the local Electron-compatible development surface is available.
- Inspect both the collapsed and comment-expanded states at the same viewport and interaction state as the supplied screenshots.
- Confirm that `添加到对话`, `加入评论`, and `直接发送` still reach their existing handlers.
- Confirm that outside click, scroll, and resize still dismiss the popover.

## Non-goals

- Renaming actions or replacing them with the target screenshot's product-specific labels.
- Changing selection capture, comment persistence, reference formatting, or workflow submission.
- Refactoring unrelated event-card rendering.
- Introducing a new icon package or design-system dependency.
