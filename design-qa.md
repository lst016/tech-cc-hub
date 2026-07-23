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

# Design QA — Workspace action menu

## Scope and evidence

- Source visual truth: `C:\Users\LUSHEN~1\AppData\Local\Temp\codex-clipboard-5a56687c-3090-48ed-8188-716527d77ac8.png` (384×539), showing three equal-weight hover actions competing with the workspace title.
- Implementation capture: `C:\Users\LUSHEN~1\AppData\Local\Temp\tech-cc-hub-workspace-actions-menu-open.png` (1480×900), captured from the live Electron dev build in light theme with a Feishu workspace action menu open.
- Focused comparison: `C:\Users\LUSHEN~1\AppData\Local\Temp\tech-cc-hub-workspace-actions-comparison.png` (834×540), comparing the original inline button cluster with the revised overflow menu.
- Viewport: 1480×900 physical pixels at Windows 150% scaling, approximately 987×600 CSS pixels.

## Required fidelity surfaces

- Fonts and typography: passed. Existing sidebar typography is unchanged; menu labels use the compact 13px application scale.
- Spacing and layout rhythm: passed. A single 28px overflow trigger replaces the three-button cluster, preserving more width for long workspace names. The 176px menu uses consistent 6px internal padding and compact item heights.
- Colors and visual tokens: passed. The menu uses the existing neutral surface, border, shadow, and hover tokens; deletion is isolated in the existing destructive red treatment.
- Image quality and asset fidelity: passed. `More`, `Add`, `LinkTwo`, and `Delete` reuse the installed Icon Park set; no new asset or dependency was introduced.
- Copy and content: passed. Actions read “新建会话”, “关联工作区”, and “删除工作区” in task order, with the destructive action placed after a separator.

## Interaction and accessibility checks

- Default row: passed. Only one overflow affordance appears on hover or keyboard focus, so title and expansion state remain visually primary.
- Menu trigger: passed. The trigger retains an explicit Chinese `aria-label`, keyboard focus styling, and Radix menu semantics.
- Action wiring: passed. The existing create, link, and delete callbacks are preserved inside menu items.
- Destructive action: passed. Delete is visually and spatially separated from reversible actions.
- Regression coverage: passed. All seven focused sidebar workspace-drawer tests pass, including the compact overflow-menu contract.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

## Comparison history

### Iteration 1

- Finding: P2. Three equal-weight icon buttons fragmented the title row, compressed long workspace names, and placed the destructive action directly beside routine actions.
- Fix: replaced the cluster with one overflow trigger, grouped routine actions in task order, and moved deletion into a separated destructive section.
- Post-fix evidence: the focused comparison shows a calmer default row, clearer action hierarchy, and more usable title width. The live open-menu capture verifies spacing, alignment, hover surface, divider, and destructive styling.

### Final visual verdict

- Verdict: pass.
- Category match: true.
- No actionable P0, P1, or P2 differences remain.

final result: passed

---

# Design QA — Feishu workspace icon

## Comparison target

- Source visual truth: `C:/Users/LUSHEN~1/AppData/Local/Temp/codex-clipboard-5a56687c-3090-48ed-8188-716527d77ac8.png` (384 x 539 physical pixels).
- Implementation screenshot: `C:/Users/LUSHEN~1/AppData/Local/Temp/tech-cc-hub-sidebar-feishu-icon-printwindow.png` (1480 x 900 physical pixels).
- Combined comparison input: `C:/Users/LUSHEN~1/AppData/Local/Temp/tech-cc-hub-sidebar-feishu-icon-comparison.png` (834 x 770 physical pixels).

## Viewport and state

- Desktop Electron window: 1480 x 900 physical pixels at Windows 150% display scaling, approximately 987 x 600 CSS pixels.
- State: light theme; one Feishu workspace expanded; ordinary and Feishu workspace rows visible together.
- Density normalization: the supplied source is a cropped physical-pixel capture with unknown CSS viewport. The focused comparison keeps both captures at native physical density because only the 16px workspace icon slot is being evaluated.

## Comparison evidence

- Full-view evidence: the live Electron capture shows the sidebar, main workspace, selected Feishu workspace, and unchanged workspace/session interactions without clipping or overlap.
- Focused evidence: required because the requested change is a small icon. The combined image places the supplied sidebar crop and the live sidebar crop together; Feishu rows now use the blue Lark/Feishu brand mark while `boke-kefu-vue` retains the existing folder icon.

