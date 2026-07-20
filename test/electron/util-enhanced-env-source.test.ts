import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("core enhanced env delegates PATH construction to external CLI env helper", () => {
  const source = readFileSync("src/electron/libs/util.ts", "utf8");

  assert.match(source, /import \{ buildExternalCliEnv \} from "\.\/external-cli\.js";/);
  assert.match(source, /return buildExternalCliEnv\(\{\s*\.\.\.process\.env,/s);
});
