import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildGitHubReleaseDownloadFeedUrl,
  compareAppVersions,
  createReleaseUpdatePlan,
  getPlatformUpdateChannel,
  getPlatformUpdateMetadataCandidates,
  isMissingPlatformUpdateMetadataError,
  selectBestReleaseForUpdate,
  summarizeGitHubReleaseForUpdates,
} from '../../src/electron/libs/auto-updater/auto-updater-fallback.js';

test('detects missing updater metadata errors from electron-updater', () => {
  assert.equal(
    isMissingPlatformUpdateMetadataError(new Error('Cannot find latest-arm64-mac.yml in the latest release artifacts (404)')),
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
  assert.equal(fallback.hasCompatibleInstallerAsset, false);
  assert.deepEqual(fallback.missingUpdateAssets, ['one of latest.yml', 'platform installer asset']);
});

test('uses electron-updater default metadata names per platform', () => {
  assert.equal(getPlatformUpdateChannel('darwin', 'arm64'), undefined);
  assert.equal(getPlatformUpdateChannel('darwin', 'x64'), 'latest-x64');
  assert.equal(getPlatformUpdateChannel('win32', 'arm64'), 'latest-win-arm64');
  assert.equal(getPlatformUpdateChannel('win32', 'x64'), undefined);
  assert.deepEqual(getPlatformUpdateMetadataCandidates('darwin', 'arm64'), ['latest-mac.yml']);
  assert.deepEqual(getPlatformUpdateMetadataCandidates('darwin', 'x64'), ['latest-x64-mac.yml']);
  assert.deepEqual(getPlatformUpdateMetadataCandidates('win32', 'x64'), ['latest.yml']);
  assert.deepEqual(getPlatformUpdateMetadataCandidates('linux', 'x64'), ['latest-linux.yml']);
});

test('reports missing macOS updater assets when only the other architecture is published', () => {
  const fallback = summarizeGitHubReleaseForUpdates({
    tag_name: 'v0.1.5',
    name: '0.1.5',
    html_url: 'https://github.com/lst016/tech-cc-hub/releases/tag/v0.1.5',
    assets: [
      { name: 'latest-x64-mac.yml' },
      { name: 'tech-cc-hub-0.1.5-x64.zip' },
      { name: 'tech-cc-hub-0.1.5-x64.dmg' },
    ],
  }, 'darwin', 'arm64');

  assert.equal(fallback.hasCompatibleUpdateMetadata, false);
  assert.equal(fallback.hasCompatibleInstallerAsset, false);
  assert.deepEqual(fallback.missingUpdateAssets, ['one of latest-mac.yml', 'platform installer asset']);
});

test('accepts matching macOS updater metadata and installer assets per architecture', () => {
  const fallback = summarizeGitHubReleaseForUpdates({
    tag_name: 'v0.1.5',
    name: '0.1.5',
    html_url: 'https://github.com/lst016/tech-cc-hub/releases/tag/v0.1.5',
    assets: [
      { name: 'latest-mac.yml' },
      { name: 'tech-cc-hub-0.1.5-arm64.zip' },
      { name: 'tech-cc-hub-0.1.5-x64.zip' },
    ],
  }, 'darwin', 'arm64');

  assert.equal(fallback.metadataFile, 'latest-mac.yml');
  assert.equal(fallback.hasCompatibleUpdateMetadata, true);
  assert.equal(fallback.hasCompatibleInstallerAsset, true);
  assert.deepEqual(fallback.missingUpdateAssets, []);
});

test('selects the newest complete release above the current version', () => {
  const release = selectBestReleaseForUpdate([
    {
      tag_name: 'v0.1.14',
      name: '0.1.14',
      assets: [{ name: 'latest.yml' }, { name: 'helper.exe' }],
    },
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
  assert.equal(release?.hasCompatibleInstallerAsset, true);
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

test('uses a full download plan when the newest release skips releases', () => {
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

test('skips incomplete releases when a newer pipeline upload is missing updater assets', () => {
  const plan = createReleaseUpdatePlan([
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
  ], '0.1.11', 'win32', 'x64', 'lst016', 'tech-cc-hub');

  assert.equal(plan.selectedRelease?.tagName, 'v0.1.12');
  assert.equal(plan.selectedRelease?.hasCompatibleUpdateMetadata, true);
  assert.equal(plan.selectedRelease?.hasCompatibleInstallerAsset, true);
  assert.equal(plan.previousBlockmapBaseUrl, undefined);
});

test('skips prerelease and draft releases for stable auto updates', () => {
  const release = selectBestReleaseForUpdate([
    {
      tag_name: 'v0.1.14',
      name: '0.1.14',
      prerelease: true,
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.14.exe' }],
    },
    {
      tag_name: 'v0.1.13',
      name: '0.1.13',
      draft: true,
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.13.exe' }],
    },
    {
      tag_name: 'v0.1.12',
      name: '0.1.12',
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.12.exe' }],
    },
  ], '0.1.11', 'win32', 'x64');

  assert.equal(release?.tagName, 'v0.1.12');
});

test('can exclude a failed release and retry the next complete release', () => {
  const plan = createReleaseUpdatePlan([
    {
      tag_name: 'v0.1.13',
      name: '0.1.13',
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.13.exe' }],
    },
    {
      tag_name: 'v0.1.12',
      name: '0.1.12',
      assets: [{ name: 'latest.yml' }, { name: 'tech-cc-hub-Setup-0.1.12.exe' }],
    },
  ], '0.1.11', 'win32', 'x64', 'lst016', 'tech-cc-hub', { excludeTags: ['v0.1.13'] });

  assert.equal(plan.selectedRelease?.tagName, 'v0.1.12');
});

test('auto-updater fallback prepares the next release without nesting another checkForUpdates call', () => {
  const source = readFileSync('src/electron/libs/auto-updater/auto-updater.ts', 'utf8');
  const fallbackStart = source.indexOf('private async checkReleaseFallback');
  const downloadStart = source.indexOf('async downloadUpdate', fallbackStart);
  assert.notEqual(fallbackStart, -1);
  assert.notEqual(downloadStart, -1);
  const fallbackSource = source.slice(fallbackStart, downloadStart);

  assert.doesNotMatch(fallbackSource, /autoUpdater\.checkForUpdates\(/);
  assert.match(fallbackSource, /prepared \$\{fallback\.tagName\} for the next update check/);
  assert.match(fallbackSource, /skippedUpdateReleaseTags\.add\(failedTag\)/);
  assert.match(source, /getPlatformUpdateChannel\(process\.platform, process\.arch\)/);
});
