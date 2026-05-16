# test/electron/api-config-save-scope.test.ts

> 模块：`test` · 语言：`typescript` · 行数：23

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `source@6`
- `source@17`

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

test("settings save does not rewrite api profiles unless they changed", () => {
  const source = readFileSync("src/ui/components/SettingsModal.tsx", "utf8");

  assert.match(source, /const \[apiConfigDirty, setApiConfigDirty\] = useState\(false\)/);
  assert.match(source, /setApiConfigDirty\(false\);/);
  assert.match(source, /setApiConfigDirty\(true\);/);
  assert.match(source, /const profileError = apiConfigDirty \? validateProfiles\(normalizedProfiles\) : null;/);
  assert.match(source, /apiConfigDirty\s+\?\s+window\.electron\.saveApiConfig\(\{ profiles: nextProfiles \}\)/);
  assert.match(source, /if \(apiConfigDirty\) \{\s*setApiConfigSettings\(\{ profiles: nextProfiles \}\);/s);
});

test("claude settings fallback is read-only and does not persist into api config", () => {
  const source = readFileSync("src/electron/libs/claude-settings.ts", "utf8");

  assert.doesNotMatch(source, /saveApiConfigSettings/);
  assert.match(source, /function getFallbackClaudeSettingsConfig\(\): ApiConfig \| null/);
  assert.match(source, /return config;/);
});

```
