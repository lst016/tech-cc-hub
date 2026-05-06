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
