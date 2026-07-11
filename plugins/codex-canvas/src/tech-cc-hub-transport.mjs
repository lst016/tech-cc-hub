const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function readBridgeConfig() {
  const url = process.env.TECH_CC_HUB_BRIDGE_URL?.trim();
  const token = process.env.TECH_CC_HUB_BRIDGE_TOKEN?.trim();
  const sessionId = process.env.TECH_CC_HUB_SESSION_ID?.trim();
  if (!url || !token || !sessionId) return null;

  let bridgeUrl;
  try {
    bridgeUrl = new URL(url);
  } catch {
    return null;
  }
  if (bridgeUrl.protocol !== "http:" || !LOOPBACK_HOSTS.has(bridgeUrl.hostname)) return null;
  return { bridgeUrl, token, sessionId };
}

export function hasTechCcHubTransport() {
  return Boolean(readBridgeConfig());
}

export async function getTechCcHubSessionSnapshot() {
  const config = readBridgeConfig();
  if (!config) return null;

  const endpoint = new URL("/v1/session/snapshot", config.bridgeUrl);
  const response = await fetch(endpoint, {
    headers: { authorization: `Bearer ${config.token}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof result.error === "string" ? result.error : `Tech CC Hub bridge returned HTTP ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }
  const session = result.session;
  if (!session || session.id !== config.sessionId) return null;
  return {
    id: session.id,
    title: typeof session.title === "string" ? session.title.trim() : ""
  };
}

export async function sendCanvasAssetToTechCcHub({ threadId, imagePath, prompt, action }) {
  const config = readBridgeConfig();
  if (!config) throw new Error("Tech CC Hub Canvas transport is not configured.");
  if (threadId && threadId !== config.sessionId) {
    const error = new Error("Codex-Canvas is bound to a different Tech CC Hub session.");
    error.statusCode = 409;
    throw error;
  }

  const endpoint = new URL("/v1/session/send", config.bridgeUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({
      sessionId: config.sessionId,
      imagePath,
      prompt: prompt || "Use this selected Codex-Canvas image as context.",
      source: { pluginId: "codex-canvas", action },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof result.error === "string" ? result.error : `Tech CC Hub bridge returned HTTP ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }
  return {
    threadId: config.sessionId,
    status: "submitted",
    durationMs: null,
    completionPending: true,
  };
}

export async function generateCanvasImageWithTechCcHub({ threadId, prompt, referenceImagePaths, action = "edit", signal }) {
  const config = readBridgeConfig();
  if (!config) throw new Error("Tech CC Hub Canvas transport is not configured.");
  if (threadId && threadId !== config.sessionId) {
    const error = new Error("Codex-Canvas is bound to a different Tech CC Hub session.");
    error.statusCode = 409;
    throw error;
  }

  const endpoint = new URL("/v1/session/image-generate", config.bridgeUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({
      sessionId: config.sessionId,
      action,
      prompt,
      referenceImagePaths,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success || !Array.isArray(result.artifacts)) {
    const error = new Error(typeof result.error === "string" ? result.error : `Tech CC Hub image bridge returned HTTP ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }
  const artifacts = result.artifacts
    .filter((artifact) => artifact && typeof artifact.path === "string" && artifact.path.trim())
    .map((artifact) => ({ path: artifact.path.trim() }));
  if (!artifacts.length) throw new Error("Tech CC Hub image bridge returned no image artifacts.");
  return {
    model: typeof result.model === "string" ? result.model : "",
    artifacts,
  };
}
