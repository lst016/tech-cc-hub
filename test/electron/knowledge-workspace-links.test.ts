import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("knowledge UI store persists workspace links", () => {
  const source = readSource("src/electron/libs/knowledge/knowledge-ui-store.ts");

  assert.match(source, /CREATE TABLE IF NOT EXISTS knowledge_ui_workspace_links/);
  assert.match(source, /setWorkspaceLinks/);
  assert.match(source, /knowledge:set-workspace-links/);
  assert.match(source, /DELETE FROM knowledge_ui_workspace_links WHERE workspace_key = \? OR linked_workspace_key = \?/);
});

test("knowledge overview and MCP tools include linked workspaces", () => {
  const overviewSource = readSource("src/electron/libs/knowledge/knowledge-overview.ts");
  const toolSource = readSource("src/electron/libs/mcp-tools/knowledge.ts");

  assert.match(overviewSource, /listLinkedKnowledgeWorkspaces/);
  assert.match(overviewSource, /<linked_workspaces>/);
  assert.match(toolSource, /listKnowledgeWorkspaceRootsWithLinks/);
  assert.match(toolSource, /linkedWorkspaceRoots/);
  assert.match(toolSource, /linkedWorkspace/);
});

test("knowledge panel exposes compact workspace linking controls", () => {
  const source = readSource("src/ui/components/KnowledgePanel.tsx");

  assert.match(source, /关联知识库/);
  assert.match(source, /knowledge:set-workspace-links/);
  assert.match(source, /space-y-0\.5/);
  assert.match(source, /aria-label=\{`关联 \$\{workspace\.name\} 知识库`\}/);
});
