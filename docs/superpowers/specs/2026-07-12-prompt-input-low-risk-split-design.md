# PromptInput Low-Risk Component Split Design

## Goal

Reduce the size and visual complexity of `PromptInput.tsx` without changing composer behavior.

## Boundaries

The first pass extracts only JSX islands that already communicate with the parent through explicit values and callbacks:

- `PromptComposerPalettes.tsx` owns the Slash command palette and file-mention palette markup.
- `PromptComposerFooter.tsx` owns the model menu and composer action-button markup.
- `PromptInput.tsx` retains all state, refs, effects, keyboard handling, editor synchronization, send/queue logic, attachment handling, drag/drop handling, and async file scanning.

The extraction does not add context providers, custom state hooks, dependencies, feature flags, or behavior changes. Existing child components such as `PromptComposerContextChips`, `PromptComposerTerminalStrip`, and `ComposerModelMenu` remain unchanged.

## Data Flow

`PromptInput` computes palette options and footer state, then passes primitives, typed option arrays, and event callbacks downward. Child components never mutate the app store or perform file-system work. The file refresh callback remains implemented in `PromptInput`, so the palette stays presentational.

## Behavior Lock

- Add a structural regression test requiring `PromptInput` to compose both extracted modules and forbidding the old large inline palette/footer blocks.
- Run the existing prompt-input tests that protect attachments, native undo/newlines, clear-on-send, session drafts, minimum width, icon tooltips, workflow state, and overlay layering.
- Run scoped ESLint, TypeScript/Vite production build, and a browser-preview smoke check that confirms the editor renders without console errors.

## Success Criteria

- `PromptInput.tsx` is materially shorter and remains the orchestration owner.
- Extracted children are stateless with respect to application data.
- No user-visible label, class, event, disabled condition, or accessibility attribute changes.
- All focused tests and the full build pass.
