import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import {
  normalizeWorkspacePluginManifest,
  type WorkspacePluginDescriptor,
  type WorkspacePluginManifest,
} from "../../../shared/workspace-plugins.js";
import type { ClientEvent, PromptAttachment } from "../../types.js";
import {
  startWorkspacePluginBridge,
  type WorkspacePluginBridge,
  type WorkspacePluginBridgeInput,
} from "./workspace-plugin-bridge.js";

type WorkspacePluginSession = {
  id: string;
  cwd?: string | null;
};

type WorkspacePluginSessionHistory = {
  messages: unknown[];
};

type PluginProcess = {
  kill(signal?: NodeJS.Signals | number): boolean;
};

type SpawnPluginProcessInput = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
};

type WorkspacePluginRecord = WorkspacePluginManifest & {
  rootPath: string;
};

type WorkspacePluginLaunchRecord = {
  pluginId: string;
  sessionId: string;
  url: string;
  process: PluginProcess;
  bridge: WorkspacePluginBridge;
  sessionImageAddUrl?: string;
};

export type WorkspacePluginLaunch = Pick<WorkspacePluginLaunchRecord, "pluginId" | "sessionId" | "url">;

export type WorkspacePluginManagerOptions = {
  pluginsRoot: string;
  sessionStore: {
    getSession(sessionId: string): WorkspacePluginSession | undefined;
    getSessionHistory?(sessionId: string): WorkspacePluginSessionHistory | null | undefined;
  };
  dispatch(event: Extract<ClientEvent, { type: "session.continue" }>): Promise<void> | void;
  generatedImagesRoot?: string;
  allocatePort?: () => Promise<number>;
  createBridge?: (input: WorkspacePluginBridgeInput) => Promise<WorkspacePluginBridge>;
  spawnProcess?: (input: SpawnPluginProcessInput) => PluginProcess;
  waitForReady?: (url: string) => Promise<void>;
};

const PLACEHOLDER_PATTERN = /\{(port|sessionId|workspace|generatedImagesRoot)\}/g;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function launchKey(pluginId: string, sessionId: string): string {
  return `${pluginId}:${sessionId}`;
}

async function allocateLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!address || typeof address === "string") throw new Error("Unable to allocate a workspace plugin port.");
  return address.port;
}

function expandTemplate(template: string, values: { port: number; sessionId: string; workspace: string; generatedImagesRoot: string }, encodeValues: boolean): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, name: keyof typeof values) => {
    const value = String(values[name]);
    return encodeValues ? encodeURIComponent(value) : value;
  });
}

function defaultSpawnProcess(input: SpawnPluginProcessInput): PluginProcess {
  return spawn(input.command, input.args, {
    cwd: input.cwd,
    env: input.env,
    stdio: "ignore",
    windowsHide: true,
  });
}

