import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("renderer CSP allows pasted image previews via data URLs", async () => {
  const indexHtmlUrl = new URL("../../index.html", import.meta.url);
  const indexHtml = await readFile(indexHtmlUrl, "utf8");

  assert.match(indexHtml, /img-src\s+'self'\s+data:\s+blob:/);
});

