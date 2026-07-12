# Current Session Plan Hover Design

## Goal

Keep an unfinished plan visible at the bottom of the active conversation without occupying the full composer width. The default state shows only progress such as `2/4 步`; hovering or keyboard-focusing it reveals the full plan. Completing every step removes the control.

## Selected interaction

The existing `CurrentSessionPlanDock` owns a small open/closed interaction state.

- Closed by default: the bottom surface contains only one centered `{completed}/{total} 步` trigger. It must not show the session title, step rows, card shell, or any other plan content.
- Open on pointer hover or keyboard focus: reveal the existing plan header and step list in a popover anchored above the pill.
- Keep the popover open while the pointer moves between the pill and the details.
- Close when the pointer and keyboard focus leave the component.
- Do not move or resize the composer when the popover opens; the full card overlays upward.
- Preserve the existing rule that a missing, empty, or fully completed plan renders nothing.
- Follow only the active conversation's latest plan.

## Alternatives considered

1. **Component-managed hover/focus state (selected).** Keeps pointer and keyboard behavior consistent, exposes accurate accessibility state, and is easy to cover in browser QA.
2. **CSS-only `hover`/`focus-within`.** Smaller implementation, but it cannot accurately expose expanded state and is harder to test as an explicit interaction contract.
3. **Click-to-toggle popover.** Works better on touch devices, but conflicts with the requested hover interaction and adds dismissal behavior that is not needed here.

## Component boundaries

`PromptInput` remains responsible only for selecting the active session plan and placing the surface directly above the composer. `CurrentSessionPlanDock` is responsible for progress formatting, hover/focus state, the compact pill, and the expanded details. Existing plan-summary utilities continue to decide completed and total counts.

No new dependency or cross-session state is introduced.

## Visual behavior

- The compact trigger is centered immediately above the composer and visually floats with a white translucent surface, subtle border, and shadow. No full-width card shell is visible in this state.
- The label includes the Chinese unit: `2/4 步`.
- The expanded card keeps the current session title, progress badge, status icons, and scroll limit.
- Expansion grows upward from the compact trigger as an overlay, matching the supplied reference: the full card covers conversation content instead of changing document flow, so the input box remains stationary.
- A short opacity/scale transition may be used, but the interaction must remain correct without animation.

## Accessibility

- The compact trigger is keyboard focusable and announces the active conversation's unfinished plan.
- `aria-expanded` reflects whether details are open.
- The popover has a stable relationship to its trigger and remains reachable while focus is inside it.
- Hover is not the only way to inspect the plan; focus opens the same details.

## Verification

### Test-first contract

1. Extend the UI source contract test before production edits so it requires a compact summary trigger, an expanded popover, and `aria-expanded` behavior. Confirm the test fails for the missing interaction.
2. Update browser QA before production edits to require:
   - `2/4 步` visible by default;
   - step details hidden by default;
   - details visible after hover;
   - composer geometry unchanged by expansion;
   - details hidden after pointer exit;
   - the entire surface hidden after all steps complete.
3. Implement the smallest component change that makes the tests pass.

### Completion gates

- Focused electron tests pass.
- Scoped ESLint passes.
- Production build passes.
- Plan browser QA passes and produces compact and expanded screenshots.
- Collapsed-session-rail browser QA still passes.
- Visual verdict score is at least 90.

## Scope exclusions

- No click pinning or manual dismissal.
- No persistence of expanded state.
- No plan editing or step controls.
- No change to plan-generation or completion data flow.
