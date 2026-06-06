import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeKnownToolInputsInMessage,
  normalizeToolInputForKnownSchemas,
} from "../../src/electron/libs/tool-input-normalizer.js";

test("normalizes empty Read pages instead of letting the tool fail validation", () => {
  const result = normalizeToolInputForKnownSchemas("Read", {
    file_path: "D:/repo/src/page.tsx",
    pages: "",
    offset: 1,
  });

  assert.equal(result.mutated, true);
  assert.equal("pages" in result.input, false);
  assert.match(result.fixes.join("\n"), /Read\.pages/);
});

test("removes invalid Read pages emitted for source files", () => {
  const result = normalizeToolInputForKnownSchemas("Read", {
    file_path: "D:/repo/src/page.tsx",
    pages: "> ???",
    offset: 150,
    limit: 30,
  });

  assert.equal(result.mutated, true);
  assert.equal("pages" in result.input, false);
  assert.match(result.fixes.join("\n"), /non-PDF/);
});

test("keeps valid Read pages for PDF files only", () => {
  const result = normalizeToolInputForKnownSchemas("Read", {
    file_path: "D:/repo/spec.pdf",
    pages: " 1 - 3, 5 ",
  });

  assert.equal(result.input.pages, "1-3,5");
  assert.match(result.fixes.join("\n"), /Normalized Read\.pages/);
});

test("removes invalid Read page ranges for PDF files", () => {
  const result = normalizeToolInputForKnownSchemas("Read", {
    file_path: "D:/repo/spec.pdf",
    pages: "5-2",
  });

  assert.equal("pages" in result.input, false);
  assert.match(result.fixes.join("\n"), /invalid Read\.pages/);
});

test("normalizes tool_use inputs before messages are displayed or persisted", () => {
  const message = {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: "call_read",
          name: "Read",
          input: {
            file_path: "D:/repo/src/page.tsx",
            offset: 1,
            limit: 20,
            pages: "> ???",
          },
        },
      ],
    },
  };

  const normalized = normalizeKnownToolInputsInMessage(message);
  const toolUse = normalized.message.content[0];

  assert.equal("pages" in toolUse.input, false);
  assert.notEqual(normalized, message);
});

test("clamps Figma export inputs to the registered schema limits", () => {
  const result = normalizeToolInputForKnownSchemas("mcp__tech-cc-hub-figma__figma_export_node_images", {
    fileKeyOrUrl: "https://www.figma.com/design/file/key?node-id=1-2",
    maxBytes: 20_000_000,
    scale: 8,
  });

  assert.equal(result.input.maxBytes, 500_000);
  assert.equal(result.input.scale, 4);
  assert.match(result.fixes.join("\n"), /Figma maxBytes/);
  assert.match(result.fixes.join("\n"), /scale/);
});

test("clamps browser query result counts to avoid MCP validation errors", () => {
  const result = normalizeToolInputForKnownSchemas("mcp__tech-cc-hub-browser__browser_query_nodes", {
    query: ".el-button",
    maxResults: 200,
  });

  assert.equal(result.input.maxResults, 50);
});

test("removes empty browser console waitFor values", () => {
  const result = normalizeToolInputForKnownSchemas("mcp__tech-cc-hub-browser__browser_console_logs", {
    limit: 20,
    waitFor: "   ",
    waitMode: "contains",
  });

  assert.equal("waitFor" in result.input, false);
  assert.equal(result.input.waitMode, "contains");
});

test("normalizes browser fetch log filters", () => {
  const result = normalizeToolInputForKnownSchemas("mcp__tech-cc-hub-browser__browser_fetch_logs", {
    limit: 500,
    urlContains: "   ",
  });

  assert.equal(result.input.limit, 200);
  assert.equal("urlContains" in result.input, false);
});

test("normalizes browser session HTTP request inputs", () => {
  const result = normalizeToolInputForKnownSchemas("mcp__tech-cc-hub-browser__browser_http_request", {
    timeoutMs: 120000,
    contentType: "   ",
  });

  assert.equal(result.input.timeoutMs, 60000);
  assert.equal("contentType" in result.input, false);
});

test("drops invalid zero-sized compare regions and invalid ignore regions", () => {
  const result = normalizeToolInputForKnownSchemas("mcp__tech-cc-hub-design__design_compare_current_view", {
    referenceImagePath: "C:/tmp/reference.png",
    region: { x: 0, y: 0, width: 0, height: 0 },
    ignoreRegions: [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 2, y: 2, width: 0, height: 4 },
    ],
  });

  assert.equal("region" in result.input, false);
  assert.deepEqual(result.input.ignoreRegions, [{ x: 0, y: 0, width: 10, height: 10 }]);
});

test("prefers element target over region for current-view visual comparison", () => {
  const result = normalizeToolInputForKnownSchemas("mcp__tech-cc-hub-design__design_compare_current_view", {
    referenceImagePath: "C:/tmp/reference.png",
    target: ".user-detail-drawer",
    region: { x: 10, y: 10, width: 100, height: 80 },
  });

  assert.equal(result.input.target, ".user-detail-drawer");
  assert.equal("region" in result.input, false);
  assert.match(result.fixes.join("\n"), /target selector takes precedence/);
});