async function waitForLocalPage(url: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Workspace plugin did not become ready at ${url}: ${String(lastError ?? "HTTP response was not successful")}`);
}

function toDescriptor(plugin: WorkspacePluginRecord): WorkspacePluginDescriptor {
  return {
    id: plugin.id,
    label: plugin.label,
    surface: plugin.surface,
    permissions: plugin.permissions,
  };
}

export class WorkspacePluginManager {
  private readonly launches = new Map<string, WorkspacePluginLaunchRecord>();
  private readonly allocatePort: () => Promise<number>;
  private readonly createBridge: (input: WorkspacePluginBridgeInput) => Promise<WorkspacePluginBridge>;
  private readonly spawnProcess: (input: SpawnPluginProcessInput) => PluginProcess;
  private readonly waitForReady: (url: string) => Promise<void>;

  constructor(private readonly options: WorkspacePluginManagerOptions) {
    this.allocatePort = options.allocatePort ?? allocateLoopbackPort;
    this.createBridge = options.createBridge ?? startWorkspacePluginBridge;
    this.spawnProcess = options.spawnProcess ?? defaultSpawnProcess;
    this.waitForReady = options.waitForReady ?? waitForLocalPage;
  }

  async list(): Promise<WorkspacePluginDescriptor[]> {
    return (await this.readPlugins()).map(toDescriptor);
  }

  async open(input: { pluginId: string; sessionId: string }): Promise<WorkspacePluginLaunch> {
    const key = launchKey(input.pluginId, input.sessionId);
    const existing = this.launches.get(key);
    if (existing) {
      await this.syncInitialSessionImages(existing);
      return { pluginId: existing.pluginId, sessionId: existing.sessionId, url: existing.url };
    }

    const session = this.options.sessionStore.getSession(input.sessionId);
    if (!session?.cwd) throw new Error("Workspace plugin requires an active session with a workspace.");
    const plugin = (await this.readPlugins()).find((candidate) => candidate.id === input.pluginId);
    if (!plugin) throw new Error(`Workspace plugin is not installed: ${input.pluginId}`);
    if (!plugin.start.urlTemplate) throw new Error(`Workspace plugin does not declare a local URL template: ${input.pluginId}`);

    const port = await this.allocatePort();
    const bridge = await this.createBridge({
      sessionId: input.sessionId,
      token: randomUUID(),
      sessionStore: this.options.sessionStore,
      dispatch: this.options.dispatch,
    });
    const values = {
      port,
      sessionId: input.sessionId,
      workspace: session.cwd,
      generatedImagesRoot: this.options.generatedImagesRoot ?? "",
    };
    const url = expandTemplate(plugin.start.urlTemplate, values, true);
    const command = plugin.start.command === "node" ? process.execPath : plugin.start.command;
    const environment = Object.fromEntries(
      Object.entries(plugin.start.environment ?? {}).map(([key, value]) => [key, expandTemplate(value, values, false)]),
    );
    const sessionImageAddUrl = plugin.hooks?.["session.image.add"]?.urlTemplate
      ? expandTemplate(plugin.hooks["session.image.add"]!.urlTemplate, values, true)
      : undefined;
    const processHandle = this.spawnProcess({
      command,
      args: plugin.start.args.map((arg) => expandTemplate(arg, values, false)),
      cwd: plugin.rootPath,
      env: {
        ...process.env,
        TECH_CC_HUB_BRIDGE_URL: bridge.url,
        TECH_CC_HUB_BRIDGE_TOKEN: bridge.token,
        TECH_CC_HUB_SESSION_ID: input.sessionId,
        TECH_CC_HUB_WORKSPACE: session.cwd,
        ...(plugin.start.command === "node" ? { ELECTRON_RUN_AS_NODE: "1" } : {}),
        ...environment,
      },
    });

    try {
      await this.waitForReady(url);
      const launch = { pluginId: plugin.id, sessionId: input.sessionId, url, process: processHandle, bridge, sessionImageAddUrl };
      this.launches.set(key, launch);
      await this.syncInitialSessionImages(launch);
      return { pluginId: launch.pluginId, sessionId: launch.sessionId, url: launch.url };
    } catch (error) {
      processHandle.kill();
      await bridge.close();
      throw error;
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const closing = [...this.launches.values()].filter((launch) => launch.sessionId === sessionId);
    await Promise.all(closing.map(async (launch) => {
      await this.closeLaunch(launch);
    }));
  }

  async close(input: { pluginId: string; sessionId: string }): Promise<void> {
    const launch = this.launches.get(launchKey(input.pluginId, input.sessionId));
    if (launch) await this.closeLaunch(launch);
  }

  async syncSessionImages(input: { sessionId: string; attachments?: readonly PromptAttachment[] }): Promise<void> {
    const imageAttachments = (input.attachments ?? []).filter((attachment) => (
      attachment.kind === "image" && Boolean(attachment.storagePath?.trim())
    ));
    if (imageAttachments.length === 0) return;

    const launches = [...this.launches.values()].filter((launch) => launch.sessionId === input.sessionId && launch.sessionImageAddUrl);
    await Promise.all(launches.flatMap((launch) => imageAttachments.map(async (attachment) => {
      await this.postSessionImage(launch, attachment.storagePath!, attachment.name);
    })));
  }

  async closeAll(): Promise<void> {
    const sessionIds = new Set([...this.launches.values()].map((launch) => launch.sessionId));
    await Promise.all([...sessionIds].map(async (sessionId) => await this.closeSession(sessionId)));
  }

  private async syncInitialSessionImages(launch: WorkspacePluginLaunchRecord): Promise<void> {
    if (!launch.sessionImageAddUrl) return;
    const historicalAttachments = (this.options.sessionStore.getSessionHistory?.(launch.sessionId)?.messages ?? [])
      .flatMap((message) => getMessageAttachments(message));
    await this.syncSessionImages({ sessionId: launch.sessionId, attachments: historicalAttachments });

    const generatedImageDir = this.options.generatedImagesRoot
      ? join(this.options.generatedImagesRoot, launch.sessionId)
      : null;
    if (!generatedImageDir) return;
    let entries: Array<{ name: string; isFile(): boolean }>;
    try {
      entries = await readdir(generatedImageDir, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(entries
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      .map(async (entry) => await this.postSessionImage(launch, join(generatedImageDir, entry.name), entry.name)));
  }

  private async postSessionImage(launch: WorkspacePluginLaunchRecord, imagePath: string, name?: string): Promise<void> {
    if (!launch.sessionImageAddUrl) return;
    try {
      const response = await fetch(launch.sessionImageAddUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: imagePath,
          name: name || basename(imagePath),
          prompt: "Shared from the active chat",
        }),
      });
      if (!response.ok) throw new Error(`Workspace plugin image hook returned ${response.status}.`);
    } catch {
      // Image synchronization must never interrupt the active chat or prevent a plugin surface from opening.
    }
  }

  private async closeLaunch(launch: WorkspacePluginLaunchRecord): Promise<void> {
    this.launches.delete(launchKey(launch.pluginId, launch.sessionId));
    launch.process.kill();
    await launch.bridge.close();
  }

  private async readPlugins(): Promise<WorkspacePluginRecord[]> {
    let entries: Array<{ name: string; isDirectory(): boolean }>;
    try {
      entries = await readdir(this.options.pluginsRoot, { withFileTypes: true });
    } catch (error: unknown) {
      if (isMissingDirectory(error)) return [];
      throw error;
    }

    const plugins = await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry): Promise<WorkspacePluginRecord | null> => {
        const rootPath = join(this.options.pluginsRoot, entry.name);
        try {
          const parsed = JSON.parse(await readFile(join(rootPath, "tech-cc-hub.plugin.json"), "utf8"));
          const manifest = normalizeWorkspacePluginManifest(parsed);
          return manifest ? { ...manifest, rootPath } : null;
        } catch {
          return null;
        }
      }));
    const byId = new Map<string, WorkspacePluginRecord>();
    for (const plugin of plugins) {
      if (plugin && !byId.has(plugin.id)) byId.set(plugin.id, plugin);
    }
    return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
}

function getMessageAttachments(message: unknown): PromptAttachment[] {
  if (!message || typeof message !== "object" || !("attachments" in message)) return [];
  const attachments = (message as { attachments?: unknown }).attachments;
  return Array.isArray(attachments) ? attachments as PromptAttachment[] : [];
}

function isMissingDirectory(error: unknown): error is NodeJS.ErrnoException {
  return (error as NodeJS.ErrnoException | null | undefined)?.code === "ENOENT";
}
