import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  buildChromeCookieDomainCandidates,
  stripChromeCookieHostHash,
} from "../../src/electron/libs/chrome-cookie-sync.js";

describe("chrome cookie sync helpers", () => {
  it("matches parent-domain cookies for a subdomain target", () => {
    assert.deepEqual(buildChromeCookieDomainCandidates("app.example.com"), [
      "app.example.com",
      ".app.example.com",
      ".example.com",
    ]);
  });

  it("keeps localhost matching scoped to the exact host", () => {
    assert.deepEqual(buildChromeCookieDomainCandidates("localhost"), ["localhost"]);
    assert.deepEqual(buildChromeCookieDomainCandidates("127.0.0.1"), ["127.0.0.1"]);
  });

  it("strips Chrome host-hash prefixes from decrypted cookie values", () => {
    const hostKey = ".example.com";
    const cookieValue = Buffer.from("logged-in-cookie-value", "utf-8");
    const valueWithHostHash = Buffer.concat([
      createHash("sha256").update(hostKey).digest(),
      cookieValue,
    ]);

    assert.equal(stripChromeCookieHostHash(valueWithHostHash, hostKey).toString("utf-8"), "logged-in-cookie-value");
    assert.equal(stripChromeCookieHostHash(valueWithHostHash, ".another-example.com"), valueWithHostHash);
  });
});
