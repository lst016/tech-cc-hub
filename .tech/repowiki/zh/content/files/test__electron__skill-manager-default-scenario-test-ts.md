# test/electron/skill-manager-default-scenario.test.ts

> 模块：`test` · 语言：`typescript` · 行数：21

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `ipcHandlersSource@6`
- `scenariosSource@7`
- `ipcHandlersSource@15`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `node:fs`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("skill manager initializes a real active scenario before skills are imported", () => {
  const ipcHandlersSource = readFileSync("src/electron/libs/skill-manager/ipc-handlers.ts", "utf8");
  const scenariosSource = readFileSync("src/electron/libs/skill-manager/scenarios.ts", "utf8");

  assert.match(ipcHandlersSource, /ensureDefaultScenario\(\);/);
  assert.match(scenariosSource, /export function ensureDefaultScenario/);
  assert.match(scenariosSource, /setActiveScenario\(id\)/);
});

test("local skill imports use scenario sync path, not database-only membership", () => {
  const ipcHandlersSource = readFileSync("src/electron/libs/skill-manager/ipc-handlers.ts", "utf8");

  assert.match(ipcHandlersSource, /addSkillToScenarioAndSync\(id, activeId\)/);
  assert.match(ipcHandlersSource, /addSkillToScenarioAndSync\(existing\.id, activeId\)/);
  assert.doesNotMatch(ipcHandlersSource, /dbAddSkillToScenario/);
});

```
