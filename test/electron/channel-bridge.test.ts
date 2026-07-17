import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Lark channel replies route explicitly through the CLI bridge", () => {
  const source = readFileSync("src/electron/libs/channel/channel-bridge.ts", "utf8");

  assert.match(source, /target\.provider === "lark"/);
  assert.match(source, /startLarkCliChannelBridge/);
  assert.match(source, /await larkBridge\.sendText\(target, text\)/);
  assert.doesNotMatch(source, /larkBridge\?[^\n]*sendWebhookText/);
});
