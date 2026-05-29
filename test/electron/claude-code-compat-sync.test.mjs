import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPromptHints,
  extractCommandItems,
  extractSections,
  normalizeVersion,
  renderRegistry,
} from "../../scripts/claude-code-compat-sync-lib.mjs";

const SAMPLE_CHANGELOG_HTML = `
<h3 id="v21149">v2.1.149</h3>
<ul>
  <li><code>/usage</code> now shows a per-category breakdown of what's driving your limits usage — skills, subagents, plugins, and per-MCP-server cost</li>
  <li><code>/diff</code> detail view can now be scrolled with the keyboard</li>
  <li>Improved <code>/feedback</code> reports to include the conversation that happened before context compaction</li>
</ul>
<p>May 22, 2026</p>
<hr>
<p><strong>Synopsis:</strong> Pinned background sessions (<code>Ctrl+T</code> in <code>claude agents</code>) survive idle. Renamed <code>/simplify</code> to <code>/code-review</code>. Renamed <code>/extra-usage</code> to <code>/usage-credits</code>.</p>
<h3 id="v21147">v2.1.147</h3>
<ul>
  <li>Pinned background sessions (<code>Ctrl+T</code> in <code>claude agents</code>) now stay alive when idle</li>
  <li>Renamed <code>/simplify</code> to <code>/code-review</code>. The old cleanup-and-fix behavior has been removed</li>
  <li>Fixed <code>/help</code> rendering a broken tab header</li>
<li>Read more at https://code.claude.com/docs/en/agent-view</li>
</ul>
<p>May 21, 2026</p>
<h3 id="v21144">v2.1.144</h3>
<ul>
  <li>Renamed "extra usage" to "usage credits" across CLI copy; <code>/extra-usage</code> is now <code>/usage-credits</code> (old name still works)</li>
</ul>
<p>May 18, 2026</p>
`;

test("normalizeVersion maps old 0.2 style changelog references into Claude Code 2.1 equivalents", () => {
  assert.equal(normalizeVersion("v2.1.149"), "2.1.149");
  assert.equal(normalizeVersion("0.2.149"), "2.1.149");
  assert.equal(normalizeVersion(""), "");
});

test("extractSections returns ordered Claude Code version blocks with dates and list items", () => {
  const sections = extractSections(SAMPLE_CHANGELOG_HTML);

  assert.deepEqual(sections.map((section) => section.version), ["2.1.149", "2.1.147", "2.1.144"]);
  assert.equal(sections[0]?.date, "May 22, 2026");
  assert.equal(sections[1]?.date, "May 21, 2026");
  assert.ok(sections[0]?.items.some((item) => item.includes("/usage")));
  assert.ok(sections[1]?.items.some((item) => item.includes("/code-review")));
});

test("extractCommandItems keeps real Claude Code commands and filters doc-path false positives", () => {
  const items = extractSections(SAMPLE_CHANGELOG_HTML)[1]?.items ?? [];
  const commands = extractCommandItems(items).map((item) => item.name);

  assert.ok(commands.includes("agents"));
  assert.ok(commands.includes("code-review"));
  assert.ok(commands.includes("help"));
  assert.equal(commands.includes("docs"), false);
  assert.equal(commands.includes("en"), false);
  assert.equal(commands.includes("code"), false);
});

test("buildPromptHints adds current usage and review naming guidance when changelog items mention them", () => {
  const hints = buildPromptHints(extractSections(SAMPLE_CHANGELOG_HTML).flatMap((section) => section.items)).join("\n");

  assert.match(hints, /per-category breakdown/);
  assert.match(hints, /\/code-review/);
  assert.match(hints, /split/i);
  assert.match(hints, /chunk/i);
  assert.match(hints, /summar/i);
  assert.match(hints, /\/usage-credits/);
  assert.match(hints, /claude agents/);
});

test("renderRegistry emits an Electron-safe shared import path", () => {
  const source = renderRegistry({
    sourceUrl: "https://example.test/changelog",
    sourceVersion: "2.1.149",
    sourceDate: "May 22, 2026",
    generatedAt: "2026-05-28T00:00:00.000Z",
    commandItems: [],
    promptHints: [],
  });

  assert.match(source, /from "\.\.\/\.\.\/\.\.\/shared\/claude-agent-teams\.js"/);
  assert.match(source, /from "\.\.\/slash-command-discovery\.js"/);
});
