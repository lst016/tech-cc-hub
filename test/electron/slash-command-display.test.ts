import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSlashCommandDisplayParts,
  formatSlashCommandDisplayName,
  parseSlashCommandDraft,
  serializeSlashCommandDraft,
} from "../../src/ui/utils/slash-command-display.js";

test("parseSlashCommandDraft extracts command and editable argument", () => {
  const draft = parseSlashCommandDraft("/ai-image-gen 222", []);

  assert.deepEqual(draft, {
    commandName: "ai-image-gen",
    displayName: "AI Image Gen",
    argument: "222",
    prefixLength: "/ai-image-gen ".length,
    known: false,
    description: undefined,
  });
});

test("parseSlashCommandDraft resolves known command casing and description", () => {
  const draft = parseSlashCommandDraft("/pdf-skill 写个内容", [
    { name: "PDF-Skill", description: "生成 PDF 内容" },
  ]);

  assert.equal(draft?.commandName, "PDF-Skill");
  assert.equal(draft?.displayName, "PDF Skill");
  assert.equal(draft?.description, "生成 PDF 内容");
  assert.equal(draft?.argument, "写个内容");
});

test("parseSlashCommandDraft waits for a separator before entering command display mode", () => {
  assert.equal(parseSlashCommandDraft("/ai-image-gen", []), null);
});

test("serializeSlashCommandDraft keeps slash command transport format", () => {
  assert.equal(serializeSlashCommandDraft("ai-image-gen", "222"), "/ai-image-gen 222");
  assert.equal(serializeSlashCommandDraft("/pdf-skill", ""), "/pdf-skill ");
});

test("formatSlashCommandDisplayName preserves common AI acronyms", () => {
  assert.equal(formatSlashCommandDisplayName("pdf-ai-rag"), "PDF AI RAG");
});

test("buildSlashCommandDisplayParts renders command tokens inline", () => {
  const parts = buildSlashCommandDisplayParts("你哈 /agent-reach sss", [
    { name: "agent-reach", description: "Agent reach skill" },
  ]);

  assert.deepEqual(parts, [
    { type: "text", text: "你哈 " },
    {
      type: "command",
      raw: "/agent-reach",
      commandName: "agent-reach",
      displayName: "Agent Reach",
      known: true,
      description: "Agent reach skill",
    },
    { type: "text", text: " sss" },
  ]);
});

test("buildSlashCommandDisplayParts does not replace an in-progress command query", () => {
  assert.deepEqual(buildSlashCommandDisplayParts("你哈 /agent", []), [
    { type: "text", text: "你哈 /agent" },
  ]);
});
