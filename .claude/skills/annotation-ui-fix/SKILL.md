---
name: annotation-ui-fix
description: Use when a prompt contains browser annotations, browser diff comments, annotation DOM selectors/xpaths/source candidates, or a screenshot marker asking to fix UI behavior, layout, styles, attachments, drag-drop, buttons, dialogs, or interaction in the currently inspected page.
---

# Annotation UI Fix

Use this skill for annotation-driven UI fixes. Treat the latest annotation block as the current targeting source of truth.

## Inputs

- `page.url`
- `comment`
- optional `expectation`
- `dom.selector`, `dom.xpath`, `dom.path`
- optional `dom.sourceCandidates`, `dom.componentStack`, `dom.context.ancestorChain`, `dom.context.nearbyText`

## Workflow

1. Restate the observed problem and expected state in one sentence.
2. Locate source:
   - Use high-confidence `dom.sourceCandidates` first.
   - Otherwise use `componentStack`, `ancestorChain`, and nearby text to search.
   - If selector text is generic, inspect the same page location with xpath/path or browser tools before broad text search.
3. Read candidates efficiently:
   - If concrete files are known, read them in parallel.
   - If not, run one focused search, then read only the hits.
4. Patch narrowly:
   - Prefer existing component state, data flow, and styles.
   - Keep one iteration to at most 3 edited files unless the annotation proves a shared abstraction is broken.
5. Verify in the browser:
   - For DOM behavior, use `browser_query_nodes`, `browser_get_element`, or `browser_eval`.
   - For style, use `browser_inspect_styles`; use `browser_apply_styles` only for temporary CSS preview.
   - For HMR/build, wait with `browser_console_logs(waitFor)` or run the smallest relevant build/lint check.
   - For visual parity, optionally use `design_compare_current_view` when a reference exists.

## Output

- Root cause
- Changed files
- Browser verification evidence
- Build/lint/test evidence, or an explicit untested gap
