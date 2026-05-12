import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("renderer CSP allows pasted image previews via data URLs", async () => {
  const indexHtml = await readFile(join(process.cwd(), "index.html"), "utf8");

  assert.match(indexHtml, /img-src\s+'self'\s+data:\s+blob:/);
});
