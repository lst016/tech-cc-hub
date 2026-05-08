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
