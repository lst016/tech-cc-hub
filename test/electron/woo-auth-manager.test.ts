import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_WOO_AUTH_CONFIG,
  resolveWooAuthConfig,
  WooAuthManager,
} from "../../src/electron/libs/woo/woo-auth-manager.js";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ code: 0, message: "success", data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("Woo auth uses the packaged public client config on a fresh install", () => {
  assert.deepEqual(resolveWooAuthConfig({}), DEFAULT_WOO_AUTH_CONFIG);
  assert.deepEqual(resolveWooAuthConfig({ env: {} }), DEFAULT_WOO_AUTH_CONFIG);
});

test("Woo auth keeps controlled runtime config as an all-or-nothing override", () => {
  assert.deepEqual(resolveWooAuthConfig({
    env: {
      WOO_BASE_URL: "https://account.example.com/",
      WOO_CLIENT_ID: "custom-project",
    },
  }), {
    baseUrl: "https://account.example.com",
    projectId: "custom-project",
  });

  assert.throws(
    () => resolveWooAuthConfig({ env: { WOO_BASE_URL: "https://account.example.com" } }),
    /WOO_BASE_URL.*WOO_CLIENT_ID/,
  );
});

test("Woo third-party login opens the hosted login page and persists the polled session", async () => {
  const userDataPath = mkdtempSync(join(tmpdir(), "tech-cc-hub-woo-auth-"));
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const openedUrls: string[] = [];
  let pollCount = 0;

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.endsWith("/api/v1/auth/challenge/generate")) {
      return jsonResponse({ challengeCode: "challenge-code", challengeSecret: "challenge-secret" });
    }
    if (url.includes("/api/v1/auth/challenge/poll")) {
      pollCount += 1;
      if (pollCount === 1) return jsonResponse({ status: "pending", tokenInfo: null });
      return jsonResponse({
        status: "success",
        tokenInfo: {
          universalUserId: "woo-user-id",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          tokenType: "Bearer",
        },
        authChallenges: [],
      });
    }
    if (url.endsWith("/api/v1/account/current")) {
      return jsonResponse({
        universalUserId: "woo-user-id",
        realName: "Woo Test User",
        userEmail: "woo@example.com",
      });
    }
    return new Response(JSON.stringify({ code: 404, message: "not found" }), { status: 404 });
  };

  try {
    const manager = new WooAuthManager(userDataPath, () => ({
      baseUrl: "https://account.example.com",
      projectId: "project-id",
    }));
    const state = await manager.loginWithThirdParty(async (url) => {
      openedUrls.push(url);
    }, { pollIntervalMs: 0, timeoutMs: 1000 });

    assert.equal(state.status, "authenticated");
    assert.equal(state.user?.realName, "Woo Test User");
    assert.equal(openedUrls.length, 1);
    const loginUrl = new URL(openedUrls[0]);
    assert.equal(loginUrl.origin, "https://account.example.com");
    assert.equal(loginUrl.pathname, "/login");
    assert.equal(loginUrl.searchParams.get("popup"), "true");
    assert.equal(loginUrl.searchParams.get("challengeCode"), "challenge-code");
    assert.equal(loginUrl.searchParams.has("challengeSecret"), false);
    assert.equal(pollCount, 2);
    assert.ok(requestedUrls.some((url) => url.includes("challengeSecret=challenge-secret")));
    assert.ok(requestedUrls.some((url) => url.endsWith("/api/v1/account/current")));
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(userDataPath, { recursive: true, force: true });
  }
});
