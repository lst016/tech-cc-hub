import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const builtinMcpFactorySource = readFileSync(join(process.cwd(), "src/electron/libs/builtin-mcp-servers.ts"), "utf8");

const builtinSdkMcpToolFiles = [
  "src/electron/libs/mcp-tools/admin.ts",
  "src/electron/libs/mcp-tools/browser.ts",
  "src/electron/libs/mcp-tools/cron.ts",
  "src/electron/libs/mcp-tools/design.ts",
  "src/electron/libs/mcp-tools/figma-rest.ts",
  "src/electron/libs/mcp-tools/idea.ts",
  "src/electron/libs/mcp-tools/image-generation.ts",
  "src/electron/libs/mcp-tools/knowledge.ts",
  "src/electron/libs/mcp-tools/plan.ts",
] as const;

test("built-in SDK MCP servers are fresh per Agent SDK run", () => {
  assert.match(builtinMcpFactorySource, /connection-scoped/);

  for (const file of builtinSdkMcpToolFiles) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.doesNotMatch(
      source,
      /Map\s*<\s*string\s*,\s*McpSdkServerConfigWithInstance\s*>/,
      `${file} must not cache connection-scoped MCP server instances by key`,
    );
    assert.doesNotMatch(
      source,
      /\blet\s+\w*McpServer\s*:\s*McpSdkServerConfigWithInstance\s*\|\s*null\b/,
      `${file} must not keep a module-level MCP server singleton`,
    );
  }
});
