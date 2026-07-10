import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const runnerSource = readFileSync(join(process.cwd(), "src/electron/libs/runner/runner.ts"), "utf8");

test("runner refreshes image generation context before expanding the image MCP", () => {
  assert.match(
    runnerSource,
    /syncImageGenerationSessionContext\(enabledBuiltinMcpServerNames\);\s*const result = await activeQuery\.setMcpServers/,
  );
});
