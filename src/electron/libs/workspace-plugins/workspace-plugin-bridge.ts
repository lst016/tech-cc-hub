import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, relative } from "node:path";
import { pathToFileURL } from "node:url";

import type { ClientEvent, PromptAttachment } from "../../types.js";

const MAX_PLUGIN_IMAGE_BYTES = 8_000_000;
const MAX_PLUGIN_JSON_BYTES = 64_000;
const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const IMAGE_MIME_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type PluginBridgeSession = {
  id: string;
  cwd?: string | null;
  title?: string | null;
  status?: string | null;
  model?: string | null;
  lastPrompt?: string | null;
};

type PluginBridgeSource = {
  pluginId: string;
  action: "send-to-chat" | "mention-file";
};

type SessionSendRequest = {
  sessionId: string;
  prompt?: string;
  imagePath: string;
  source: PluginBridgeSource;
};

export type WorkspacePluginImageGenerationRequest = {
  sessionId: string;
  action: "generate" | "edit";
  prompt: string;
  referenceImagePaths: string[];
};

export type WorkspacePluginImageGenerationResult = {
  success: boolean;
  model?: string;
  artifacts?: Array<{ path: string }>;
  error?: string;
};

export type WorkspacePluginImageGenerator = (
  request: WorkspacePluginImageGenerationRequest,
) => Promise<WorkspacePluginImageGenerationResult>;

export type WorkspacePluginDispatchEvent = Extract<ClientEvent, {
  type: "session.continue" | "session.append";
}>;

export type WorkspacePluginBridgeInput = {
  sessionId: string;
  token: string;
  sessionStore: {
    getSession(sessionId: string): PluginBridgeSession | undefined;
  };
  dispatch(event: WorkspacePluginDispatchEvent): Promise<void> | void;
  generateImage?: WorkspacePluginImageGenerator;
};

