# Design QA: AI 接口与模型目录

## Comparison target

- Connection reference: `C:/Users/LUSHEN~1/AppData/Local/Temp/codex-clipboard-f2f7f51e-e7bc-4c19-8ab7-b0f1eed25ce4.png`.
- Catalog reference: `C:/Users/LUSHEN~1/AppData/Local/Temp/codex-clipboard-6eb3eb0a-d591-4792-83ab-c44a5a2967a9.png`.
- Routing reference: `C:/Users/lushengtao/AppData/Roaming/LarkShell/sdk_storage/2086a44d6baf03a072e112fccd285ea6/resources/images/img_v3_0213j_c229e887-f64f-4bc4-a4d3-5b16f61b5d5g.jpg`.
- Implementation captures: `C:/Users/lushengtao/.codex/visualizations/2026/07/14/019f5eae-3b33-7a71-8cb6-d43a9b5c7691/ai-interface-connections-1487.png`, `ai-interface-catalog-1487.png`, `ai-interface-catalog-detail-1487-v2.png`, `ai-interface-catalog-detail-1280-v2.png`, and `ai-interface-routing-1487.png` in the same directory.
- Current routing implementation captures: `D:/tool/tech-cc-hub/.omx/state/ai-interface-routing/implementation-1850x1125.png` and `D:/tool/tech-cc-hub/.omx/state/ai-interface-routing/implementation-content.png`.
- Combined comparison inputs: `comparison-connections-half.png` and `comparison-catalog-detail-half.png` in the earlier capture directory, plus `D:/tool/tech-cc-hub/.omx/state/ai-interface-routing/comparison.png` for the selected routing reference.

## Viewport and state

- Desktop comparison viewport: 1487 x 1058 CSS pixels, matching both references.
- Narrow desktop containment viewport: 1280 x 900 CSS pixels.
- Compared states: selected Boke connection, 124-deployment catalog, catalog detail open, routing strategy, query filtering, and masked API key.
- Runtime surface: Vite development renderer with Electron fallback shim and injected realistic gateway discovery data.
- Current routing capture: 1850 x 1125 physical pixels from the live Electron window at Windows DPI 120; the focused content comparison crop is 1517 x 989.
- Current routing state: routing tab selected with model menus closed. The grouped main-model combobox was opened and closed without changing the configured value.

## Required fidelity surfaces

- Fonts and typography: passed. Existing CJK system font stack, compact 10–14px table hierarchy, 28px page title, and medium-weight tabs remain readable without clipping.
- Spacing and layout: passed. The connection page uses a 340px master list and one detail surface; the catalog uses a dense toolbar, 44px rows, pagination, and a 340px detail panel. At 1280px the detail panel becomes an overlay and the page has no horizontal overflow.
- Colors and tokens: passed. Existing orange accent, neutral settings background, white panels, subtle borders, and semantic green/amber/neutral states match the references without introducing another palette.
- Copy and content: passed. Protocols are separated from capabilities, inferred abilities are marked as inferred, missing upstream health and price data are not fabricated, and `routingWeight` is labeled as routing priority rather than traffic percentage.
- Icons: passed. New UI icons use Lucide; no handcrafted illustration or placeholder asset was introduced.
- States and interactions: passed. Tabs, connection selection, key reveal, filters, pagination, row selection, detail editing, bulk management, route-use exclusion guard, and responsive close behavior are wired.
- Accessibility: passed for the scoped surface. Tabs, checkboxes, search, close actions, password visibility, and filter selects have semantic roles or labels; statuses include text rather than color alone.
- Routing layout fidelity: passed. The overview, primary route, execution roles, and multimodal capabilities use the selected separate-card hierarchy; the lower cards keep the reference's approximately 1.55:1 proportion, field alignment, and compact density.
- Routing image and asset fidelity: passed. The selected screen contains no raster content assets; section icons use the existing Lucide dependency and no placeholder or handcrafted SVG was added.

## Findings

- P0: none.
- P1: none.
- P2: the existing settings shell reserves a wider outer gutter than the catalog reference, leaving the in-flow desktop table slightly narrower when the detail panel is open. The affected route-use column is intentionally hidden in that state rather than wrapping vertically.
- P3: the connection reference shows a persistent green health result and the catalog reference shows model health/pricing. The implementation only shows real test feedback and gateway-returned fields, so these unsupported values are intentionally absent.

## Comparison history

### Iteration 1

- Finding: P1. Opening the catalog detail panel left too little width for the route-use column and caused vertical Chinese text; the 1280px layout also compressed all filters beneath the panel.
- Fix: hide the route-use column while detail is open and switch the detail panel to an overlay below 1440px.
- Post-fix evidence: the 1487px table remains dense and readable; the 1280px screenshot has `scrollWidth === clientWidth` and a usable closeable overlay.

### Iteration 2

- Finding: P1. Models with protocol metadata such as `openai` were shown as generic text even when their IDs clearly indicated embedding or speech.
- Fix: treat protocol endpoint types separately and fall back to name-based capability inference unless explicit capability metadata such as `image-generation` is present.
- Post-fix evidence: the catalog shows `嵌入·推断`, `语音·推断`, and `图片生成` separately, while the detail panel still lists `openai`/`anthropic` under interface protocols.

### Iteration 3

- Finding: P1. The routing panel forced six controls across the full viewport height, split multimodal fields into a heavy grey sidebar, and placed follow-main actions away from their fields.
- Fix: changed the page to a natural-height three-level layout with a highlighted main route, compact execution-role grid, horizontal multimodal row, and field-local follow actions.
- Post-fix evidence: the live Electron window at 1467 x 894 shows no control clipping or horizontal overflow; the bordered panel ends with its content instead of filling the remaining viewport.

### Iteration 4

- Finding: P1. The selected modular-card reference separates the overview, primary route, execution roles, and multimodal capabilities, with a roughly 1.55:1 lower grid. Iteration 3 still used one enclosing surface and a horizontal multimodal row.
- Fix: rebuilt the routing content as four distinct cards, made the primary route full-width, grouped the expert and two delegated execution fields in the left card, stacked the two multimodal fields with a divider, and placed follow-main pills beside the small/background, Prompt analysis, and image preprocessing labels.
- Post-fix evidence: `D:/tool/tech-cc-hub/.omx/state/ai-interface-routing/comparison.png` and the live Electron capture show matching hierarchy, card proportions, field alignment, and accent usage with no clipping or overlap. Visual-verdict score: 95/100; remaining differences are P3 token-level polish.

## Final result

Passed. Visual-verdict score: 95/100. The remaining routing differences are a slightly lighter warm tint, marginally denser vertical spacing, and slightly stronger card-heading weights; all are P3 polish.

final result: passed

---

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
