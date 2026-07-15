import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("browser canvas skill routes through generic semantic providers", () => {
  const skill = readFileSync("skills/techcc-read-browser-canvas/SKILL.md", "utf8");
  const agentMetadata = readFileSync("skills/techcc-read-browser-canvas/agents/openai.yaml", "utf8");
  const builder = readFileSync("electron-builder.json", "utf8");

  assert.match(skill, /^---\s+[\s\S]*name:\s*techcc-read-browser-canvas\s+[\s\S]*---/);
  assert.match(skill, /browser_extract_canvas/);
  assert.match(skill, /browser_wait_canvas/);
  assert.match(skill, /provider/);
  assert.match(agentMetadata, /\$techcc-read-browser-canvas/);
  assert.match(builder, /skills\/techcc-read-browser-canvas/);
  assert.doesNotMatch(builder, /skills\/techcc-read-browser-terminal/);
});
