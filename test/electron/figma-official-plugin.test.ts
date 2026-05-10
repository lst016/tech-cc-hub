import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildFigmaDesktopMcpConfig,
  buildFigmaOfficialMcpConfig,
  buildFigmaOfficialPluginConfig,
  buildNextFigmaOfficialCodexAuthRuntimeConfig,
  buildNextFigmaOfficialDesktopRuntimeConfig,
  buildNextFigmaOfficialAuthStateRuntimeConfig,
  buildNextFigmaOfficialRuntimeConfig,
  getFigmaOfficialPluginStatusFromConfig,
  isFigmaMcpOAuthCallbackPrompt,
  parseFigmaCodexOAuthCredentialStore,
  redactFigmaMcpOAuthCallbackPrompt,
  shouldPreserveReadyFigmaOfficialConfigAfterCodexError,
} from "../../src/electron/libs/figma-official-plugin.js";

test("builds official Figma remote MCP config", () => {
  assert.deepEqual(buildFigmaOfficialMcpConfig(), {
    type: "http",
    url: "https://mcp.figma.com/mcp",
    enabled: true,
  });

  assert.deepEqual(buildFigmaOfficialMcpConfig("figma-token"), {
    type: "http",
    url: "https://mcp.figma.com/mcp",
    enabled: true,
    headers: {
      Authorization: "Bearer figma-token",
    },
  });
});

test("builds official Figma desktop MCP config", () => {
  assert.deepEqual(buildFigmaDesktopMcpConfig(), {
    type: "http",
    url: "http://127.0.0.1:3845/mcp",
    enabled: true,
  });
});

test("preserves unrelated runtime config when adding Figma", () => {
  const next = buildNextFigmaOfficialRuntimeConfig({
    plugins: { "open-computer-use": { id: "open-computer-use" } },
    mcpServers: { "open-computer-use": { type: "stdio", command: "open-computer-use" } },
    other: true,
  }, 1000);

  assert.equal((next.plugins as Record<string, unknown>)["open-computer-use"] != null, true);
  assert.equal((next.mcpServers as Record<string, unknown>)["open-computer-use"] != null, true);
  assert.equal(next.other, true);
  assert.deepEqual((next.mcpServers as Record<string, unknown>).figma, buildFigmaOfficialMcpConfig());
});

test("detects missing, configured, and misconfigured Figma plugin status", () => {
  assert.equal(getFigmaOfficialPluginStatusFromConfig({}).status, "not-configured");

  const configured = {
    plugins: { "figma-official": buildFigmaOfficialPluginConfig(1000) },
    mcpServers: { figma: buildFigmaOfficialMcpConfig() },
  };
  assert.equal(getFigmaOfficialPluginStatusFromConfig(configured).status, "configured");

  const misconfigured = {
    plugins: { "figma-official": buildFigmaOfficialPluginConfig(1000) },
    mcpServers: { figma: { type: "stdio", command: "figma" } },
  };
  assert.equal(getFigmaOfficialPluginStatusFromConfig(misconfigured).status, "misconfigured");
});

test("can switch Figma plugin to desktop MCP mode", () => {
  const next = buildNextFigmaOfficialDesktopRuntimeConfig({
    plugins: { "open-computer-use": { id: "open-computer-use" } },
    mcpServers: { "open-computer-use": { type: "stdio", command: "open-computer-use" } },
  }, {
    available: true,
    now: 3000,
  });

  const figmaPlugin = (next.plugins as Record<string, Record<string, unknown>>)["figma-official"];
  assert.equal(figmaPlugin.mode, "desktop");
  assert.equal(figmaPlugin.connected, true);
  assert.equal(figmaPlugin.authStatus, "ready");
  assert.deepEqual((next.mcpServers as Record<string, unknown>).figma, buildFigmaDesktopMcpConfig());

  const status = getFigmaOfficialPluginStatusFromConfig(next);
  assert.equal(status.mode, "desktop");
  assert.equal(status.status, "ready");
  assert.equal(status.connected, true);
});

test("marks desktop MCP unavailable when the local server is not detected", () => {
  const next = buildNextFigmaOfficialDesktopRuntimeConfig({}, {
    available: false,
    error: "connection refused",
    now: 3000,
  });

  const status = getFigmaOfficialPluginStatusFromConfig(next);
  assert.equal(status.mode, "desktop");
  assert.equal(status.status, "desktop-unavailable");
  assert.equal(status.connected, false);
  assert.match(status.authHint ?? "", /Figma 桌面版/);
});

test("detects Figma auth expiry hints without marking config broken", () => {
  const status = getFigmaOfficialPluginStatusFromConfig({
    plugins: {
      "figma-official": {
        ...buildFigmaOfficialPluginConfig(1000),
        authStatus: "auth-expired",
        lastAuthError: "401 unauthorized token expired",
      },
    },
    mcpServers: { figma: buildFigmaOfficialMcpConfig() },
  });

  assert.equal(status.status, "auth-expired");
  assert.match(status.authHint ?? "", /重新授权/);
});

