import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const cardPath = "src/ui/components/chat/VisualizationPreviewCard.tsx";
const framePath = "src/ui/components/chat/TechccVisualizationFrame.tsx";
const panePath = "src/ui/components/chat/VisualizationPreviewPane.tsx";
const documentPath = "src/shared/techcc-visualization-protocol.ts";

test("visualization result stays a compact preview card until the user opens it", () => {
  assert.equal(existsSync(cardPath), true);
  const source = readFileSync(cardPath, "utf8");

  assert.match(source, /网页预览/);
  assert.match(source, /网站/);
  assert.match(source, /打开/);
  assert.match(source, /OPEN_VISUALIZATION_PREVIEW_EVENT/);
  assert.match(source, /window\.dispatchEvent/);
  assert.doesNotMatch(source, /<iframe/);
  assert.doesNotMatch(source, /techcc-visualization-create-launch/);
});

test("right-side visualization pane uses a script-only sandboxed custom-scheme iframe", () => {
  assert.equal(existsSync(framePath), true);
  assert.equal(existsSync(panePath), true);
  const source = readFileSync(framePath, "utf8");

  assert.match(source, /<iframe/);
  assert.match(source, /sandbox="allow-scripts"/);
  assert.match(source, /referrerPolicy="no-referrer"/);
  assert.match(source, /src=\{launch\.url\}/);
  assert.match(source, /techcc-visualization-create-launch/);
  assert.match(source, /window\.electron\.invoke/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

test("right-side visualization pane authenticates messages before forwarding follow-up requests", () => {
  const source = readFileSync(framePath, "utf8");

  assert.match(source, /event\.source !== iframeRef\.current\?\.contentWindow/);
  assert.match(source, /parseTechccVisualizationMessage\(event\.data, launch\.nonce\)/);
  assert.match(source, /onFollowUp/);
  assert.match(source, /window\.addEventListener\("message"/);
  assert.match(source, /window\.removeEventListener\("message"/);
});

test("iframe follow-ups require an explicit host confirmation before submission", () => {
  const source = readFileSync(framePath, "utf8");

  assert.match(source, /setPendingFollowUp\(\(current\) => current \?\?/);
  assert.match(source, /交互视图请求继续对话/);
  assert.match(source, /pendingFollowUp\.title/);
  assert.match(source, /\{pendingFollowUp\.prompt\}/);
  assert.match(source, />取消</);
  assert.match(source, />发送到对话</);
  assert.match(source, /onClick=\{confirmFollowUp\}/);
  assert.doesNotMatch(source, /onFollowUp\(\{ prompt: message\.prompt, title: message\.title \}\)/);
});

test("host confirmation keeps the complete follow-up prompt reviewable", () => {
  const source = readFileSync(framePath, "utf8");

  assert.match(source, /max-h-\d+/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /whitespace-pre-wrap/);
  assert.doesNotMatch(source, /line-clamp/);
});

test("right-side visualization pane handles resize, loading, errors, and explicit reloads", () => {
  const source = readFileSync(framePath, "utf8");

  assert.match(source, /message\.type === "resize"/);
  assert.match(source, /setHeight\(message\.height\)/);
  assert.match(source, /reloadKey/);
  assert.match(source, /setReloadAttempt/);
  assert.match(source, /正在加载交互视图/);
  assert.match(source, /重新加载/);
  assert.match(source, /onError=/);
});

test("visualization card public surface stays techcc-only and never exposes the app bridge", () => {
  const componentSource = readFileSync(framePath, "utf8");
  const documentSource = readFileSync(documentPath, "utf8");
  const source = `${componentSource}\n${documentSource}`;

  assert.match(componentSource, /window\.electron\.invoke/);
  assert.doesNotMatch(documentSource, /window\.electron|ipcRenderer/);
  assert.doesNotMatch(source, /\b(?:codex|openai)\b/i);
  assert.match(source, /Object\.defineProperty\(window, "techcc"/);
});
