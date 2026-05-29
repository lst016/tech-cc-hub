import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("codegraph_context accepts query as a backward-compatible task alias", () => {
  const source = readFileSync("src/electron/libs/mcp-tools/knowledge.ts", "utf8");

  assert.match(source, /query:\s*z\.string\(\)\.min\(1\)\.optional\(\)\.describe\("Backward-compatible alias for task\."\)/);
  assert.match(source, /function resolveCodeGraphContextTask\(input: \{ task\?: string; query\?: string \}\): string/);
  assert.match(source, /input\.task\?\.trim\(\) \|\| input\.query\?\.trim\(\) \|\| ""/);
  assert.match(source, /const task = resolveCodeGraphContextTask\(input\);/);
});

test("codegraph retrieval has a slow-machine circuit breaker", () => {
  const source = readFileSync("src/electron/libs/mcp-tools/knowledge.ts", "utf8");

  assert.match(source, /const CODEGRAPH_RETRIEVAL_TIMEOUT_MS = 5_000;/);
  assert.match(source, /const CODEGRAPH_SLOW_COOLDOWN_MS = 10 \* 60 \* 1_000;/);
  assert.match(source, /slowCodeGraphRetrievals = new Map<string, CodeGraphSlowCircuit>/);
  assert.match(source, /CodeGraph is temporarily bypassed for this workspace/);
  assert.match(source, /recordSlowCodeGraphRetrieval\(workspaceRoot, label, Date\.now\(\) - startedAt\)/);
});