## Required fidelity surfaces

- Fonts and typography: passed. Workspace labels retain the existing 13px semibold typography, truncation, and line height.
- Spacing and layout rhythm: passed. The replacement occupies the same 16 x 16 slot, so row height, 8px icon-to-label gap, disclosure chevron, and hover actions do not move.
- Colors and visual tokens: passed. The icon uses Feishu blue `#3370ff`; all existing neutral sidebar tokens remain unchanged.
- Image quality and asset fidelity: passed. The brand mark is the vector `Lark` icon from the project's existing Icon Park dependency, not a raster placeholder or handcrafted SVG.
- Copy and content: passed. Workspace and session labels are unchanged.
- Interaction and accessibility: passed. Expand/collapse, hover actions, selection, and local-workspace folder treatment remain unchanged; the decorative icon is hidden from assistive technology.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: the source and implementation show different session contents because they were captured at different moments; this does not affect the icon-slot comparison.

## Comparison history

### Iteration 1

- Earlier finding: Feishu-generated workspace rows used the same generic folder icon as local projects, so their channel origin was not recognizable at a glance.
- Fix: detect workspace roots already resolved by the Feishu channel metadata path and render Icon Park's filled `Lark` mark in the existing 16px slot; preserve the folder icon for other workspaces.
- Post-fix evidence: the combined focused capture shows blue Feishu marks on `飞书-陆晟韬`, `飞书-海外客服-…`, and `飞书-王星星, lst`, while `boke-kefu-vue` remains a folder. No alignment or spacing regression is visible.

final result: passed

---

# Design QA: Woo 账号菜单

## Comparison target

- Source visual truth: `C:/Users/LUSHEN~1/AppData/Local/Temp/codex-clipboard-1d5eb235-d3c5-4432-9dc5-43150ebbb548.png`.
- Implementation screenshot: `D:/tool/tech-cc-hub/.omx/artifacts/woo-account-menu.png`.
- Combined comparison: `C:/Users/lushengtao/.codex/visualizations/2026/07/19/019f785d-885a-7c70-bcc5-7ca390f84542/woo-account-menu-comparison.png`.
- Full renderer evidence: `D:/tool/tech-cc-hub/.omx/artifacts/woo-auth-avatar.png`.

## Viewport and state

- Desktop renderer viewport: 2048 x 1250 CSS pixels.
- Narrow containment viewport: 900 x 560 CSS pixels.
- State: Woo authenticated, account menu open, first action selected, real-avatar-shaped CDN fixture loaded.
- Browser path: Browser plugin unavailable; repository Playwright fallback used against the Vite renderer.

## Comparison evidence

- Full-view comparison: passed. The account entry remains the final sidebar item and the menu opens directly above it without covering the persistent controls.
- Focused comparison: required because typography, icons, row rhythm, radius, label alignment, and the selected state are too small to judge in the full application capture. The combined image places the source and focused implementation capture together at native pixel size.
- The focused capture is narrower because it uses the product's existing 280px CSS sidebar while the reference is a physical-pixel Windows crop; menu height and row rhythm remain directly comparable.

## Required fidelity surfaces

- Fonts and typography: passed. Existing CJK system fonts, 15px medium-weight labels, and single-line truncation reproduce the reference without clipping.
- Spacing and layout rhythm: passed. The 18px radius, 48px identity row, 1px divider, three 42px actions, 13px selected-row radius, and compact outer padding preserve the reference rhythm after removing unsupported actions.
- Colors and visual tokens: passed. Neutral white panel, gray border/shadow, selected `#ededed` row, dark text, and muted secondary icons match the source while retaining the host sidebar background.
- Image quality and asset fidelity: passed. Production uses the real Woo avatar with the existing circular crop and initial fallback; the QA capture uses a deterministic avatar fixture only to prove layout and loading.
- Icons: passed. Closest matching existing Icon Park assets are used for usage, settings, logout, chevron, and help; no handcrafted SVG or placeholder asset was introduced.
- Copy and content: passed. Identity, `剩余用量`, `设置`, and `退出登录` remain; the unsupported `Ctrl+,` hint, `隐藏宠物`, and `邀请好友` are intentionally omitted because those product capabilities are unavailable or unwanted.
- Accessibility and states: passed. The panel retains dialog semantics, the actions use a labeled menu/menuitem structure, Escape and outside click close it, focus styles remain visible, and the selected action is distinguishable without color alone.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: the reference and implementation crops have different physical widths because the application preserves its existing sidebar width; changing the entire workspace sidebar was outside this component-scoped request.

