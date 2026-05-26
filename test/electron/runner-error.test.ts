import test from "node:test";
import assert from "node:assert/strict";

import { normalizeRunnerError } from "../../src/electron/libs/runner/runner-error.js";

test("normalizeRunnerError translates missing model failures into a clear message", () => {
  const message = normalizeRunnerError(
    new Error('Request failed with status code 404: {"error":{"type":"not_found_error","message":"model claude-3-7-sonnet does not exist"}}'),
    "claude-3-7-sonnet",
  );

  assert.match(message, /请求模型「claude-3-7-sonnet」失败/);
  assert.match(message, /不可用|已下线|服务端没有找到/);
});

test("normalizeRunnerError keeps generic runtime errors readable", () => {
  const message = normalizeRunnerError(new Error("socket hang up"), "claude-sonnet-4-5");

  assert.equal(message, "socket hang up");
});

test("normalizeRunnerError includes Claude stderr for bare process exit codes", () => {
  const message = normalizeRunnerError(
    new Error("Claude Code process exited with code 3"),
    "gpt-5.5",
    undefined,
    { processStderr: "Error: 401 unauthorized\ninvalid_api_key" },
  );

  assert.match(message, /Claude Code process exited with code 3/);
  assert.match(message, /Claude Code stderr:/);
  assert.match(message, /401 unauthorized/);
  assert.match(message, /invalid_api_key/);
});

test("normalizeRunnerError redacts secret-looking stderr values", () => {
  const message = normalizeRunnerError(
    new Error("Claude Code process exited with code 3"),
    "gpt-5.5",
    undefined,
    { processStderr: "ANTHROPIC_AUTH_TOKEN=sk-abc123456789secret\nreal failure" },
  );

  assert.match(message, /ANTHROPIC_AUTH_TOKEN=\[redacted\]/);
  assert.match(message, /real failure/);
  assert.doesNotMatch(message, /sk-abc123456789secret/);
});

test("normalizeRunnerError adds Figma reauthorization guidance for auth failures", () => {
  const message = normalizeRunnerError(
    new Error("mcp__figma__get_code failed: 401 unauthorized token expired"),
    "claude-sonnet-4-5",
  );

  assert.match(message, /Figma OAuth 授权可能已过期/);
  assert.match(message, /重新走 OAuth 授权/);
});