test("updates Figma auth state without dropping MCP config", () => {
  const next = buildNextFigmaOfficialAuthStateRuntimeConfig({
    plugins: { "open-computer-use": { id: "open-computer-use" } },
    mcpServers: { "open-computer-use": { type: "stdio", command: "open-computer-use" } },
  }, "ready", {
    now: 2000,
    oauth: {
      access_token: "figma-access-token",
      token_type: "Bearer",
      expires_in: 3600,
      expiresAt: Date.now() + 3600_000,
    },
  });

  const figmaPlugin = (next.plugins as Record<string, Record<string, unknown>>)["figma-official"];
  assert.equal(figmaPlugin.connected, true);
  assert.equal(figmaPlugin.authStatus, "ready");
  assert.deepEqual((next.mcpServers as Record<string, unknown>).figma, buildFigmaOfficialMcpConfig("figma-access-token"));
  assert.equal((next.mcpServers as Record<string, unknown>)["open-computer-use"] != null, true);
});

test("parses Codex file-store Figma OAuth credentials", () => {
  const oauth = parseFigmaCodexOAuthCredentialStore({
    "figma|hash": {
      server_name: "figma",
      server_url: "https://mcp.figma.com/mcp",
      client_id: "codex-client",
      access_token: "figma-access-token",
      refresh_token: "figma-refresh-token",
      expires_at: 2000,
      scopes: ["mcp:connect"],
    },
  });

  assert.deepEqual(oauth, {
    access_token: "figma-access-token",
    token_type: "Bearer",
    refresh_token: "figma-refresh-token",
    scope: "mcp:connect",
    expiresAt: 2000,
    provider: "codex",
    client_id: "codex-client",
  });
});

test("writes Codex OAuth credentials into the Figma remote MCP config", () => {
  const next = buildNextFigmaOfficialCodexAuthRuntimeConfig({}, {
    access_token: "figma-access-token",
    token_type: "Bearer",
    expiresAt: Date.now() + 3600_000,
    provider: "codex",
  }, 2000, ["get_design_context", "get_screenshot", "whoami"]);

  const figmaPlugin = (next.plugins as Record<string, Record<string, unknown>>)["figma-official"];
  assert.equal(figmaPlugin.connected, true);
  assert.equal(figmaPlugin.authStatus, "ready");
  assert.equal(figmaPlugin.authProvider, "codex");
  assert.equal(figmaPlugin.toolCount, 3);
  assert.equal(figmaPlugin.lastToolCheckedAt, 2000);
  assert.deepEqual(figmaPlugin.tools, ["get_design_context", "get_screenshot", "whoami"]);
  assert.deepEqual(figmaPlugin.source, {
    type: "codex-supported-client-oauth",
    url: "https://mcp.figma.com/mcp",
  });
  assert.deepEqual((next.mcpServers as Record<string, unknown>).figma, buildFigmaOfficialMcpConfig("figma-access-token"));

  const status = getFigmaOfficialPluginStatusFromConfig(next);
  assert.equal(status.toolCount, 3);
  assert.deepEqual(status.tools, ["get_design_context", "get_screenshot", "whoami"]);
});

test("preserves ready Figma Codex auth config on transient connect errors", () => {
  const ready = buildNextFigmaOfficialCodexAuthRuntimeConfig({}, {
    access_token: "figma-access-token",
    token_type: "Bearer",
    expiresAt: Date.now() + 3600_000,
    provider: "codex",
  }, 2000, ["get_design_context"]);

  assert.equal(shouldPreserveReadyFigmaOfficialConfigAfterCodexError(ready, "fetch failed"), true);
  assert.equal(shouldPreserveReadyFigmaOfficialConfigAfterCodexError(ready, "Codex Figma OAuth timed out"), true);
  assert.equal(shouldPreserveReadyFigmaOfficialConfigAfterCodexError(ready, "401 unauthorized token expired"), false);
});

test("marks Figma auth expired when the stored token is past its expiry", () => {
  const status = getFigmaOfficialPluginStatusFromConfig({
    plugins: {
      "figma-official": {
        ...buildFigmaOfficialPluginConfig(1000),
        connected: true,
        authStatus: "ready",
        oauth: {
          access_token: "expired-token",
          expiresAt: Date.now() - 1000,
        },
      },
    },
    mcpServers: { figma: buildFigmaOfficialMcpConfig("expired-token") },
  });

  assert.equal(status.status, "auth-expired");
  assert.equal(status.connected, false);
  assert.match(status.authHint ?? "", /重新授权/);
});

test("detects and redacts Figma MCP OAuth callback prompts", () => {
  const callback = "http://localhost:62075/callback?code=secret-code&state=secret-state";

  assert.equal(isFigmaMcpOAuthCallbackPrompt(callback), true);
  assert.equal(isFigmaMcpOAuthCallbackPrompt("https://www.figma.com/file/abc"), false);

  const redacted = redactFigmaMcpOAuthCallbackPrompt(`继续 ${callback}`);
  assert.match(redacted, /code=%3Credacted%3E/);
  assert.match(redacted, /state=%3Credacted%3E/);
  assert.doesNotMatch(redacted, /secret-code|secret-state/);
});

test("keeps Agent OAuth callback resume behind the disabled bridge flag", () => {
  const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");

  assert.match(source, /const canUseFigmaOAuthCallbackResume = FIGMA_AGENT_OAUTH_BRIDGE_ENABLED && isFigmaOAuthCallback && Boolean\(session\.claudeSessionId\);/);
  assert.match(source, /const canUseRemoteResume = \(supportsResume \|\| canUseFigmaOAuthCallbackResume\) && !switchedModel;/);
});
