import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("packaged apps ignore an ambient development NODE_ENV", () => {
  const utilSource = readFileSync("src/electron/util.ts", "utf8");
  const mainSource = readFileSync("src/electron/main.ts", "utf8");

  assert.match(utilSource, /import \{[^}]*\bapp\b[^}]*\} from "electron"/);
  assert.match(
    utilSource,
    /return !app\.isPackaged && process\.env\.NODE_ENV === "development"/,
  );
  assert.match(
    mainSource,
    /if \(!isDev\(\)\) \{\s*await window\.loadFile\(getUIPath\(\)\)/,
  );
});
