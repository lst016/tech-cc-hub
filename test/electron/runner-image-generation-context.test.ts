import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { resolveImageGenerationToolDefaults } from "../../src/shared/image-generation-prompt.js";

const runnerSource = readFileSync(join(process.cwd(), "src/electron/libs/runner/runner.ts"), "utf8");

test("runner refreshes image generation context before expanding the image MCP", () => {
  assert.match(
    runnerSource,
    /syncImageGenerationSessionContext\(enabledBuiltinMcpServerNames\);\s*const result = await activeQuery\.setMcpServers/,
  );
});

test("runner applies composer image-generation defaults from the execution prompt", () => {
  const prompt = `<image_generation>\n${JSON.stringify({
    type: "image_generation",
    parameters: { width: 4096, height: 4096, count: 3 },
  }, null, 2)}\n</image_generation>`;

  assert.deepEqual(
    resolveImageGenerationToolDefaults(
      "mcp__tech-cc-hub-image__image_generate",
      { prompt: "draw" },
      prompt,
    ),
    { prompt: "draw", size: "4096x4096", count: 3 },
  );
  assert.equal(
    resolveImageGenerationToolDefaults(
      "mcp__tech-cc-hub-image__image_generate",
      { prompt: "draw" },
      "Draw a mountain at sunrise.",
    ),
    null,
  );
  assert.match(
    runnerSource,
    /let currentAgentPrompt = prompt;\s*let currentDisplayPrompt = displayPrompt;/,
  );
  assert.match(
    runnerSource,
    /resolveImageGenerationToolDefaults\(\s*toolName,\s*effectiveInput,\s*currentAgentPrompt,/,
  );
  assert.match(
    runnerSource,
    /currentAgentPrompt = nextPrompt;\s*currentDisplayPrompt = appendOptions\.displayPrompt \?\? nextPrompt;/,
  );
});