## Comparison history

### Iteration 1

- Finding: P1. The old authenticated popover only showed avatar, email, and one logout button, so its information architecture did not match the five-action reference menu.
- Fix: replaced the authenticated card with the measured identity header, divider, selected usage row, four supporting actions, shortcut hint, and matching Icon Park assets.
- Post-fix evidence: all five actions render in the focused Playwright capture and the selected row, radius, vertical rhythm, and panel height align with the source.

### Iteration 2

- Finding: P2. The first comparison retained an explicit open-state background and separator around the bottom account trigger, making it heavier than the reference.
- Fix: removed the explicit open-state fill and separator, increased the floating gap, moved the capture pointer away, and recaptured the same state.
- Post-fix evidence: the revised combined image shows the menu floating cleanly above the account trigger with the reference's spacing and hierarchy.

### Iteration 3

- Finding: P1. The menu still included `邀请好友`, which the latest requirement explicitly removed.
- Fix: removed the invite row and its unused icon import while preserving `隐藏宠物`.
- Post-fix evidence: Playwright asserts `隐藏宠物` is visible and the `邀请好友` menuitem count is zero at both tested viewport sizes.

### Iteration 4

- Finding: P1. `隐藏宠物` remained visible even though the product has no pet feature.
- Fix: removed the pet row and its now-unused icon import.
- Post-fix evidence: Playwright asserts both `隐藏宠物` and `邀请好友` have a menuitem count of zero while the three supported actions remain visible.

## Interaction checks

- Signed-out login: passed; one click on the bottom account entry invokes `woo-auth:login-third-party` directly, with no username/password modal rendered even when the server advertises password and email methods.
- Authenticated menu open/close: passed via trigger, Escape, and outside pointer action.
- Remaining usage: passed; clicking it invoked `shell:openExternal` with exactly `https://dream.pocketcity.com/user` and closed the menu.
- Settings handoff: wired to the existing application settings opener; the standalone sidebar settings button is visible only while signed out and the authenticated menu remains the sole settings entry after login.
- Logout: passed; the account returned to the anonymous login state.
- Responsive containment: passed at 2048 x 1250 and 900 x 560 with no document overflow.
- Avatar load and failure fallback: passed.
- Page identity, blank-page check, framework overlay, and browser console: passed with zero relevant errors.

final result: passed

---

# Design QA — 普通智能体记录

## Comparison target

- Source visual truth: `C:/Users/LUSHEN~1/AppData/Local/Temp/codex-clipboard-bf535c48-568a-4200-a629-4cb188271c47.png`.
- Reported pre-fix state: `C:/Users/LUSHEN~1/AppData/Local/Temp/codex-clipboard-d0975c71-569a-4c65-94a1-93859794a8b9.png`.
- Running implementation: `C:/Users/lushengtao/AppData/Local/Temp/techcc-workflow-agent-qa-20260717/normal-agent-running-panel.png`.
- Completed implementation: `C:/Users/lushengtao/AppData/Local/Temp/techcc-workflow-agent-qa-20260717/normal-agent-completed-panel.png`.
- Combined comparison: `C:/Users/lushengtao/AppData/Local/Temp/techcc-workflow-agent-qa-20260717/normal-agent-comparison.png`.

## Viewport and state

- Viewport: 1440 × 900 CSS pixels, desktop light theme.
- States: running agent with seven repeated progress events; completed agent with two assistant replies.
- Runtime surface: isolated Vite renderer using the production workflow-agent components.

## Full-view and focused evidence

- Running state renders one borderless latest-progress summary and reports the update count; earlier repeated telemetry is absent from the visible transcript.
- Completed state hides progress telemetry when real assistant content exists and renders replies as continuous, unboxed Markdown with the existing action row beneath each reply.
- The focused panel capture was sufficient because the requested change is isolated to the transcript panel and contains no responsive multi-column content or raster assets.

