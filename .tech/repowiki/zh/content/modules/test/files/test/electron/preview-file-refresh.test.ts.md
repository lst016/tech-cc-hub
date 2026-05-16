# test/electron/preview-file-refresh.test.ts

> 模块：`test` · 语言：`typescript` · 行数：74

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `messages@10`
- `messages@47`

## 依赖输入

- `node:assert/strict`
- `node:test`
- `../../src/ui/utils/preview-file-refresh.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectCompletedPreviewFileChanges,
  normalizePreviewFilePath,
} from '../../src/ui/utils/preview-file-refresh.js';

test('collects successful completed file writes from streamed tool messages', () => {
  const messages = [
    {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_edit_1',
            name: 'Edit',
            input: { file_path: 'D:\\workspace\\kefu\\boke-kefu-vue\\src\\index.tsx' },
          },
        ],
      },
    },
    {
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_edit_1',
            content: 'ok',
          },
        ],
      },
    },
  ];

  assert.deepEqual(collectCompletedPreviewFileChanges(messages), [
    {
      path: 'D:\\workspace\\kefu\\boke-kefu-vue\\src\\index.tsx',
      operationId: 'toolu_edit_1',
    },
  ]);
});

test('ignores pending and failed write tool calls', () => {
  const messages = [
    {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 'pending', name: 'Write', input: { file_path: 'D:/app/a.ts' } },
          { type: 'tool_use', id: 'failed', name: 'MultiEdit', input: { file_path: 'D:/app/b.ts' } },
        ],
      },
    },
    {
      type: 'user',
      message: {
        content: [{ type: 'tool_result', tool_use_id: 'failed', is_error: true, content: 'nope' }],
      },
    },
  ];

  assert.deepEqual(collectCompletedPreviewFileChanges(messages), []);
});

test('normalizes Windows paths for preview tab matching', () => {
  assert.equal(
    normalizePreviewFilePath('D:\\workspace\\Project\\src\\index.tsx'),
    'd:/workspace/project/src/index.tsx',
  );
});

```
