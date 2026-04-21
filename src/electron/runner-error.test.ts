import test from "node:test";
import assert from "node:assert/strict";

import { normalizeRunnerError } from "./libs/runner-error.js";

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
