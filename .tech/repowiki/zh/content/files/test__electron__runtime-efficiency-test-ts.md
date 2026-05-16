# test/electron/runtime-efficiency.test.ts

> 模块：`test` · 语言：`typescript` · 行数：90

## 文件职责

测试运行时效率配置选择，验证标准/视觉/自动化三种配置profile及其内置MCP服务器差异、runner复用key稳定性

## 关键符号

- `resolveRuntimeEfficiencyProfile@0 - 根据prompt和attachments解析运行时效率profile`
- `buildRunnerReuseKey@0 - 构建runner复用key，仅包含cwd/model，不含prompt`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/electron/libs/runner-reuse.js`
- `../../src/electron/libs/runtime-efficiency.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

```
