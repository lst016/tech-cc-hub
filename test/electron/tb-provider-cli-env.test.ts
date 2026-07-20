import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("TB provider delegates CLI execution to the shared external CLI helper", () => {
  const source = readFileSync("src/electron/libs/task/providers/tb-provider.ts", "utf8");

  assert.match(source, /import \{ runExternalCli \} from "\.\.\/\.\.\/external-cli\.js";/);
  assert.match(source, /await runExternalCli\(command, args, \{/);
  assert.doesNotMatch(source, /promisify\(execFile\)|execFileAsync|from "child_process"|from "node:child_process"/);
});
