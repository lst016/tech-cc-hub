import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("side conversation background session contract", () => {
  it("echoes activation and request id from create and start status events", () => {
    const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");
    const createBranch = source.slice(
      source.indexOf('if (event.type === "session.create")'),
      source.indexOf('if (event.type === "session.start")'),
    );
    const startBranch = source.slice(
      source.indexOf('if (event.type === "session.start")'),
      source.indexOf('if (event.type === "session.continue")'),
    );

    for (const branch of [createBranch, startBranch]) {
      assert.match(branch, /activation: event\.payload\.activation/);
      assert.match(branch, /clientRequestId: event\.payload\.clientRequestId/);
    }
  });

  it("does not activate a newly observed background session and stores its error", () => {
    const source = readFileSync("src/ui/store/useAppStore.ts", "utf8");

    assert.match(source, /const shouldActivateNewSession = event\.payload\.activation !== "background"/);
    assert.match(source, /if \(state\.pendingStart && shouldActivateNewSession\)/);
    assert.match(source, /if \(isNewSession && shouldActivateNewSession\)/);
    assert.match(source, /error: event\.payload\.error/);
  });

  it("declares the background activation contract in renderer and main-process event types", () => {
    for (const path of ["src/electron/types.ts", "src/ui/types.ts"]) {
      const source = readFileSync(path, "utf8");
      assert.match(source, /export type SessionActivation = "foreground" \| "background"/);
      assert.match(source, /activation\?: SessionActivation/);
      assert.match(source, /clientRequestId\?: string/);
    }
  });
});
