import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDevLoopToPrompt,
  classifyDevLoop,
  createDevLoopMessage,
} from "../../src/shared/dev-loop.js";

test("classifies screenshot or image tasks as visual dev loop", () => {
  const result = classifyDevLoop({
    prompt: "按照这张截图复刻页面布局",
    attachments: [{ id: "img-1", kind: "image", name: "target.png" }],
    cwd: "D:\\tool\\tech-cc-hub",
  });

  assert.equal(result.taskKind, "visual");
  assert.equal(result.loopMode, "visual-dev");
  assert.ok(result.reasons.some((reason) => reason.includes("附件")));
});

test("classifies tech-cc-hub UI tasks as electron window loop", () => {
  const result = classifyDevLoop({
    prompt: "修复右侧 Trace Viewer 的 UI 布局并截图验证",
    cwd: "D:\\tool\\tech-cc-hub",
  });

  assert.equal(result.taskKind, "electron");
  assert.equal(result.loopMode, "electron-window");
});

test("classifies backend code tasks as dev loop", () => {
  const result = classifyDevLoop({
    prompt: "修复后端 API 的分页 bug 并补测试",
    cwd: "D:\\workspace\\service",
  });

  assert.equal(result.taskKind, "code");
  assert.equal(result.loopMode, "dev");
});

test("keeps documentation-only tasks out of dev loop", () => {
  const result = classifyDevLoop({
    prompt: "更新 README 里的安装说明，不改代码",
    cwd: "D:\\tool\\tech-cc-hub",
  });

  assert.equal(result.taskKind, "docs");
  assert.equal(result.loopMode, "none");
});

test("injects instructions only when a loop is active", () => {
  const dev = classifyDevLoop({ prompt: "实现一个 React 组件", cwd: "D:\\workspace\\app" });
  const injected = applyDevLoopToPrompt("实现一个 React 组件", dev);

  assert.notEqual(injected, "实现一个 React 组件");
  assert.ok(injected.includes("Dev Loop"));
  assert.ok(injected.includes("验证"));

  const docs = classifyDevLoop({ prompt: "整理开发规范文档", cwd: "D:\\workspace\\app" });
  assert.equal(applyDevLoopToPrompt("整理开发规范文档", docs), "整理开发规范文档");
});

test("injects a first-shot design pack for visual tasks", () => {
  const visual = classifyDevLoop({
    prompt: "按照 Figma 截图复刻这个页面",
    cwd: "D:\\workspace\\app",
  });
  const injected = applyDevLoopToPrompt("按照 Figma 截图复刻这个页面", visual);

  assert.ok(injected.includes("First-Shot Design Pack"));
  assert.ok(injected.includes("先提取目标图规格"));
  assert.ok(injected.includes("颜色 token"));
  assert.ok(injected.includes("不要先写代码"));
});

test("injects first-shot constraints for electron window tasks", () => {
  const electron = classifyDevLoop({
    prompt: "优化右侧 Trace Viewer 的 UI 布局",
    cwd: "D:\\tool\\tech-cc-hub",
  });
  const injected = applyDevLoopToPrompt("优化右侧 Trace Viewer 的 UI 布局", electron);

  assert.ok(injected.includes("First-Shot Design Pack"));
  assert.ok(injected.includes("Electron 真窗口"));
  assert.ok(injected.includes("当前组件入口"));
  assert.ok(injected.includes("验收标准"));
});

test("creates a typed dev loop stream message", () => {
  const classification = classifyDevLoop({ prompt: "按 Figma 改页面", cwd: "D:\\workspace\\app" });
  const message = createDevLoopMessage(classification, "classified");

  assert.equal(message.type, "dev_loop");
  assert.equal(message.phase, "classified");
  assert.equal(message.loopMode, "visual-dev");
  assert.ok(message.summary.includes("Dev Loop"));
});
