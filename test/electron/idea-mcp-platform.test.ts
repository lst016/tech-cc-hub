import assert from "node:assert/strict";
import test from "node:test";

import {
  getIdeaMcpServer,
  listIdeaToolNames,
} from "../../src/electron/libs/mcp-tools/idea.js";
import {
  listBuiltinMcpToolNames,
} from "../../src/electron/libs/builtin-mcp-servers.js";

function registeredToolNames(platform: NodeJS.Platform): string[] {
  const server = getIdeaMcpServer(platform);
  const instance = server.instance as unknown as {
    _registeredTools?: Record<string, unknown>;
  };
  return Object.keys(instance._registeredTools ?? {});
}

test("macOS does not expose Windows-only IDEA automation tools", () => {
  const expected = listIdeaToolNames("darwin");

  assert.equal(expected.includes("idea_restart"), false);
  assert.equal(expected.includes("idea_read_logs"), false);
  assert.deepEqual(registeredToolNames("darwin"), expected);

  const builtinToolNames = listBuiltinMcpToolNames(["tech-cc-hub-idea"], "darwin");
  assert.deepEqual(builtinToolNames, expected);
});

test("Windows keeps the full IDEA automation tool set", () => {
  const expected = listIdeaToolNames("win32");

  assert.equal(expected.includes("idea_restart"), true);
  assert.equal(expected.includes("idea_read_logs"), true);
  assert.deepEqual(registeredToolNames("win32"), expected);

  const builtinToolNames = listBuiltinMcpToolNames(["tech-cc-hub-idea"], "win32");
  assert.deepEqual(builtinToolNames, expected);
});
