import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("knowledge overview tells agents to use CodeGraph before source exploration", () => {
  const source = readFileSync(join(process.cwd(), "src/electron/libs/knowledge/knowledge-overview.ts"), "utf8");

  assert.match(source, /<usage>/);
  assert.match(source, /For each new user turn that needs source-code evidence/);
  assert.match(source, /codegraph_search or mcp__tech-cc-hub-knowledge__codegraph_context/);
  assert.match(source, /before broad Read\/Grep\/Glob\/Task exploration/);
  assert.match(source, /Only fall back to Read\/Grep\/Glob\/Task after CodeGraph finds no useful result/);
  assert.match(source, /Do not re-read source code that codegraph_context already returned/);
  assert.match(source, /auto-initialize \.tech\/codegraph when missing and run incremental sync before retrieval/);
  assert.match(source, /do not require an LLM or embedding model/);
  assert.match(source, /RepoWiki and legacy vector knowledge indexing are disabled/);
  assert.match(source, /memory_update for durable notes/);
  assert.doesNotMatch(source, /use repowiki/i);
});

test("runner denies accidental knowledge_index calls for retrieval-only prompts", () => {
  const source = readFileSync(join(process.cwd(), "src/electron/libs/runner.ts"), "utf8");

  assert.match(source, /KNOWLEDGE_INDEX_INTENT_PATTERN/);
  assert.match(source, /function isKnowledgeIndexTool/);
  assert.match(source, /function getKnowledgeIndexDenyMessage/);
  assert.match(source, /Legacy knowledge_index is disabled because RepoWiki\/vector indexing has been removed/);
  assert.match(source, /mcp__tech-cc-hub-knowledge__codegraph_search or codegraph_context first/);
  assert.match(source, /auto-initialize and sync the managed graph/);
});

test("runner requires CodeGraph retrieval before broad source exploration", () => {
  const source = readFileSync(join(process.cwd(), "src/electron/libs/runner.ts"), "utf8");

  assert.match(source, /CODEGRAPH_RETRIEVAL_TOOL_NAMES/);
  assert.match(source, /BROAD_CODE_EXPLORATION_TOOL_NAMES = new Set\(\["Grep", "Glob", "Task"\]\)/);
  assert.match(source, /function getCodeGraphFirstDenyMessage/);
  assert.match(source, /mcp__tech-cc-hub-knowledge__codegraph_search or mcp__tech-cc-hub-knowledge__codegraph_context before broad source exploration/);
  assert.match(source, /codeGraphRetrievalSeen = false/);
  assert.match(source, /isCodeGraphRetrievalTool\(toolName\)/);
  assert.match(source, /onCodeGraphRetrieval/);
  assert.match(source, /permissionDecision: "deny"/);
  assert.match(source, /permissionDecisionReason: codeGraphDenyMessage/);
});

test("legacy knowledge_index tool is no longer registered", () => {
  const source = readFileSync(join(process.cwd(), "src/electron/libs/mcp-tools/knowledge.ts"), "utf8");

  assert.doesNotMatch(source, /"knowledge_index"/);
  assert.doesNotMatch(source, /indexKnowledgeWorkspace/);
});