## Required fidelity surfaces

- Fonts and typography: passed. Existing 16px Markdown body typography and relaxed line height produce the same long-form reading hierarchy as the reference.
- Spacing and layout rhythm: passed. Content remains centered at the existing 920px maximum, blue event-card stacking is removed, and replies use reference-like whitespace.
- Colors and visual tokens: passed. The panel is neutral white/slate; purple is limited to running/status chrome.
- Image quality and asset fidelity: not applicable. The scoped panel contains only product icons from the existing library and no reference raster assets.
- Copy and content: passed. Latest progress, message count, tool count, status, and actual replies remain available without exposing internal telemetry as正文内容.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: the host side-panel header remains different from Codex's standalone task-page navigation; this is intentional because the panel must retain workflow run actions and status.

## Comparison history

### Iteration 1

- Earlier finding: P1. Every `task_progress` event rendered as a large blue card, so repeated summaries displaced actual agent content and made a normal agent look like a raw event log.
- Fix: derive a transcript view that removes task telemetry from message content, keep only the latest progress in a compact borderless status row while running, and add an agent-only plain assistant presentation without changing main chat styling.
- Post-fix evidence: DOM checks confirm exactly one running progress summary, no `Agent progress` cards, no stale `repo-scope` event, completed replies present, and no progress summary once completed content exists. Browser console and page errors were zero in the isolated renderer.

### Final visual verdict

- Score: 93/100.
- Verdict: pass.
- Category match: true.
- No actionable P0, P1, or P2 differences remain.

## Interaction checks

- Running progress compaction: passed.
- Completed-content prioritization: passed.
- Main-chat default presentation isolation: covered by regression test.
- Console/page errors: passed with zero errors.
- In-app Browser fallback: the bundled client failed twice with `Cannot redefine property: process`; isolated Playwright was used under the user's standing no-question/self-directed instruction.

final result: passed

---

# Design QA — Codex-style workflow agent updates

## Comparison target

- Source visual truth: `C:/Users/LUSHEN~1/AppData/Local/Temp/codex-clipboard-9d26f759-fbad-4c11-b4b1-f22faa1df002.png` (1419 × 1107).
- Completed-state implementation: `D:/tool/tech-cc-hub/.tmp/workflow-agent-ui-implementation.png`.
- Running-state implementation: `D:/tool/tech-cc-hub/.tmp/workflow-agent-ui-running.png`.
- Full-view combined comparison: `D:/tool/tech-cc-hub/.tmp/workflow-agent-ui-comparison-full.png`.
- Focused combined comparison: `D:/tool/tech-cc-hub/.tmp/workflow-agent-ui-comparison-focused.png`.

## Viewport and state

- Viewport: 1440 × 1000 CSS pixels, desktop light theme.
- Completed state: first agent update selected, completed transcript visible in the right rail.
- Running state: second agent update selected after click, running transcript empty state visible in the right rail.
- Runtime surface: isolated Vite renderer using the production components and project Tailwind configuration.

## Full-view comparison evidence

- The main conversation now treats agent activity as an inline update instead of a raised card: no border, no shadow, compact status line, calm body preview, and one lightweight disclosure affordance.
- The existing right activity rail remains the destination for the full child transcript, preserving the product's established multi-pane navigation while keeping the parent conversation readable.
- Completed and running updates share one layout; only semantic color and motion change.

## Focused-region comparison evidence

- The combined focused comparison confirms the same visual hierarchy as Codex: a small purple agent mark, `智能体` label, low-emphasis completion text, followed by the agent's task/result preview.
- The implementation intentionally keeps a title plus two-line summary because the existing event model stores the child transcript in the right rail rather than duplicating every child message inside the parent thread.
- The first visual pass exposed excess message/tool counts and a stronger selected fill. Counts were removed from the inline row and retained only in the transcript header; the selected fill was softened to `#faf8ff`.

## Required fidelity surfaces

