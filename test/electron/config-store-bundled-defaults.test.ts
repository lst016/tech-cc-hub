import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import {
  loadGlobalRuntimeConfig,
  mergeGlobalRuntimeConfigDefaults,
} from "../../src/electron/libs/config-store.js";

test("global runtime defaults fill nested keys without overriding stored values", () => {
  const merged = mergeGlobalRuntimeConfigDefaults(
    {
      env: {
        WOO_BASE_URL: "https://woo.default.test",
        WOO_CLIENT_ID: "default-client",
        DEFAULT_ONLY: "yes",
      },
      featureFlags: {
        defaultFlag: true,
        storedFlag: false,
      },
    },
    {
      env: {
        WOO_CLIENT_ID: "stored-client",
        STORED_ONLY: "yes",
      },
      featureFlags: {
        storedFlag: true,
      },
    },
  );

  assert.deepEqual(merged, {
    env: {
      WOO_BASE_URL: "https://woo.default.test",
      WOO_CLIENT_ID: "stored-client",
      DEFAULT_ONLY: "yes",
      STORED_ONLY: "yes",
    },
    featureFlags: {
      defaultFlag: true,
      storedFlag: true,
    },
  });
});

test("loadGlobalRuntimeConfig uses bundled agent-runtime.json as userData defaults", () => {
  const previousUserData = app.getPath("userData");
  const originalGetAppPath = app.getAppPath.bind(app);
  const root = join(tmpdir(), `tech-cc-hub-runtime-defaults-${Date.now()}`);
  const appRoot = join(root, "app");
  const userDataRoot = join(root, "user-data");

  mkdirSync(appRoot, { recursive: true });
  mkdirSync(userDataRoot, { recursive: true });
  writeFileSync(join(appRoot, "agent-runtime.json"), JSON.stringify({
    env: {
      WOO_BASE_URL: "https://woo.default.test",
      WOO_CLIENT_ID: "default-client",
      BUNDLED_ONLY: "yes",
    },
  }), "utf8");
  writeFileSync(join(userDataRoot, "agent-runtime.json"), JSON.stringify({
    env: {
      WOO_CLIENT_ID: "stored-client",
      STORED_ONLY: "yes",
    },
  }), "utf8");

  try {
    app.setPath("userData", userDataRoot);
    Object.defineProperty(app, "getAppPath", {
      configurable: true,
      value: () => appRoot,
    });
    const loaded = loadGlobalRuntimeConfig();
    assert.deepEqual(loaded.env, {
      WOO_BASE_URL: "https://woo.default.test",
      WOO_CLIENT_ID: "stored-client",
      BUNDLED_ONLY: "yes",
      STORED_ONLY: "yes",
    });
  } finally {
    Object.defineProperty(app, "getAppPath", {
      configurable: true,
      value: originalGetAppPath,
    });
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

test("mac package includes the bundled runtime config file", () => {
  const builderConfig = JSON.parse(readFileSync("electron-builder.json", "utf8")) as {
    files?: unknown[];
  };
  assert.ok(builderConfig.files?.includes("agent-runtime.json"));
});
