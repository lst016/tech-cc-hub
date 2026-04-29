import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildClaudeProjectMemoryPromptAppend,
  getClaudeProjectMemoryDir,
  loadClaudeProjectMemory,
  toClaudeProjectSlug,
} from "../../src/electron/libs/claude-project-memory.js";

const tempRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-claude-memory-"));

after(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("claude project memory", () => {
  it("maps Windows cwd to Claude project slug", () => {
    assert.equal(
      toClaudeProjectSlug("D:\\workspace\\kefu\\boke-kefu-vue"),
      "D--workspace-kefu-boke-kefu-vue",
    );
  });

  it("resolves the Claude project memory directory", () => {
    assert.equal(
      getClaudeProjectMemoryDir("D:\\workspace\\kefu\\boke-kefu-vue", tempRoot),
      join(tempRoot, "projects", "D--workspace-kefu-boke-kefu-vue", "memory"),
    );
  });

  it("loads markdown memory files with MEMORY.md first", () => {
    const memoryDir = getClaudeProjectMemoryDir("D:\\workspace\\kefu\\boke-kefu-vue", tempRoot);
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, "feedback_annotation_workflow.md"), "annotation rules", "utf8");
    writeFileSync(join(memoryDir, "MEMORY.md"), "# Memory Index", "utf8");
    writeFileSync(join(memoryDir, "raw.jsonl"), "should not load", "utf8");

    const bundle = loadClaudeProjectMemory("D:\\workspace\\kefu\\boke-kefu-vue", {
      claudeRoot: tempRoot,
    });

    assert.ok(bundle);
    assert.deepEqual(bundle.documents.map((doc) => doc.name), [
      "MEMORY.md",
      "feedback_annotation_workflow.md",
    ]);
    assert.equal(bundle.documents.some((doc) => doc.name === "raw.jsonl"), false);
  });

  it("builds a project-level prompt append with provenance", () => {
    const prompt = buildClaudeProjectMemoryPromptAppend("D:\\workspace\\kefu\\boke-kefu-vue", {
      claudeRoot: tempRoot,
    });

    assert.ok(prompt);
    assert.ok(prompt.includes("Claude 项目 memory"));
    assert.ok(prompt.includes("MEMORY.md"));
    assert.ok(prompt.includes("annotation rules"));
  });

  it("returns undefined when no memory exists", () => {
    const prompt = buildClaudeProjectMemoryPromptAppend("Z:\\missing\\project", {
      claudeRoot: tempRoot,
    });
    assert.equal(prompt, undefined);
  });
});
