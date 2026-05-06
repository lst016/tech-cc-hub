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
