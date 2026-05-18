import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("markdown renderer keeps Mermaid diagrams stable across dev rerenders", () => {
  const source = readFileSync(join(process.cwd(), "src/ui/render/markdown.tsx"), "utf8");

  assert.match(source, /const mermaidRenderCache = new Map/);
  assert.match(source, /function renderMermaidChart/);
  assert.match(source, /function getCachedMermaidRenderResult/);
  assert.match(source, /const MermaidDiagram = memo\(function MermaidDiagram/);
  assert.match(source, /const onOpenSourceFileRef = useRef\(onOpenSourceFile\)/);
  assert.match(source, /const openSourceFile = useCallback/);
  assert.match(source, /const markdownComponents = useMemo<Components>/);
  assert.match(source, /components=\{markdownComponents\}/);
  assert.match(source, /\}\), \[openSourceFile, sourceRoot\]\)/);
  assert.doesNotMatch(source, /\}\), \[onOpenSourceFile, sourceRoot\]\)/);
  assert.doesNotMatch(source, /components=\{\{\s*h1:/);
});