export type WorkspacePluginBridge = {
  url: string;
  token: string;
  close(): Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLoopbackAddress(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function writeJson(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_PLUGIN_JSON_BYTES) {
      throw new Error("Plugin request body is too large.");
    }
    chunks.push(buffer);
  }
  if (size === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function parseSource(value: unknown): PluginBridgeSource | null {
  if (!isRecord(value) || typeof value.pluginId !== "string" || !PLUGIN_ID_PATTERN.test(value.pluginId)) return null;
  if (value.action !== "send-to-chat" && value.action !== "mention-file") return null;
  return { pluginId: value.pluginId, action: value.action };
}

function parseSessionSendRequest(value: unknown): SessionSendRequest | null {
  if (!isRecord(value) || typeof value.sessionId !== "string" || typeof value.imagePath !== "string") return null;
  const source = parseSource(value.source);
  if (!source) return null;
  return {
    sessionId: value.sessionId.trim(),
    imagePath: value.imagePath.trim(),
    prompt: typeof value.prompt === "string" ? value.prompt.trim() : "",
    source,
  };
}

function parseImageGenerationRequest(value: unknown): WorkspacePluginImageGenerationRequest | null {
  if (!isRecord(value) || typeof value.sessionId !== "string" || typeof value.prompt !== "string") return null;
  if (value.action !== "generate" && value.action !== "edit") return null;
  if (!Array.isArray(value.referenceImagePaths) || value.referenceImagePaths.length > 4) return null;
  const referenceImagePaths = value.referenceImagePaths
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  if (referenceImagePaths.length !== value.referenceImagePaths.length) return null;
  const prompt = value.prompt.trim();
  if (!prompt) return null;
  return {
    sessionId: value.sessionId.trim(),
    action: value.action,
    prompt,
    referenceImagePaths,
  };
}

function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relativePath = relative(rootPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function buildPluginPrompt(source: PluginBridgeSource, prompt: string): string {
  const message = prompt || "请将选中的画布图片作为当前任务的上下文。";
  return `[来自 ${source.pluginId === "codex-canvas" ? "Codex-Canvas" : source.pluginId}：${source.action}]\n${message}`;
}

async function createImageAttachment(input: {
  imagePath: string;
  workspaceRoot: string;
  source: PluginBridgeSource;
}): Promise<PromptAttachment> {
  const resolvedWorkspaceRoot = await realpath(input.workspaceRoot);
  const resolvedImagePath = await realpath(input.imagePath);
  if (!isPathInsideRoot(resolvedWorkspaceRoot, resolvedImagePath)) {
    throw new Error("Selected canvas asset must be inside the active workspace.");
  }

  const fileStat = await stat(resolvedImagePath);
  if (!fileStat.isFile()) throw new Error("Selected canvas asset must be a file.");
  if (fileStat.size > MAX_PLUGIN_IMAGE_BYTES) throw new Error("Selected canvas asset exceeds the 8 MB attachment limit.");

  const mimeType = IMAGE_MIME_TYPES[extname(resolvedImagePath).toLowerCase()];
  if (!mimeType) throw new Error("Selected canvas asset has an unsupported image type.");

  const data = `data:${mimeType};base64,${(await readFile(resolvedImagePath)).toString("base64")}`;
  const name = basename(resolvedImagePath);
  return {
    id: `workspace-plugin:${input.source.pluginId}:${name}`,
    kind: "image",
    name,
    mimeType,
    data,
    runtimeData: data,
    size: fileStat.size,
    storagePath: resolvedImagePath,
    storageUri: pathToFileURL(resolvedImagePath).toString(),
  };
}

function getBoundSession(input: WorkspacePluginBridgeInput): PluginBridgeSession | null {
  const session = input.sessionStore.getSession(input.sessionId);
  return session?.id === input.sessionId ? session : null;
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, input: WorkspacePluginBridgeInput): Promise<void> {
  if (!isLoopbackAddress(request.socket.remoteAddress) || request.headers.authorization !== `Bearer ${input.token}`) {
    writeJson(response, 401, { error: "Unauthorized" });
    return;
  }

  const session = getBoundSession(input);
  if (!session) {
    writeJson(response, 404, { error: "Bound session no longer exists." });
    return;
  }

  if (request.method === "GET" && request.url === "/v1/session/snapshot") {
    writeJson(response, 200, {
      session: {
        id: session.id,
        title: session.title ?? "",
        status: session.status ?? "idle",
        model: session.model ?? "",
        lastPrompt: session.lastPrompt ?? "",
      },
    });
    return;
  }

  if (request.method === "POST" && request.url === "/v1/session/image-generate") {
    if (!input.generateImage) {
      writeJson(response, 403, { error: "This workspace plugin is not allowed to generate images." });
      return;
    }
    try {
      const body = parseImageGenerationRequest(await readJson(request));
      if (!body || body.sessionId !== input.sessionId) {
        writeJson(response, 400, { error: "Invalid workspace plugin image generation request." });
        return;
      }
      const result = await input.generateImage(body);
      writeJson(response, result.success ? 200 : 422, result);
    } catch (error) {
      writeJson(response, 500, { error: error instanceof Error ? error.message : "Plugin image generation failed." });
    }
    return;
  }

  if (request.method !== "POST" || request.url !== "/v1/session/send") {
    writeJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    const body = parseSessionSendRequest(await readJson(request));
    if (!body || body.sessionId !== input.sessionId || !body.imagePath) {
      writeJson(response, 400, { error: "Invalid workspace plugin send request." });
      return;
    }
    if (!session.cwd) {
      writeJson(response, 409, { error: "Bound session has no workspace." });
      return;
    }

    const attachment = await createImageAttachment({
      imagePath: body.imagePath,
      workspaceRoot: session.cwd,
      source: body.source,
    });
    const payload = {
      sessionId: input.sessionId,
      prompt: buildPluginPrompt(body.source, body.prompt ?? ""),
      attachments: [attachment],
    };
    await input.dispatch(session.status === "running"
      ? { type: "session.append", payload }
      : { type: "session.continue", payload });
    writeJson(response, 202, { status: "accepted" });
  } catch (error) {
    writeJson(response, 400, { error: error instanceof Error ? error.message : "Plugin request failed." });
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

export async function startWorkspacePluginBridge(input: WorkspacePluginBridgeInput): Promise<WorkspacePluginBridge> {
  const server = createServer((request, response) => {
    void handleRequest(request, response, input);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("Workspace plugin bridge did not bind a TCP port.");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    token: input.token,
    close: async () => await closeServer(server),
  };
}
