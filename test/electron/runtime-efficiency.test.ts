import test from "node:test";
import assert from "node:assert/strict";

import { buildRunnerReuseKey, canReuseRunner } from "../../src/electron/libs/runner-reuse.js";
import { resolveRuntimeEfficiencyProfile } from "../../src/electron/libs/runtime-efficiency.js";

test("runtime efficiency defaults to the small standard tool surface", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "解释一下这个函数为什么会重复读文件",
  });

  assert.equal(profile.id, "standard");
  assert.deepEqual(profile.builtinMcpServers, [
    "tech-cc-hub-admin",
    "tech-cc-hub-plan",
    "tech-cc-hub-knowledge",
  ]);
  assert.equal(profile.includePartialMessages, false);
  assert.equal(profile.includeHookEvents, false);
});

test("runtime efficiency enables visual tools for image attachments", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "照着截图修一下页面",
    attachments: [{
      id: "image-1",
      kind: "image",
      data: "tech-cc-hub://prompt-attachments/session/image.png",
      mimeType: "image/png",
      name: "reference.png",
    }],
  });

  assert.equal(profile.id, "visual");
  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-browser"));
  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-design"));
  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-figma"));
  assert.equal(profile.includeBrowserPrompt, true);
  assert.equal(profile.includeDesignPrompt, true);
});

test("runtime efficiency keeps cron tools out of normal coding turns", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "每天下午提醒我检查构建状态",
  });

  assert.equal(profile.id, "automation");
  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-cron"));
  assert.equal(profile.builtinMcpServers.includes("tech-cc-hub-figma"), false);
  assert.equal(profile.builtinMcpServers.includes("tech-cc-hub-browser"), false);
});

test("runtime efficiency enables Agent Teams visibility for parallel team prompts", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "用 Agent Teams 做跨层并行开发，API、数据层、测试分给不同 teammate",
  });

  assert.equal(profile.id, "team");
  assert.equal(profile.includeClaudeCompatPrompt, true);
  assert.equal(profile.includeHookEvents, true);
  assert.equal(profile.agentProgressSummaries, true);
  assert.equal(profile.forwardSubagentText, true);
  assert.deepEqual(profile.builtinMcpServers, [
    "tech-cc-hub-admin",
    "tech-cc-hub-plan",
    "tech-cc-hub-knowledge",
  ]);
});

test("runtime efficiency keeps visual tools when Agent Teams work includes UI", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "用 Agent Teams 分工修 UI 截图还原，leader 负责 review",
  });

  assert.equal(profile.id, "team");
  assert.equal(profile.includeBrowserPrompt, true);
  assert.equal(profile.includeDesignPrompt, true);
  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-browser"));
  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-design"));
});

test("runner reuse key stays stable across normal coding prompts", () => {
  const first = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "解释这个函数",
  });
  const second = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "继续修复这个问题",
  });

  assert.equal(first, second);
});

test("runner reuse allows compatible turns to expand the tool surface in-place", () => {
  const coding = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "解释这个函数",
  });
  const visual = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "照着截图修页面",
    attachments: [{
      id: "image-1",
      kind: "image",
      data: "tech-cc-hub://prompt-attachments/session/image.png",
      mimeType: "image/png",
      name: "reference.png",
    }],
  });

  assert.notEqual(coding, visual);
  assert.equal(canReuseRunner(coding, visual), true);
  assert.equal(canReuseRunner(visual, coding), true);
});
