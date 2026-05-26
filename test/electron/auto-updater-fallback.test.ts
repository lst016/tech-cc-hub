import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGitHubReleaseDownloadFeedUrl,
  compareAppVersions,
  createReleaseUpdatePlan,
  getPlatformUpdateMetadataCandidates,
  isMissingPlatformUpdateMetadataError,
  selectBestReleaseForUpdate,
  summarizeGitHubReleaseForUpdates,
} from '../../src/electron/libs/auto-updater/auto-updater-fallback.js';

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

test('selects the newest compatible release above the current version', () => {
  const release = selectBestReleaseForUpdate([
    {
      tag_name: 'v0.1.13',
      name: '0.1.13',
      assets: [{ name: 'latest-mac.yml' }],
    },
    {
      tag_name: 'v0.1.12',
      name: '0.1.12',
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.12.exe' }],
    },
    {
      tag_name: 'v0.1.11',
      name: '0.1.11',
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.11.exe' }],
    },
    {
      tag_name: 'v0.1.10',
      name: '0.1.10',
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.10.exe' }],
    },
  ], '0.1.10', 'win32', 'x64');

  assert.equal(release?.version, '0.1.12');
  assert.equal(release?.tagName, 'v0.1.12');
  assert.equal(release?.metadataFile, 'latest.yml');
  assert.equal(release?.hasCompatibleUpdateMetadata, true);
});

test('builds a release-specific generic updater feed url', () => {
  assert.equal(
    buildGitHubReleaseDownloadFeedUrl('lst016', 'tech-cc-hub', 'v0.1.12'),
    'https://github.com/lst016/tech-cc-hub/releases/download/v0.1.12/',
  );
});

test('keeps differential updates for adjacent compatible releases', () => {
  const plan = createReleaseUpdatePlan([
    {
      tag_name: 'v0.1.12',
      name: '0.1.12',
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.12.exe' }],
    },
    {
      tag_name: 'v0.1.11',
      name: '0.1.11',
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.11.exe' }],
    },
  ], '0.1.11', 'win32', 'x64', 'lst016', 'tech-cc-hub');

  assert.equal(plan.selectedRelease?.tagName, 'v0.1.12');
  assert.equal(plan.isMultiReleaseUpdate, false);
  assert.equal(
    plan.previousBlockmapBaseUrl,
    'https://github.com/lst016/tech-cc-hub/releases/download/v0.1.11/',
  );
});

test('uses a full download plan when the newest compatible release skips releases', () => {
  const plan = createReleaseUpdatePlan([
    {
      tag_name: 'v0.1.12',
      name: '0.1.12',
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.12.exe' }],
    },
    {
      tag_name: 'v0.1.11',
      name: '0.1.11',
      assets: [{ name: 'latest-mac.yml' }],
    },
    {
      tag_name: 'v0.1.10',
      name: '0.1.10',
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.10.exe' }],
    },
  ], '0.1.10', 'win32', 'x64', 'lst016', 'tech-cc-hub');

  assert.equal(plan.selectedRelease?.tagName, 'v0.1.12');
  assert.equal(plan.isMultiReleaseUpdate, true);
  assert.equal(plan.previousBlockmapBaseUrl, undefined);
});
