import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("browser workbench remembers the latest full URL for each origin", () => {
  const source = readFileSync(join(process.cwd(), "src/ui/components/BrowserWorkbenchPage.tsx"), "utf8");

  assert.match(source, /const targetUrl = url\.href/);
  assert.doesNotMatch(source, /const targetUrl = `\$\{url\.origin\}\/`/);
  assert.match(source, /function getBrowserTargetOrigin/);
  assert.match(source, /seenOrigins\.has\(origin\)/);
  assert.match(source, /getBrowserTargetOrigin\(url\) !== targetOrigin/);
  assert.match(source, /rememberLocalTarget\(event\.payload\.url\)/);
  assert.match(source, /<div className="mt-1 truncate text-\[17px\] text-muted">\{target\.url\}<\/div>/);
});
