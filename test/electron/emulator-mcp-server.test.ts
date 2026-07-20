import test from "node:test";
import assert from "node:assert/strict";

import { buildMobileMcpServerConfig } from "../../src/electron/libs/emulator-installer/mobile-mcp-config.js";

test("builds mobile-mcp stdio config with enhanced CLI env", () => {
  const config = buildMobileMcpServerConfig("ws://127.0.0.1:8123", {
    HOME: "/Users/techcc",
    PATH: "/usr/bin:/bin",
    SHOULD_DROP: undefined,
  }, "darwin");

  assert.equal(config.type, "stdio");
  assert.equal(config.command, "mobile-mcp");
  assert.equal(config.env?.MOBILE_MCP_REMOTE_AGENT_URL, "ws://127.0.0.1:8123");
  assert.equal(config.env?.SHOULD_DROP, undefined);
  assert.match(config.env?.PATH ?? "", /\/Users\/techcc\/\.volta\/bin/);
  assert.match(config.env?.PATH ?? "", /\/opt\/homebrew\/bin/);
});
