import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("knowledge overview tells agents to search/read before source exploration", () => {
  const source = readFileSync(join(process.cwd(), "src/electron/libs/knowledge/knowledge-overview.ts"), "utf8");

  assert.match(source, /<usage>/);
  assert.match(source, /knowledge_search first/);
  assert.match(source, /knowledge_read for the selected document/);
  assert.match(source, /Do not call mcp__tech-cc-hub-knowledge__knowledge_index just to answer a question/);
});

test("runner denies accidental knowledge_index calls for retrieval-only prompts", () => {
  const source = readFileSync(join(process.cwd(), "src/electron/libs/runner.ts"), "utf8");

  assert.match(source, /KNOWLEDGE_INDEX_INTENT_PATTERN/);
  assert.match(source, /function isKnowledgeIndexTool/);
  assert.match(source, /function getKnowledgeIndexDenyMessage/);
  assert.match(source, /Knowledge index refresh is reserved for explicit generate\/update\/reindex requests/);
  assert.match(source, /mcp__tech-cc-hub-knowledge__knowledge_search first/);
});

test("knowledge_index tool description is maintenance-only", () => {
  const source = readFileSync(join(process.cwd(), "src/electron/libs/mcp-tools/knowledge.ts"), "utf8");

  assert.match(source, /Maintenance-only: generate or refresh/);
  assert.match(source, /Do not use this to answer repo questions or test retrieval/);
});