- Fonts and typography: passed. Existing CJK system fonts, 13px status text, 14px task title, and 13px two-line summary maintain the reference hierarchy without clipping.
- Spacing and layout rhythm: passed. The update uses 8px horizontal padding, a 28px icon slot, 12px icon/content gap, 14px radius, no border, and no elevation. Both desktop columns remain within the viewport.
- Colors and visual tokens: passed. Neutral text and surfaces remain product-native; the new violet is scoped to agent identity/status and is close to the reference without changing the global orange accent.
- Image quality and asset fidelity: passed. The reference has no raster content asset; the closest matching existing Lucide `Sparkles` icon is used instead of a handcrafted SVG or CSS drawing.
- Copy and content: passed. `智能体 / 工作流 / 后台任务` and `运行中 / 已更新 / 失败 / 已停止` expose status in text rather than color alone.
- Accessibility: passed. The update is a semantic button with an explicit accessible label, `aria-current` selected state, keyboard focus ring, and reduced-motion-safe decorative animation.

## Findings

- P0: none.
- P1: none.
- P2: none after the density correction.
- P3: the Lucide sparkle silhouette is not the reference's exact four-diamond mark; this is accepted because it is the closest icon already present in the product dependency set.

## Comparison history

### Iteration 1

- Finding: P2. The first rendered selected state exposed message/tool counts in the parent thread and used a noticeable full-width violet fill, making the update denser and louder than the reference.
- Fix: removed counts from the inline event, retained them in the right transcript header, softened the selected fill, and reduced the idle hover fill.
- Post-fix evidence: `workflow-agent-ui-comparison-focused.png` shows one quiet status row with title/result preview; `workflow-agent-ui-implementation.png` shows the parent conversation remaining visually dominant.

## Interaction and console checks

- Clicking the running update changes its `aria-current` value to `true` and updates the right rail title to `检查剩余的回归风险`.
- The right rail exposes the `运行中` state and the child-transcript waiting message.
- Browser console and page errors: zero during completed capture, selection, and running-state capture.

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

---

# Design QA — center chat workspace

- Source visual truth: overall workspace `C:\Users\lushengtao\AppData\Local\Temp\ChatGPT Image 2026年7月15日 16_55_30 (1).png`; changed-files density/placement reference `C:\Users\LUSHEN~1\AppData\Local\Temp\codex-clipboard-77da80d0-5fb9-444a-a47f-acb112673b71.png`; assistant default-expansion reference `C:\Users\LUSHEN~1\AppData\Local\Temp\codex-clipboard-76a5b5f0-b49c-4e9b-89b1-96a189364288.png`.
- Implementation screenshot: `D:\tool\tech-cc-hub\.omx\artifacts\side-conversation.png`
- Source viewport: 1600 × 978
- Implementation viewport: 1440 × 900
- State: desktop light theme; the implementation capture has the side-conversation rail open and shows user/assistant cards plus the prompt composer.

## Full-view comparison evidence

The center chat pane now matches the reference's core composition: a flat white content column, small role labels with status dots, thin neutral borders, low-elevation cards, compact spacing, and a wide fixed-bottom composer. The previous large rounded gradient container is no longer present. The implementation intentionally retains the product's existing orange `accent` token instead of adopting the reference's blue accent.

The structured visual verdict for the visible center-chat state scored 91/100 (`pass`, category match true). The generated viewport is narrower because the QA state opens an additional side-conversation rail; the center pane responds without clipping or overlap.

## Focused region comparison evidence

- Message cards: role label, 8px status dot, 14px card radius, neutral border, white assistant surface, and token-tinted user surface are visible and align with the reference hierarchy.
- Composer: 820px maximum width, 16px radius, 15px input type, restrained shadow, footer controls, and black send button align with the reference proportions.
- Tool/process state: source code implements the matching compact bordered process row and 14px result/file cards, but the available browser-preview fixture does not render this dense state, so it could not be visually compared.
- Images/assets: neither the scoped center chat reference nor the implementation requires custom raster imagery. Visible controls use the project's existing Lucide icon dependency.

## Findings

- [P2] Dense tool-call/result state is not present in the captured fixture.
  - Location: center transcript process/result cards.
  - Evidence: the reference includes a collapsed tool-call row and a large request-result/code card; the implementation screenshot only contains user/assistant text cards.
  - Impact: layout and styling for the most information-dense center-chat state cannot be visually certified from the current evidence.
  - Fix: re-capture a session containing tool use, tool output, and a changed-files card at the reference viewport once the in-app browser runtime is available.

## Interaction and console checks

