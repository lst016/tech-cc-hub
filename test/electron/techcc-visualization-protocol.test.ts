import assert from "node:assert/strict";
import test from "node:test";

import {
  TECHCC_VISUALIZATION_SCHEME,
  buildTechccVisualizationDocument,
  buildTechccVisualizationUrl,
  parseTechccVisualizationUrl,
} from "../../src/shared/techcc-visualization-protocol.js";

test("techcc visualization URLs expose only an opaque one-time launch token", () => {
  const url = buildTechccVisualizationUrl({
    token: "launch_1234567890_abcdef",
  });

  assert.equal(TECHCC_VISUALIZATION_SCHEME, "techcc-visualize");
  assert.match(url, /^techcc-visualize:\/\/artifact\//);
  assert.deepEqual(parseTechccVisualizationUrl(url), {
    token: "launch_1234567890_abcdef",
  });
  assert.doesNotMatch(url, /Session-42|\.html|nonce=/);
});

test("URL parser rejects wrong schemes, extra paths, queries, and weak launch tokens", () => {
  const invalid = [
    "https://artifact/launch_1234567890_abcdef",
    "techcc-visualize://other/launch_1234567890_abcdef",
    "techcc-visualize://artifact/launch_1234567890_abcdef/extra",
    "techcc-visualize://artifact/..%2Fescape",
    "techcc-visualize://artifact/short",
    "techcc-visualize://artifact/launch_1234567890_abcdef?session=session-42",
  ];

  for (const url of invalid) assert.equal(parseTechccVisualizationUrl(url), null, url);
});

test("document shell exposes only the narrow techcc bridge and hardened CSP", () => {
  const document = buildTechccVisualizationDocument({
    fragment: '<section class="techcc-viz-card"><button id="next">继续</button></section>',
    nonce: "nonce_1234567890",
    title: "销售趋势",
    metadata: { sessionId: "session-42", fileName: "chart.html", sha256: "abc123" },
  });

  assert.match(document, /Content-Security-Policy/);
  assert.match(document, /default-src 'none'/);
  assert.match(document, /Object\.defineProperty\(window, "techcc"/);
  assert.match(document, /sendFollowUpMessage/);
  assert.match(document, /Object\.defineProperty\(window, "techccVisualization"/);
  assert.match(document, /navigator\.userActivation/);
  assert.match(document, /ResizeObserver/);
  assert.match(document, /--techcc-viz-background/);
  assert.match(document, /\.techcc-viz-card/);
  assert.doesNotMatch(document, /window\.electron|window\.openai|codex-inline-vis/);
});
