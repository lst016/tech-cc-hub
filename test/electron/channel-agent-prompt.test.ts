import assert from "node:assert/strict";
import test from "node:test";

import { buildChannelAgentPrompt } from "../../src/electron/libs/channel/channel-agent-prompt.js";

test("Lark IM prompts require local image delivery instead of URL-only replies", () => {
  const prompt = buildChannelAgentPrompt("lark", "生成一张图发我");

  assert.match(prompt, /^生成一张图发我/);
  assert.match(prompt, /不要只回复图片 URL/);
  assert.match(prompt, /当前频道工作区/);
  assert.match(prompt, /artifacts\/generated\.png/);
  assert.match(prompt, /!\[图片\]\(artifacts\/generated\.png\)/);
  assert.match(prompt, /image_generate/);
});

test("non-Lark channel prompts remain unchanged", () => {
  assert.equal(buildChannelAgentPrompt("telegram", "send an image"), "send an image");
});
