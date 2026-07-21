import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

const TEST_WOO_CONFIG = {
  baseUrl: "https://account.example.com",
  projectId: "project-id",
};

const STORED_SESSION_PATH = "woo-auth-session.bin";

async function seedStoredSession(userDataPath: string): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/api/v1/auth/login/password")) {
      return jsonResponse({
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
    const manager = new WooAuthManager(userDataPath, () => TEST_WOO_CONFIG);
    await manager.loginWithPassword({ userName: "woo-user", password: "secret" });
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("Woo startup registers auth IPC before loading the renderer and waits for restore", () => {
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const registerIndex = mainSource.indexOf("registerWooAuthIpcHandlers();");
  const loadRendererIndex = mainSource.indexOf("await loadRenderer(mainWindow);");

  assert.ok(registerIndex >= 0);
  assert.ok(loadRendererIndex > registerIndex);
  assert.match(mainSource, /woo-auth:get-state[\s\S]*getRestoredState\(\)/);
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

test("Woo state reads wait for the in-flight startup restore", async () => {
  const userDataPath = mkdtempSync(join(tmpdir(), "tech-cc-hub-woo-auth-"));
  const originalFetch = globalThis.fetch;
  await seedStoredSession(userDataPath);

  let releaseCurrentUser: (() => void) | undefined;
  let currentUserRequests = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (!url.endsWith("/api/v1/account/current")) {
      return new Response(JSON.stringify({ code: 404, message: "not found" }), { status: 404 });
    }
    currentUserRequests += 1;
    await new Promise<void>((resolve) => {
      releaseCurrentUser = resolve;
    });
    return jsonResponse({
      universalUserId: "woo-user-id",
      realName: "Restored Woo User",
    });
  };

  try {
    const manager = new WooAuthManager(userDataPath, () => TEST_WOO_CONFIG);
    const startupRestore = manager.restore();
    const stateRead = manager.getRestoredState();

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(currentUserRequests, 1);
    releaseCurrentUser?.();

    const [restored, readState] = await Promise.all([startupRestore, stateRead]);
    assert.equal(restored.status, "authenticated");
    assert.equal(readState.status, "authenticated");
    assert.equal(readState.user?.realName, "Restored Woo User");
    assert.equal(currentUserRequests, 1);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("Woo restore refreshes an expired access token and persists the replacement tokens", async () => {
  const userDataPath = mkdtempSync(join(tmpdir(), "tech-cc-hub-woo-auth-"));
  const originalFetch = globalThis.fetch;
  await seedStoredSession(userDataPath);

  let currentUserRequests = 0;
  let refreshRequests = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get("authorization");
    if (url.endsWith("/api/v1/auth/token/refresh")) {
      refreshRequests += 1;
      assert.equal(init?.method, "POST");
      assert.equal(authorization, "Bearer refresh-token");
      return jsonResponse({
        universalUserId: "woo-user-id",
        accessToken: "refreshed-access-token",
        refreshToken: "refreshed-refresh-token",
        tokenType: "Bearer",
      });
    }
    if (url.endsWith("/api/v1/account/current")) {
      currentUserRequests += 1;
      if (authorization === "Bearer access-token") {
        return new Response(JSON.stringify({ code: 10000, message: "access token expired" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      assert.equal(authorization, "Bearer refreshed-access-token");
      return jsonResponse({
        universalUserId: "woo-user-id",
        realName: "Refreshed Woo User",
      });
    }
    return new Response(JSON.stringify({ code: 404, message: "not found" }), { status: 404 });
  };

  try {
    const manager = new WooAuthManager(userDataPath, () => TEST_WOO_CONFIG);
    const restored = await manager.restore();
    assert.equal(restored.status, "authenticated");
    assert.equal(restored.user?.realName, "Refreshed Woo User");
    assert.equal(refreshRequests, 1);
    assert.equal(currentUserRequests, 2);

    globalThis.fetch = async (input, init) => {
      assert.ok(String(input).endsWith("/api/v1/account/current"));
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer refreshed-access-token");
      return jsonResponse({
        universalUserId: "woo-user-id",
        realName: "Persisted Refreshed Woo User",
      });
    };

    const nextLaunchManager = new WooAuthManager(userDataPath, () => TEST_WOO_CONFIG);
    const nextLaunchState = await nextLaunchManager.restore();
    assert.equal(nextLaunchState.status, "authenticated");
    assert.equal(nextLaunchState.user?.realName, "Persisted Refreshed Woo User");
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("Woo restore clears the encrypted session only after refresh credentials are rejected", async () => {
  const userDataPath = mkdtempSync(join(tmpdir(), "tech-cc-hub-woo-auth-"));
  const originalFetch = globalThis.fetch;
  await seedStoredSession(userDataPath);
  const storePath = join(userDataPath, STORED_SESSION_PATH);

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/api/v1/account/current")) {
      return new Response(JSON.stringify({ code: 10000, message: "access token expired" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.endsWith("/api/v1/auth/token/refresh")) {
      return new Response(JSON.stringify({ code: 10001, message: "refresh token invalid" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ code: 404, message: "not found" }), { status: 404 });
  };

  try {
    const manager = new WooAuthManager(userDataPath, () => TEST_WOO_CONFIG);
    const restored = await manager.restore();
    assert.equal(restored.status, "anonymous");
    assert.equal(restored.hasStoredSession, false);
    assert.match(restored.error ?? "", /登录已失效/);
    assert.equal(existsSync(storePath), false);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("Woo restore keeps the encrypted session after a transient network failure", async () => {
  const userDataPath = mkdtempSync(join(tmpdir(), "tech-cc-hub-woo-auth-"));
  const originalFetch = globalThis.fetch;
  await seedStoredSession(userDataPath);
  const storePath = join(userDataPath, STORED_SESSION_PATH);

  try {
    globalThis.fetch = async () => {
      throw new TypeError("network unavailable");
    };

    const manager = new WooAuthManager(userDataPath, () => TEST_WOO_CONFIG);
    const unavailableState = await manager.restore();
    assert.equal(unavailableState.status, "anonymous");
    assert.equal(unavailableState.hasStoredSession, true);
    assert.match(unavailableState.error ?? "", /暂时无法恢复/);
    assert.equal(existsSync(storePath), true);

    globalThis.fetch = async (input, init) => {
      assert.ok(String(input).endsWith("/api/v1/account/current"));
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer access-token");
      return jsonResponse({
        universalUserId: "woo-user-id",
        realName: "Recovered Woo User",
      });
    };

    const recoveredState = await manager.restore();
    assert.equal(recoveredState.status, "authenticated");
    assert.equal(recoveredState.user?.realName, "Recovered Woo User");
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(userDataPath, { recursive: true, force: true });
  }
});
