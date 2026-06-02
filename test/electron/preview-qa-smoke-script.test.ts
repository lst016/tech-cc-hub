import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("preview qa smoke script supports resilient file selection and log filtering", () => {
  const source = readFileSync("scripts/qa/preview-workbench-smoke.cjs", "utf8");

  assert.match(source, /http:\/\/localhost:4173\//);
  assert.match(source, /PREVIEW_QA_CHROME_PATH/);
  assert.match(source, /resolveChromePath/);
  assert.match(source, /native-explorer__row--file/);
  assert.match(source, /package\.json/);
  assert.match(source, /let chosenFileName =/);
  assert.match(source, /isIgnorableConsoleError/);
  assert.match(source, /Content Security Policy/);
  assert.match(source, /Maximum update depth/);
  assert.match(source, /getSnapshot/);
});