- The existing side-conversation QA flow selected a secondary conversation, sent a message, and rendered the response before capturing the screenshot.
- The run then reported repeated `/rpc/listSlashCommands` HTTP 500 errors because the preview proxy target on port 4317 was unavailable. This is a QA-environment/backend issue and did not prevent the screenshot or core interaction from rendering.
- The in-app browser runtime could not initialize because the bundled browser client throws `Cannot redefine property: process`; therefore the required same-viewport in-app capture could not be produced.

## Comparison history

1. First implementation pass removed the oversized gradient transcript shell, reduced message/card radii and elevation, introduced compact process rows, narrowed the composer, and reused the existing accent token.
2. Post-change evidence at 1440 × 900 confirmed the visible text-message and composer state with no clipping or overlap. The remaining P2 is a capture-coverage gap for dense tool content, not a mismatch observed in the available screenshot.

## Implementation checklist

- [x] Preserve the existing primary/accent color tokens.
- [x] Remove the large transcript-level decorative container.
- [x] Match reference card radii, borders, spacing, and low elevation.
- [x] Match composer width, input scale, and footer hierarchy.
- [x] Keep existing interactions and data flow unchanged.
- [ ] Capture and compare the dense tool-call/result state at 1600 × 978.

## Follow-up polish

- Re-run the same-state capture after the bundled in-app browser runtime or the QA preview backend is repaired.

## 2026-07-17 process-history fold update

- Reference: `C:\Users\LUSHEN~1\AppData\Local\Temp\codex-clipboard-3b881ce3-3a11-4777-81ea-fd7183d49532.png` shows dozens of individually collapsed process-summary rows occupying the center transcript.
- Implemented one neutral `过程记录` disclosure for the transcript. It defaults closed and reports both group and event counts; expanding it restores the existing per-group `过程明细` controls.
- Generated-image results and changed-file cards remain visible while low-level process summaries are folded, so the compact default does not hide meaningful outputs.
- The implementation keeps the existing accent token and introduces no palette changes.
- Production build, targeted regression tests, and targeted ESLint completed successfully. ESLint reports only the four pre-existing warnings in `App.tsx` and `ChatTranscript.tsx`.
- Post-change visual comparison remains blocked because the bundled in-app browser client still fails during connection with `Cannot redefine property: process`. No replacement browser was used because the selected product-design workflow requires the user's browser choice.

## 2026-07-17 changed-files bottom aggregation update

- Earlier finding: each process group rendered its own changed-files card inline, creating repeated large blocks between ordinary messages.
- Fix made: all process messages in the visible transcript are aggregated by file path and rendered through one `ProcessChangedFilesCard` after message, streaming, and partial-response content. Inline process groups no longer own or render changed-file summaries.
- Density fix: removed the explanatory subtitle; reduced the header and row padding from `px-4 py-3` to `px-3 py-2`; reduced icon boxes from 32px to 28px; reduced filename and diff text to 12–13px; reduced the extra-files control to `py-1.5`.
- Preserved behavior: file rows still open the right-side preview at the first change, repeated writes still merge, generated images remain inline, and the existing accent/color tokens are unchanged.
- Verification evidence: targeted regression tests pass 3/3, targeted ESLint reports zero errors, production build passes, and `git diff --check` passes.
- Visual evidence blocker: the local page is running, but the bundled Browser client still fails to initialize with `Cannot redefine property: process`. A same-state implementation screenshot and structured visual verdict therefore cannot be produced; the latest density and placement change is not visually certified.

## 2026-07-17 assistant default-expansion update

- Reference finding: the main assistant review card initially truncates after 24 lines and shows `展开剩余 17 行`, while the requested state is fully expanded on first render.
- Fix made: `CollapsibleText` now accepts `defaultExpanded`, and only `AssistantTextCard` enables it. The full assistant Markdown is rendered immediately and the existing control becomes `收起`.
- Scope preserved: user prompts, thought blocks, tool output, patch/diff, and raw JSON keep their existing default-collapsed behavior.
- Verification evidence: the focused regression test passes, the related transcript regression set passes 4/4, targeted ESLint reports zero errors, production build passes, and `git diff --check` passes.
- Visual evidence blocker: the bundled Browser client again fails before page capture with `Cannot redefine property: process`; the post-change expanded state could not be captured or compared in the same viewport.

