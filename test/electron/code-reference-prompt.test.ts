import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractCodeReferencesPrompt,
  extractFileReferencesPrompt,
  extractMessageReferencesPrompt,
} from '../../src/ui/utils/code-reference-prompt.js';

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

test('hides file reference structured blocks and exposes file chips', () => {
  const prompt = [
    '用户标签右样例啊 你cv就行了',
    '<file_references>',
    'This structured block contains explicit file or directory references selected through @ mention.',
    JSON.stringify({
      type: 'file_references',
      version: 1,
      count: 1,
      items: [{
        type: 'file_reference',
        index: 1,
        id: '406231bb-4b9d-4658-9188-fee855f5e426',
        file: {
          path: 'D:/workspace/kefu/boke-kefu-vue/src/pages/main/player/chatGamerAccountInfo/UserDetailContent.tsx',
          name: 'UserDetailContent.tsx',
          label: 'src/pages/main/player/chatGamerAccountInfo/UserDetailContent.tsx',
          kind: 'file',
          workspaceRoot: 'D:\\workspace\\kefu\\boke-kefu-vue',
        },
      }],
    }, null, 2),
    '</file_references>',
  ].join('\n');

  const result = extractFileReferencesPrompt(prompt);

  assert.equal(result.visiblePrompt, '用户标签右样例啊 你cv就行了');
  assert.deepEqual(result.fileReferences, [{
    index: 1,
    kind: 'file',
    filePath: 'D:/workspace/kefu/boke-kefu-vue/src/pages/main/player/chatGamerAccountInfo/UserDetailContent.tsx',
    fileName: 'UserDetailContent.tsx',
    label: 'src/pages/main/player/chatGamerAccountInfo/UserDetailContent.tsx',
    workspaceRoot: 'D:\\workspace\\kefu\\boke-kefu-vue',
  }]);
});

test('hides message reference structured blocks and exposes message chips', () => {
  const prompt = [
    '继续这个',
    '<message_references>',
    JSON.stringify({
      type: 'message_references',
      version: 1,
      count: 1,
      items: [{
        type: 'message_selection',
        index: 1,
        source: {
          role: 'assistant',
          label: '助手消息',
          capturedAt: 1779368400000,
        },
        selection: {
          text: '这里是被引用的聊天记录',
        },
      }],
    }, null, 2),
    '</message_references>',
  ].join('\n');

  const result = extractMessageReferencesPrompt(prompt);

  assert.equal(result.visiblePrompt, '继续这个');
  assert.deepEqual(result.messageReferences, [{
    index: 1,
    kind: 'selection',
    sourceRole: 'assistant',
    sourceLabel: '助手消息',
    capturedAt: 1779368400000,
    textPreview: '这里是被引用的聊天记录',
  }]);
});
