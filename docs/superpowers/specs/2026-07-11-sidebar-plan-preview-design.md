# Sidebar Plan Preview Design

## Goal

Expose each conversation's current execution plan from the chat list using the compact checklist popover shown in the reference image. The feature must preserve the existing list density and navigation behavior while making background progress inspectable without opening the conversation.

## Interaction

- A conversation with a non-empty `latestPlan` exposes its plan from the leading status indicator.
- Hovering the indicator or focusing it with the keyboard opens a popover to the right of the sidebar.
- The popover stays open while the pointer moves between the trigger and the card, and closes after a short grace period when both lose hover/focus.
- Clicking the surrounding conversation row continues to open the conversation. The plan trigger does not navigate or toggle the active conversation.
- Conversations without a plan retain the existing decorative dot/spinner and do not expose an empty popover.
- Archived conversations may display their last captured plan when available.

## Visual Design

The popover follows the supplied reference: a white, lightly bordered card with a soft shadow, rounded corners, compact rows, and one circular status marker per step.

- Completed: checked muted circle and subdued text.
- In progress: accent-colored partial/spinner treatment and emphasized text.
- Pending: empty dark-outlined circle and normal text.
- Long step labels wrap to a second line; the card has a bounded width and height with internal scrolling.
- The card is positioned using viewport coordinates so sidebar overflow does not clip it. Its vertical position is clamped to the viewport.

## Architecture

`Sidebar.tsx` already receives `SessionView.latestPlan`; no Electron, IPC, database, or persistence changes are required. A focused `SessionPlanPreview` component owns rendering and status semantics. `Sidebar` owns only which session trigger is active and the anchor coordinates.

The component accepts a `SessionPlanSnapshot`, an anchor rectangle, and close/open callbacks. This keeps the checklist independently testable and avoids growing the session-row markup further.

## Data Flow

1. Existing `update_plan` or task events update `SessionView.latestPlan` in `useAppStore`.
2. The sidebar row reads the latest snapshot directly from the session object.
3. Hover/focus on the status trigger records the session id and trigger geometry.
4. A portal renders the checklist at the calculated viewport position.
5. React store updates replace the displayed snapshot in place while the plan is open.

## Edge Cases and Accessibility

- Missing or empty plans render no trigger semantics and no card.
- Unknown status values are already normalized by `plan-progress.ts`; the preview still treats any unexpected value as pending defensively.
- The trigger has an accessible label containing completion counts and uses `aria-expanded`/`aria-controls`.
- The card uses a descriptive region label and does not steal focus.
- Escape closes an open preview.
- Opening a conversation or collapsing its workspace closes the preview.

## Verification and 85-Point Gate

Automated checks cover status/count derivation, source-level accessibility/portal wiring, and regression of existing plan parsing. A Playwright smoke run uses the development Electron shim to seed a plan, hover the sidebar trigger, assert visible checklist content, and save a screenshot.

The final score is reported on a 100-point rubric:

- Functional behavior: 35 points
- Reference visual fidelity: 25 points
- Interaction and accessibility: 15 points
- Regression safety and automated tests: 15 points
- Code quality and scope control: 10 points

Completion requires at least 85 points, successful targeted tests and type checking, and direct inspection of the rendered screenshot.
