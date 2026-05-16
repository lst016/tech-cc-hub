# test/electron/preview-file-locator.test.ts

> 模块：`test` · 语言：`typescript` · 行数：47

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 依赖输入

- `node:assert/strict`
- `node:test`
- `../../src/ui/utils/preview-file-locator.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPreviewFileAncestorDirectories,
  isPreviewFileInsideWorkspace,
} from '../../src/ui/utils/preview-file-locator.js';

test('builds Windows ancestor directories for locating a preview file', () => {
  assert.deepEqual(
    getPreviewFileAncestorDirectories(
      'D:\\workspace\\kefu\\boke-kefu-vue',
      'D:\\workspace\\kefu\\boke-kefu-vue\\src\\pages\\index.tsx',
    ),
    [
      'D:\\workspace\\kefu\\boke-kefu-vue',
      'D:\\workspace\\kefu\\boke-kefu-vue\\src',
      'D:\\workspace\\kefu\\boke-kefu-vue\\src\\pages',
    ],
  );
});

test('keeps direct children locatable from the workspace root', () => {
  assert.deepEqual(
    getPreviewFileAncestorDirectories('/repo/app', '/repo/app/package.json'),
    ['/repo/app'],
  );
});

test('rejects files outside the current workspace', () => {
  assert.equal(
    isPreviewFileInsideWorkspace('D:\\workspace\\app', 'D:\\workspace\\other\\index.ts'),
    false,
  );
  assert.deepEqual(
    getPreviewFileAncestorDirectories('D:\\workspace\\app', 'D:\\workspace\\other\\index.ts'),
    [],
  );
});

test('matches Windows workspace paths case-insensitively', () => {
  assert.equal(
    isPreviewFileInsideWorkspace('D:\\Workspace\\App', 'd:\\workspace\\app\\src\\main.ts'),
    true,
  );
});

```
