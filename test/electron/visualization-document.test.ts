import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_TECHCC_VISUALIZATION_HEIGHT,
  MAX_TECHCC_VISUALIZATION_PROMPT_LENGTH,
  MAX_TECHCC_VISUALIZATION_TITLE_LENGTH,
  MIN_TECHCC_VISUALIZATION_HEIGHT,
  TECHCC_VISUALIZATION_CHANNEL,
  buildTechccVisualizationDocument,
  clampTechccVisualizationHeight,
  parseTechccVisualizationMessage,
} from "../../src/shared/techcc-visualization-protocol.js";

test("buildTechccVisualizationDocument creates a sandbox document with a strict CSP and theme shell", () => {
  const document = buildTechccVisualizationDocument({
    fragment: '<button id="choice">Select</button>',
    title: 'Revenue <Q1> & "Q2"',
    nonce: "nonce-1234567890",
    metadata: { sessionId: "session-1", fileName: "view.html", sha256: "abc" },
  });

  assert.match(document, /^<!doctype html>/i);
  assert.match(document, /Content-Security-Policy/);
  assert.match(document, /default-src 'none'/);
  assert.match(document, /connect-src 'none'/);
  assert.match(document, /--techcc-viz-background/);
  assert.match(document, /\.techcc-viz-shell/);
  assert.match(document, /<button id="choice">Select<\/button>/);
  assert.match(document, /Revenue &lt;Q1&gt; &amp; &quot;Q2&quot;/);
});

test("buildTechccVisualizationDocument exposes only the narrow techcc follow-up bridge", () => {
  const document = buildTechccVisualizationDocument({
    fragment: "<div>Safe</div>",
    title: "Safe",
    nonce: "nonce-1234567890",
    metadata: { sessionId: "session-1", fileName: "view.html", sha256: "abc" },
  });

  assert.match(document, /Object\.defineProperty\(window, "techcc"/);
  assert.match(document, /sendFollowUpMessage/);
  assert.match(document, /parent\.postMessage/);
  assert.match(document, new RegExp(TECHCC_VISUALIZATION_CHANNEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(document, /window\.electron|ipcRenderer|require\s*\(/);
});

test("bridge and error guards are installed before any generated fragment script executes", () => {
  const fragmentMarker = "window.__techccFragmentStarted = true";
  const document = buildTechccVisualizationDocument({
    fragment: `<script>${fragmentMarker}</script>`,
    title: "Bootstrap order",
    nonce: "nonce-1234567890",
    metadata: { sessionId: "session-1", fileName: "view.html", sha256: "abc" },
  });

  const bridgeIndex = document.indexOf('Object.defineProperty(window, "techcc"');
  const errorGuardIndex = document.indexOf('window.addEventListener("error"');
  const fragmentIndex = document.indexOf(fragmentMarker);
  assert.ok(bridgeIndex >= 0 && bridgeIndex < fragmentIndex);
  assert.ok(errorGuardIndex >= 0 && errorGuardIndex < fragmentIndex);
});

test("parseTechccVisualizationMessage accepts a bounded follow-up from the matching document", () => {
  const parsed = parseTechccVisualizationMessage({
    channel: TECHCC_VISUALIZATION_CHANNEL,
    type: "follow-up",
    nonce: "nonce-123",
    prompt: "Explain the selected row",
    title: "Inspect selection",
  }, "nonce-123");

  assert.deepEqual(parsed, {
    type: "follow-up",
    prompt: "Explain the selected row",
    title: "Inspect selection",
  });
});

test("parseTechccVisualizationMessage rejects spoofed channel, nonce, and message types", () => {
  const base = {
    channel: TECHCC_VISUALIZATION_CHANNEL,
    type: "ready",
    nonce: "nonce-123",
  };

  assert.equal(parseTechccVisualizationMessage({ ...base, channel: "other" }, "nonce-123"), null);
  assert.equal(parseTechccVisualizationMessage({ ...base, nonce: "wrong" }, "nonce-123"), null);
  assert.equal(parseTechccVisualizationMessage({ ...base, type: "unknown" }, "nonce-123"), null);
});

test("parseTechccVisualizationMessage enforces prompt and title length limits", () => {
  const message = {
    channel: TECHCC_VISUALIZATION_CHANNEL,
    type: "follow-up",
    nonce: "nonce-123",
  };

  assert.equal(parseTechccVisualizationMessage({ ...message, prompt: "   " }, "nonce-123"), null);
  assert.equal(parseTechccVisualizationMessage({
    ...message,
    prompt: "x".repeat(MAX_TECHCC_VISUALIZATION_PROMPT_LENGTH + 1),
  }, "nonce-123"), null);
  assert.equal(parseTechccVisualizationMessage({
    ...message,
    prompt: "valid",
    title: "x".repeat(MAX_TECHCC_VISUALIZATION_TITLE_LENGTH + 1),
  }, "nonce-123"), null);
});

test("parseTechccVisualizationMessage clamps resize messages to the supported card range", () => {
  assert.deepEqual(parseTechccVisualizationMessage({
    channel: TECHCC_VISUALIZATION_CHANNEL,
    type: "resize",
    nonce: "nonce-123",
    height: MAX_TECHCC_VISUALIZATION_HEIGHT * 4,
  }, "nonce-123"), {
    type: "resize",
    height: MAX_TECHCC_VISUALIZATION_HEIGHT,
  });

  assert.equal(clampTechccVisualizationHeight(-100), MIN_TECHCC_VISUALIZATION_HEIGHT);
  assert.equal(clampTechccVisualizationHeight(Number.NaN), MIN_TECHCC_VISUALIZATION_HEIGHT);
});
