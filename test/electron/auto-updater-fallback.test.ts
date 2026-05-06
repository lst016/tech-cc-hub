import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareAppVersions,
  getPlatformUpdateMetadataCandidates,
  isMissingPlatformUpdateMetadataError,
  summarizeGitHubReleaseForUpdates,
} from '../../src/electron/libs/auto-updater-fallback.js';

test('detects missing updater metadata errors from electron-updater', () => {
  assert.equal(
    isMissingPlatformUpdateMetadataError(new Error('Cannot find latest.yml in the latest release artifacts (404)')),
    true,
  );
  assert.equal(isMissingPlatformUpdateMetadataError(new Error('net::ERR_CONNECTION_RESET')), false);
});

test('compares semver tags with v prefixes', () => {
  assert.equal(compareAppVersions('v0.1.5', '0.1.5'), 0);
  assert.equal(compareAppVersions('v0.1.6', '0.1.5'), 1);
  assert.equal(compareAppVersions('0.1.4', '0.1.5'), -1);
});

test('reports missing Windows updater metadata for mac-only releases', () => {
  const fallback = summarizeGitHubReleaseForUpdates({
    tag_name: 'v0.1.5',
    name: '0.1.5',
    html_url: 'https://github.com/lst016/tech-cc-hub/releases/tag/v0.1.5',
    assets: [
      { name: 'latest-mac.yml' },
      { name: 'tech-cc-hub-0.1.5-arm64.dmg' },
    ],
  }, 'win32', 'x64');

  assert.equal(fallback.version, '0.1.5');
  assert.equal(fallback.hasCompatibleUpdateMetadata, false);
});

test('uses electron-updater default metadata names per platform', () => {
  assert.deepEqual(getPlatformUpdateMetadataCandidates('darwin', 'arm64'), ['latest-mac.yml']);
  assert.deepEqual(getPlatformUpdateMetadataCandidates('win32', 'x64'), ['latest.yml']);
  assert.deepEqual(getPlatformUpdateMetadataCandidates('linux', 'x64'), ['latest-linux.yml']);
});