## 2026-07-17 compact changed-files disclosure update

- Removed copy: `点击文件在右侧预览，并跳到首个修改处` is absent from the changed-files component.
- Default state: the bottom changed-files card now starts as a single collapsed summary row with file count, aggregate additions/deletions, and a disclosure chevron.
- Expanded state: clicking the summary reveals the file rows; clicking an individual row still opens the right-side preview. The file list and its `再显示` control are never mounted in the collapsed state.
- Density fix: summary padding is `px-3 py-1.5`; file rows use `px-3 py-1.5`; icon boxes are 24px; list labels and diff counts are 12px; the overflow control is reduced to 10px text and `py-1`.
- Verification evidence: assistant and process-card regression tests pass 5/5, targeted ESLint reports zero errors, production build passes, and `git diff --check` passes.
- Visual evidence blocker: the Browser client remains unavailable with `Cannot redefine property: process`, so the latest compact collapsed state has no browser-rendered comparison screenshot.

## 2026-07-17 default-four changed-files update

- Source visual truth: `C:\Users\LUSHEN~1\AppData\Local\Temp\codex-clipboard-00f64b89-ac36-4f5f-ab6d-9b32c4b3bce1.png` (1048 x 348), showing an expanded changed-files card with four visible rows and a `再显示 4 个文件` overflow control.
- Implementation screenshot: unavailable. The bundled in-app Browser client fails during initialization with `Cannot redefine property: process`.
- Intended implementation viewport/state: desktop light theme, bottom changed-files card expanded, 8 total files, first 4 rows visible, overflow control visible.
- Full-view comparison evidence: blocked because no post-change browser-rendered implementation screenshot could be captured.
- Focused region comparison evidence: blocked for the same reason; code inspection and tests are not being treated as visual evidence.
- Earlier finding/fix: the previous iteration defaulted the whole file list to collapsed. This user override now defaults the card to expanded, keeps the four-row cap, enlarges the header to 14px with a 28px icon box, and adds 2px horizontal/vertical padding to the header and file rows.
- Required fidelity surfaces: typography and spacing were encoded to match the supplied target; existing color tokens, Lucide file icon, and Chinese copy remain unchanged. Image-quality review is not applicable because this card contains no raster imagery. Visual confirmation remains blocked.
- Verification evidence: focused regression tests pass 5/5, targeted ESLint passes with zero errors, production build passes, and `git diff --check` passes.
- [P2] Same-state visual comparison is unavailable.
  - Impact: exact rendered density, text alignment, and row height cannot be certified against the source screenshot.
  - Fix: restore the bundled in-app Browser runtime, capture the expanded eight-file state at the source viewport, and run the combined reference/implementation comparison.

## 2026-07-17 assistant actions and result-card removal

- Source visual truth: `C:\Users\LUSHEN~1\AppData\Local\Temp\codex-clipboard-7a96eebb-0cca-4809-8e7d-f9952ee1fc45.png` (1010 x 158), identifying the `本轮结果` metrics region to remove.
- Implementation screenshot: unavailable. The bundled in-app Browser client fails during initialization with `Cannot redefine property: process`.
- Intended viewport/state: desktop light theme, completed assistant response, no success-result metrics card, compact action row directly below the assistant card.
- Full-view comparison evidence: blocked because the post-change implementation could not be captured.
- Focused region comparison evidence: blocked for the same reason; source inspection and passing tests are not counted as visual evidence.
- Fixes made: removed the entire successful result metrics card; added only the supported Copy and Fork controls below assistant messages. Fork creates a new task in the same workspace and carries the selected assistant response as a message reference. Unsupported Like/Dislike controls were removed after the product-capability clarification.
- Required fidelity surfaces: the existing font, color tokens, 28px action targets, and Lucide icon language are preserved; no raster imagery is involved. Exact spacing and icon alignment remain visually uncertified.
- Interaction evidence: regression tests cover the two supported controls, the absence of Like/Dislike, removal of the result metrics component, and Fork event wiring. Browser interaction testing is blocked by the runtime failure.
- Console errors checked: unavailable because the Browser connection fails before a tab can be inspected.
- Verification evidence: related regression tests pass 6/6, production build passes, targeted ESLint reports zero errors (three pre-existing warnings), and `git diff --check` passes.
- [P2] Same-state rendered evidence is unavailable.
  - Impact: exact action-row density and control alignment cannot be certified against the running UI.
  - Fix: restore the in-app Browser runtime, capture a completed assistant message, test Copy and Fork, and rerun the combined visual comparison.

