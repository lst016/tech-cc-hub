import test from "node:test";
import assert from "node:assert/strict";

import { isChannelChatEnabled } from "../../src/shared/channel-config.js";

test("channel chat toggle is off when the channel is disabled", () => {
  assert.equal(isChannelChatEnabled({ enabled: false, chatEnabled: true }), false);
  assert.equal(isChannelChatEnabled(null), false);
});

test("channel chat toggle preserves old enabled-only configs", () => {
  assert.equal(isChannelChatEnabled({ enabled: true }), true);
});

test("channel chat toggle can disable chat while the channel remains enabled", () => {
  assert.equal(isChannelChatEnabled({ enabled: true, chatEnabled: false }), false);
  assert.equal(isChannelChatEnabled({ enabled: true, chatEnabled: true }), true);
});
