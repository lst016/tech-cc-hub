# test/electron/app-shell-layout.test.ts

> 模块：`test` · 语言：`typescript` · 行数：31

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `appSource@7`
- `activityRailSource@8`
- `promptInputSource@9`
- `appSource@23`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `node:fs`
- `node:path`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("app shell avoids fixed-width caps for the chat surface and prompt dock", () => {
  const appSource = readFileSync(join(process.cwd(), "src/ui/App.tsx"), "utf8");
  const activityRailSource = readFileSync(join(process.cwd(), "src/ui/components/ActivityRail.tsx"), "utf8");
  const promptInputSource = readFileSync(join(process.cwd(), "src/ui/components/PromptInput.tsx"), "utf8");

  assert.equal(appSource.includes("max-w-[920px]"), false);
  assert.match(activityRailSource, /执行计划/);
  assert.match(activityRailSource, /查看对应证据/);
  assert.match(activityRailSource, /打开 Trace Viewer/);
  assert.equal(promptInputSource.includes("lg:max-w-[900px]"), false);
  assert.equal(promptInputSource.includes("max-h-[min(55vh,420px)]"), false);
  assert.match(promptInputSource, /max-h-\[min\(42vh,320px\)\]/);
  assert.match(appSource, /clamp\(/);
  assert.match(promptInputSource, /clamp\(/);
});

test("feedback button opens github issues directly", () => {
  const appSource = readFileSync(join(process.cwd(), "src/ui/App.tsx"), "utf8");

  assert.match(appSource, /github\.com\/lst016\/tech-cc-hub\/issues\/new/);
  assert.match(appSource, /window\.open\(/);
  assert.match(appSource, /occluded=\{browserWorkbenchOccluded\}/);
  // FeedbackDialog removed in favor of direct browser link
  assert.doesNotMatch(appSource, /showFeedbackDialog/);
});

```