final result: blocked

---

# Design QA — 飞书消息发送选择器

## Comparison target

- Source visual truth: `C:/Users/LUSHEN~1/AppData/Local/Temp/codex-clipboard-848ac6a4-1bcc-4090-9a61-d4dee9f26568.png` (984 × 646). The user explicitly allowed the right-side selected-items panel to be omitted.
- Implementation screenshot: `C:/Users/lushengtao/.codex/visualizations/2026/07/17/019f6f2d-07fd-7a63-8265-f6be8e3233ff/lark-share-dialog-v3.png`.
- Focused implementation screenshot: `C:/Users/lushengtao/.codex/visualizations/2026/07/17/019f6f2d-07fd-7a63-8265-f6be8e3233ff/lark-share-dialog-v3-focus.png`.
- Combined comparison input: `C:/Users/lushengtao/.codex/visualizations/2026/07/17/019f6f2d-07fd-7a63-8265-f6be8e3233ff/lark-share-comparison-v3.png`.

## Viewport and state

- Implementation viewport: 1200 × 800 CSS pixels, desktop light theme.
- State: send dialog open, query `宁`, seven people/group results visible, zero selected, confirm disabled.
- Runtime surface: Vite renderer with the repository Electron preview shim.

## Full-view comparison evidence

- The result selector is now one neutral white column with the same search-first hierarchy, checkbox rows, compact identity metadata, and bottom cancel/confirm actions as the reference.
- The reference's right-side selected-items panel is intentionally absent per the user's instruction; the selected count is preserved in the footer.
- The implementation remains a product modal with title, close action, and background occlusion so it fits the existing chat interaction.

## Focused-region comparison evidence

- The focused 600 × 642 capture confirms the blue focus ring, 18px checkboxes, 36px avatar/icon slots, 15px names, 12px metadata, eight-pixel row radii, and 40px footer actions without clipping.
- Group and person rows share the reference's visual rhythm. Long group names remain on one line at the scoped width.

## Required fidelity surfaces

- Fonts and typography: passed. System CJK fonts, compact name/detail hierarchy, and button labels match the reference's desktop selector density.
- Spacing and layout rhythm: passed. Search, result list, rows, and footer align to a single 600px column; no preview pane or oversized message block remains.
- Colors and visual tokens: passed. Neutral white/slate surfaces and the requested blue search/confirm treatment replace the previous orange-heavy modal.
- Image quality and asset fidelity: passed with one acceptable P3 deviation. Group avatars render when returned by Feishu; the people search API does not expose avatar URLs, so people use the existing Lucide person icon rather than fabricated imagery.
- Copy and content: passed. The dialog exposes search, selected count, bot-send identity, cancel, and confirm without the removed message preview.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: person rows use a consistent fallback icon instead of the real portraits shown in the reference because the current Feishu people-search response has no avatar field.

## Comparison history

### Iteration 1

- Finding: P1. The original dialog forced users through a labeled form, an empty bordered loading strip, a persistent search spinner, a large message preview, and a visually heavy identity footer.
- Fix: split people and group searches so partial results render independently, added a six-second timeout, removed the search spinner and message preview, and rebuilt the content as a single compact checkbox list with a blue confirm action.
- Post-fix evidence: query results appear in the preview in 236ms, seven rows render without a loading indicator, selection changes the count from 0 to 1, confirm enables, the preview send closes the dialog and shows success, and the browser console reports no errors.

### Final visual verdict

- Score: 93/100.
- Verdict: pass.
- Category match: true.
- No actionable P0, P1, or P2 differences remain.

## Interaction checks

- Independent people/group search: passed; partial-result UI is wired and both requests have a six-second timeout.
- Query `宁`: passed; results appeared in 236ms in the preview fixture without a search spinner.
- Checkbox-style single selection: passed; selected count changed to 1 and confirm became enabled.
- Confirm: passed against the preview shim; dialog closed and the success toast appeared.
- Browser console: passed with zero errors during the scoped flow.

final result: passed
