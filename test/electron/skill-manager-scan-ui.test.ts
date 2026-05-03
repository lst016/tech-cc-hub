import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("skill discovery scan stays lightweight for UI by not hashing every discovered skill directory", () => {
  const scannerSource = readFileSync("src/electron/libs/skill-manager/scanner.ts", "utf8");

  assert.doesNotMatch(scannerSource, /hashDirectory/);
  assert.match(scannerSource, /fingerprint:\s*null/);
});

test("recursive skill scan skips common heavyweight dependency and build folders", () => {
  const scannerSource = readFileSync("src/electron/libs/skill-manager/scanner.ts", "utf8");

  for (const skipped of ["node_modules", ".venv", "dist", "build", "target", "vendor"]) {
    assert.match(scannerSource, new RegExp(`"${skipped.replace(".", "\\.")}"`));
  }
});
