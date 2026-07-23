import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_INTERNAL_BOOTSTRAP_FEED_URL,
  DEFAULT_INTERNAL_UPDATE_FEED_URL,
  discoverInternalVersionFeeds,
  getInternalUpdateMetadataUrl,
  getUpdateSourceOrder,
  isVersionedInternalUpdateUrl,
  resolveAppUpdateSourcePolicy,
} from "../../src/electron/libs/auto-updater/auto-updater-sources.js";

test("defaults to the intranet feed with GitHub fallback", () => {
  const policy = resolveAppUpdateSourcePolicy({});

  assert.equal(policy.mode, "internal-first");
  assert.equal(policy.internalFeedUrl, DEFAULT_INTERNAL_UPDATE_FEED_URL);
  assert.equal(policy.internalBootstrapFeedUrl, DEFAULT_INTERNAL_BOOTSTRAP_FEED_URL);
  assert.deepEqual(getUpdateSourceOrder(policy.mode), ["internal", "github"]);
});

test("supports completing the migration with internal-only mode", () => {
  const policy = resolveAppUpdateSourcePolicy({
    TECH_CC_HUB_UPDATE_MODE: "internal-only",
    TECH_CC_HUB_INTERNAL_UPDATE_URL: "http://updates.internal/tech-cc-hub",
  });

  assert.equal(policy.mode, "internal-only");
  assert.equal(policy.internalFeedUrl, "http://updates.internal/tech-cc-hub/");
  assert.equal(policy.internalBootstrapFeedUrl, undefined);
  assert.deepEqual(getUpdateSourceOrder(policy.mode), ["internal"]);
});

test("supports an emergency GitHub-only mode and the legacy priority variable", () => {
  assert.equal(
    resolveAppUpdateSourcePolicy({ TECH_CC_HUB_UPDATE_MODE: "github-only" }).mode,
    "github-only",
  );
  assert.equal(
    resolveAppUpdateSourcePolicy({ TECH_CC_HUB_UPDATE_SOURCE_PRIORITY: "intranet" }).mode,
    "internal-only",
  );
});

test("uses platform-specific metadata names for the internal generic feed", () => {
  const feedUrl = "http://172.18.56.18/tech-cc-hub/release/v0.1.62/";

  assert.equal(
    getInternalUpdateMetadataUrl(feedUrl, "win32", "x64"),
    `${feedUrl}latest.yml`,
  );
  assert.equal(
    getInternalUpdateMetadataUrl(feedUrl, "darwin", "arm64"),
    `${feedUrl}latest-mac.yml`,
  );
  assert.equal(
    getInternalUpdateMetadataUrl(feedUrl, "darwin", "x64"),
    `${feedUrl}latest-x64-mac.yml`,
  );
});

test("discovers version folders from an nginx autoindex and selects newest first", () => {
  const listingUrl = "http://172.18.56.18/tech-cc-hub/release/";
  const listingHtml = `
    <a href="../">../</a>
    <a href="v0.1.60/">v0.1.60/</a>
    <a href="v0.1.62/">v0.1.62/</a>
    <a href="notes/">notes/</a>
    <a href="https://example.com/v9.9.9/">external</a>
  `;

  assert.deepEqual(discoverInternalVersionFeeds(listingUrl, listingHtml), [
    { version: "0.1.62", feedUrl: `${listingUrl}v0.1.62/` },
    { version: "0.1.60", feedUrl: `${listingUrl}v0.1.60/` },
  ]);
});

test("recognizes exact version feeds while keeping the release root discoverable", () => {
  assert.equal(
    isVersionedInternalUpdateUrl("http://172.18.56.18/tech-cc-hub/release/v0.1.62/"),
    true,
  );
  assert.equal(isVersionedInternalUpdateUrl(DEFAULT_INTERNAL_UPDATE_FEED_URL), false);
});

test("falls back to safe defaults for malformed source configuration", () => {
  const policy = resolveAppUpdateSourcePolicy({
    TECH_CC_HUB_UPDATE_MODE: "unexpected",
    TECH_CC_HUB_INTERNAL_UPDATE_URL: "file:///tmp/update",
    TECH_CC_HUB_INTERNAL_UPDATE_PROBE_TIMEOUT_MS: "999999",
  });

  assert.equal(policy.mode, "internal-first");
  assert.equal(policy.internalFeedUrl, DEFAULT_INTERNAL_UPDATE_FEED_URL);
  assert.equal(policy.internalProbeTimeoutMs, 15_000);
});
