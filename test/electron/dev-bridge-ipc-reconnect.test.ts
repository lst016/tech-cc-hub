import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("useIPC re-subscribes after the dev bridge replaces the fallback shim", () => {
  const source = readFileSync("src/ui/hooks/useIPC.ts", "utf8");

  assert.match(source, /import \{ DEV_BRIDGE_READY_EVENT \} from "\.\.\/dev-electron-shim"/);
  assert.match(source, /const subscribeToServerEvents = \(\) => \{/);
  assert.match(source, /unsubscribeRef\.current\?\.\(\);/);
  assert.match(source, /window\.addEventListener\(DEV_BRIDGE_READY_EVENT, subscribeToServerEvents\)/);
  assert.match(source, /window\.removeEventListener\(DEV_BRIDGE_READY_EVENT, subscribeToServerEvents\)/);
});