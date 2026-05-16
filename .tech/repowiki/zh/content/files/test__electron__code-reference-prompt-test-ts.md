# test/electron/code-reference-prompt.test.ts

> 模块：`test` · 语言：`typescript` · 行数：59

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `prompt@7`
- `result@35`
- `result@54`

## 依赖输入

- `node:assert/strict`
- `node:test`
- `../../src/ui/utils/code-reference-prompt.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import { extractCodeReferencesPrompt } from '../../src/ui/utils/code-reference-prompt.js';

test('hides code reference structured blocks and exposes summaries', () => {
  const prompt = [
    '请改这里',
    '<code_references>',
    'This structured block is internal context.',
    JSON.stringify({
      type: 'code_references',
      count: 1,
      items: [{
        type: 'code_comment',
        index: 1,
        file: {
          path: 'D:\\workspace\\app\\src\\index.tsx',
          name: 'index.tsx',
          language: 'typescript',
        },
        range: {
          startLine: 10,
          endLine: 12,
          label: '10-12',
        },
        comment: '这里状态没更新',
        selection: {
          text: 'const stale = true;',
        },
      }],
    }),
    '</code_references>',
  ].join('\n');

  const result = extractCodeReferencesPrompt(prompt);

  assert.equal(result.visiblePrompt, '请改这里');
  assert.deepEqual(result.codeReferences, [{
    index: 1,
    kind: 'comment',
    filePath: 'D:\\workspace\\app\\src\\index.tsx',
    fileName: 'index.tsx',
    language: 'typescript',
    rangeLabel: '10-12',
    startLine: 10,
    endLine: 12,
    comment: '这里状态没更新',
    selectionPreview: 'const stale = true;',
  }]);
});

test('hides malformed code reference blocks instead of showing raw protocol text', () => {
  const result = extractCodeReferencesPrompt('hello\n<code_references>\nnot json\n</code_references>');

  assert.equal(result.visiblePrompt, 'hello');
  assert.deepEqual(result.codeReferences, [{ index: 1, kind: 'selection' }]);
});

```
