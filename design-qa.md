# Design QA: Chat Selection Popover

## Comparison target

- Collapsed source visual truth: `C:/Users/LUSHEN~1/AppData/Local/Temp/codex-clipboard-b550f5ff-5c39-49ae-88c2-698abaafca0a.png`.
- Expanded source visual truth: `D:/tool/tech-cc-hub/.superpowers/brainstorm/selection-popover-20260711/content/selected-a-design.html`.
- Full-view implementation screenshots:
  - `D:/tool/tech-cc-hub/.superpowers/design-qa/chat-selection-popover/runtime-collapsed-full.png`.
  - `D:/tool/tech-cc-hub/.superpowers/design-qa/chat-selection-popover/runtime-expanded-full.png`.
- Focused implementation screenshots:
  - `D:/tool/tech-cc-hub/.superpowers/design-qa/chat-selection-popover/runtime-collapsed-focus.png`.
  - `D:/tool/tech-cc-hub/.superpowers/design-qa/chat-selection-popover/runtime-expanded-focus.png`.
- Combined comparison: `D:/tool/tech-cc-hub/.superpowers/design-qa/chat-selection-popover/comparison.png`.

## Viewport and state

- Desktop viewport: 1600 x 1100 CSS pixels.
- Narrow containment viewport: 480 x 800 CSS pixels.
- Compared states: selected assistant text with the toolbar collapsed, then the same selection with `评论` expanded.
- Runtime surface: Vite development renderer with the repository Electron fallback shim enabled through the browser-preview flag.

## Full-view comparison evidence

- The toolbar remains anchored immediately above the selected assistant text without covering the message's reading flow.
- The collapsed state removes the former 220px minimum shell, large padding, pill gaps, and heavy shadow.
- The expanded state keeps the compact toolbar visually independent from the 318px comment card instead of turning both controls into one oversized surface.
- At 480px viewport width, the popover bounding box was `x=300.39`, `width=167.22`; its right edge remained at `467.61`, inside the viewport.

## Focused-region comparison evidence

- The focused collapsed capture confirms a 38px segmented control, one-pixel divider, 10px radius, white surface, and restrained shadow.
- The focused expanded capture confirms a separate 12px-radius comment card, quiet textarea, right-aligned footer actions, and filled orange primary action.
- Focused regions were required because border radius, divider weight, selection-highlight overlap, and button hierarchy were not readable enough in the full-app screenshots.

## Required fidelity surfaces

- Fonts and typography: passed. The component keeps the product's system font, uses 13px medium toolbar labels, 13px textarea text, and 12px semibold footer actions without clipping or unintended wrapping.
- Spacing and layout rhythm: passed. The toolbar is content-width, 38px high, and centered above a responsive 318px comment card. Independent borders and elevation preserve the approved A hierarchy.
- Colors and visual tokens: passed. Neutral borders and white surfaces match the target's light chrome; `添加到对话` uses the requested black text, while orange remains limited to the existing return glyph and primary send action.
- Image quality and asset fidelity: not applicable. The component contains no raster imagery, logos, illustrations, or custom icon assets. The existing return glyph remains text and is hidden from assistive technology.
- Copy and content: passed. `添加到对话`, `评论`, `取消`, `加入评论`, `直接发送`, and the textarea placeholder remain unchanged.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: a few pixels of the live blue text-selection highlight can remain visible outside the rounded top corners of the expanded card. This is underlying page context rather than a component-surface mismatch and does not affect readability or action discovery.

## Comparison history

### Iteration 1

- Finding: P2. The toolbar and comment composer shared one large bordered shell, which retained too much of the oversized current-UI character.
- Fix: moved border, radius, background, and shadow onto the toolbar and comment card independently; retained the responsive 318px width.
- Post-fix evidence: the expanded focused capture shows the compact toolbar centered above a separate comment surface.

### Iteration 2

- Finding: P3. A transparent six-pixel gap exposed a distracting blue strip from the selected text beneath the popover.
- Fix: raised the comment card behind the toolbar and placed the toolbar at a higher stacking level, preserving independent surfaces while masking the central blue strip.
- Post-fix evidence: the final expanded focused capture retains only minor selection context around the card's outer rounded corners.

### Final visual verdict

- Score: 96/100.
- Verdict: pass.
- Category match: true.
- No actionable P0, P1, or P2 differences remain.

## Interaction checks

- `添加到对话`: passed; a selection reference appeared in the QA store.
- `评论` expand/collapse: passed in both directions.
- `加入评论`: passed through `scripts/qa/chat-selection-comment-smoke.cjs`.
- `直接发送`: passed; the local `techcc:prompt-submit` event fired once.
- Outside-click dismissal: passed with a real click outside the message and popover.
- Scroll dismissal: passed from the chat scroll surface.
- Resize dismissal: passed after guarding non-Node window event targets.
- Narrow-window containment: passed at 480px width.
- Browser console: passed with zero unexpected errors on a clean post-fix run.

## Verification summary

- Focused source-contract test: passed.
- Production renderer build: passed after the final visual and resize-dismissal fixes.
- Playwright selection-comment smoke: passed after switching the QA URL to the fallback browser-preview runtime and using a deterministic QA session.

final result: passed
