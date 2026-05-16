# test/electron/plugin-updates.test.ts

> 模块：`test` · 语言：`typescript` · 行数：86

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `update@19`
- `update@33`
- `source@44`
- `source@50`
- `source@81`

## 依赖输入

- `node:assert/strict`
- `node:fs`
- `node:test`
- `../../src/electron/libs/plugin-updates.js`
- `../../src/ui/components/settings/plugin-toast-messages.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  comparePluginVersions,
  normalizePluginVersion,
  summarizePluginUpdate,
} from '../../src/electron/libs/plugin-updates.js';
import { buildPluginActionToastMessage } from '../../src/ui/components/settings/plugin-toast-messages.js';

test('normalizes plugin versions from command and registry output', () => {
  assert.equal(normalizePluginVersion('open-computer-use 0.1.36'), '0.1.36');
  assert.equal(normalizePluginVersion('v0.1.37\n'), '0.1.37');
  assert.equal(normalizePluginVersion('open-computer-use@0.1.38'), '0.1.38');
});

test('detects when a plugin has a newer registry version', () => {
  const update = summarizePluginUpdate({
    currentVersion: 'open-computer-use 0.1.36',
    latestVersion: '0.1.37',
  });

  assert.equal(update.updateAvailable, true);
  assert.equal(update.updateStatus, 'update-available');
  assert.equal(update.currentVersion, '0.1.36');
  assert.equal(update.latestVersion, '0.1.37');
});

test('treats same or older registry versions as up to date', () => {
  assert.equal(comparePluginVersions('0.1.37', '0.1.36'), 1);
  assert.equal(comparePluginVersions('0.1.36', '0.1.36'), 0);

  const update = summarizePluginUpdate({
    currentVersion: '0.1.37',
    latestVersion: '0.1.36',
  });

  assert.equal(update.updateAvailable, false);
  assert.equal(update.updateStatus, 'up-to-date');
});

test('keeps the Open Computer Use default plugin version on the expected baseline', () => {
  const source = readFileSync('src/ui/components/settings/PluginsSettingsPage.tsx', 'utf8');
  assert.match(source, /const\s+OPEN_COMPUTER_USE_ID\s*=\s*"open-computer-use"/);
  assert.match(source, /id:\s*OPEN_COMPUTER_USE_ID[\s\S]*version:\s*"0\.1\.48"/);
});

test('includes the Figma official MCP default plugin', () => {
  const source = readFileSync('src/ui/components/settings/PluginsSettingsPage.tsx', 'utf8');
  assert.match(source, /const\s+FIGMA_OFFICIAL_ID\s*=\s*"figma-official"/);
  assert.match(source, /id:\s*FIGMA_OFFICIAL_ID/);
  assert.match(source, /https:\/\/mcp\.figma\.com\/mcp/);
  assert.match(source, /http:\/\/127\.0\.0\.1:3845\/mcp/);
  assert.match(source, /plugins:connectFigmaPatOfficial/);
  assert.match(source, /plugins:connectFigmaDesktopOfficial/);
  assert.match(source, /Figma REST API/);
  assert.match(source, /Personal Access Token/);
  assert.match(source, /使用桌面 MCP/);
  assert.match(source, /const\s+FIGMA_AGENT_GUIDE_ENABLED\s*=\s*false/);
  assert.match(source, /plugin\.id !== FIGMA_OFFICIAL_ID \|\| FIGMA_AGENT_GUIDE_ENABLED/);
  assert.match(source, /MCP 工具/);
  assert.match(source, /toolCount/);
  assert.match(source, /tools/);
});

test('formats plugin action results as a toast title plus version details', () => {
  assert.deepEqual(buildPluginActionToastMessage({
    success: true,
    message: 'Open Computer Use 已更新到最新版本并接入。',
    version: '0.1.48',
    latestVersion: '0.1.48',
  }), {
    kind: 'success',
    title: 'Open Computer Use 已更新到最新版本并接入。',
    description: '当前版本：0.1.48 · 最新版本：0.1.48',
  });
});

test('uses toast as the default plugin action feedback surface', () => {
  const source = readFileSync('src/ui/components/settings/PluginsSettingsPage.tsx', 'utf8');
  assert.match(source, /import\s+\{\s*toast\s*\}\s+from\s+"sonner"/);
  assert.match(source, /buildPluginActionToastMessage/);
  assert.doesNotMatch(source, /\{installResult\s*&&\s*\(/);
});

```
