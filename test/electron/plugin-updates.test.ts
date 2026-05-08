import assert from 'node:assert/strict';
import test from 'node:test';

import {
  comparePluginVersions,
  normalizePluginVersion,
  summarizePluginUpdate,
} from '../../src/electron/libs/plugin-updates.js';

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
