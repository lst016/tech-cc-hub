import test from "node:test";
import assert from "node:assert/strict";

import { formatIpcInvokeError } from "../../src/ui/utils/ipc-error.js";

test("formatIpcInvokeError unwraps Electron remote invoke errors", () => {
  assert.equal(
    formatIpcInvokeError(new Error("Error invoking remote method 'browser-open': Error: Malicious event")),
    "browser-open: Malicious event",
  );
});

test("formatIpcInvokeError preserves ordinary errors", () => {
  assert.equal(
    formatIpcInvokeError(new Error("plain failure")),
    "plain failure",
  );
});
