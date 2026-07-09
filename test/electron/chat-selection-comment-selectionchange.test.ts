import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("chat selection comments capture on release instead of rerendering on every selectionchange tick", () => {
  const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");

  assert.match(source, /const \[selectionTrackingActive, setSelectionTrackingActive\] = useState\(false\);/);
  assert.match(source, /const clearSelectionDraft = useCallback\(\(options\?: \{ clearDomSelection\?: boolean \}\) => \{/);
  assert.match(source, /const shouldClearDomSelection = options\?\.clearDomSelection \?\? true;/);
  assert.match(source, /setSelectionTrackingActive\(false\);/);
  assert.match(source, /const popoverHasFocus = Boolean\(activeElement && selectionPopoverRef\.current\?\.contains\(activeElement\)\)/);
  assert.match(source, /if \(!anchorInside && !focusInside\) \{\s+if \(popoverHasFocus\) return;\s+if \(selectionDraft\) clearSelectionDraft\(\{ clearDomSelection: false \}\);/);
  assert.match(source, /if \(!selection \|\| selectedText\.length === 0 \|\| selection\.rangeCount === 0 \|\| selection\.isCollapsed\) \{\s+if \(popoverHasFocus\) return;\s+if \(selectionDraft\) clearSelectionDraft\(\{ clearDomSelection: false \}\);/);
  assert.match(source, /if \(shouldClearDomSelection\) \{\s+window\.getSelection\(\)\?\.removeAllRanges\(\);/);
  assert.match(source, /const getSelectionAnchorRect = \(range: Range, anchorNode: Node \| null, focusNode: Node \| null\): DOMRect \| null =>/);
  assert.match(source, /const CHAT_SELECTION_BLOCK_SELECTOR = "li, p, pre, blockquote, h1, h2, h3, h4, h5, h6, td, th"/);
  assert.match(source, /const getSelectionBlockElement = \(node: Node \| null, container: HTMLElement\): HTMLElement \| null =>/);
  assert.match(source, /const rects = Array\.from\(range\.getClientRects\(\)\);/);
  assert.match(source, /const candidateNodes = \[focusNode, anchorNode\];/);
  assert.match(source, /const anchorBlock = getSelectionBlockElement\(anchorNode, container\);/);
  assert.match(source, /const focusBlock = getSelectionBlockElement\(focusNode, container\);/);
  assert.match(source, /if \(anchorBlock && focusBlock && anchorBlock !== focusBlock\) \{/);
  assert.match(source, /if \(!selectionTrackingActive\) return;/);
  assert.match(source, /selectionStartBlockRef\.current = getSelectionBlockElement\(event\.target as Node \| null, container\);/);
  assert.match(source, /setSelectionTrackingActive\(true\);/);
  assert.match(source, /window\.addEventListener\("mouseup", scheduleDeferredSelectionCapture, true\)/);
  assert.match(source, /window\.addEventListener\("pointerup", scheduleDeferredSelectionCapture, true\)/);
  assert.doesNotMatch(source, /document\.addEventListener\("selectionchange", scheduleSelectionCapture\)/);
  assert.match(source, /createPortal\([\s\S]*document\.body/);
});
