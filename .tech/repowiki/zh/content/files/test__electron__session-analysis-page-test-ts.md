# test/electron/session-analysis-page.test.ts

> 模块：`session-engine` · 语言：`typescript` · 行数：20

## 文件职责

测试App中session analysis的入口和页面渲染

## 关键符号

- `test@0 - 验证App.tsx/ActivityRail.tsx/SessionAnalysisPage.tsx中的关键字存在`

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

test("app exposes a session analysis entry and renders the analysis page skeleton", () => {
  const appSource = readFileSync(join(process.cwd(), "src/ui/App.tsx"), "utf8");
  const railSource = readFileSync(join(process.cwd(), "src/ui/components/ActivityRail.tsx"), "utf8");
  const analysisPageSource = readFileSync(join(process.cwd(), "src/ui/components/SessionAnalysisPage.tsx"), "utf8");

  assert.match(appSource, /showSessionAnalysis/);
  assert.match(railSource, /打开 Trace Viewer/);
  assert.match(analysisPageSource, /提示词分布/);
  assert.match(analysisPageSource, /上下文诊断/);
  assert.match(analysisPageSource, /当前 Trace 节点/);
  assert.match(analysisPageSource, /提示词账本/);
  assert.match(analysisPageSource, /分析优化/);
  assert.match(analysisPageSource, /分析卡片/);
});

```
