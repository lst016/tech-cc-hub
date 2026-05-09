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
  assert.match(source, /id:\s*"open-computer-use"[\s\S]*version:\s*"0\.1\.48"/);
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
