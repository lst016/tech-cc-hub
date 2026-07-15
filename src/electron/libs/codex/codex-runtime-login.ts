import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { createInterface, type Interface as ReadLineInterface } from "readline";
import { join } from "path";
import {
  CODEX_OAUTH_BASE_URL,
} from "../../../shared/codex-oauth.js";
import type { ApiConfig, ApiConfigSettings } from "../config-store.js";
import {
  encodeCodexOAuthCredential,
  parseCodexCliAuthCredential,
  type CodexOAuthCredential,
} from "./codex-oauth.js";

const LOGIN_TIMEOUT_MS = 5 * 60_000;
const RPC_TIMEOUT_MS = 20_000;
const AUTH_FILE_WAIT_MS = 5_000;

export type CodexRuntimeLoginMode = "browser" | "device-code";

export type CodexRuntimeLoginStartInput = {
  profile: ApiConfig;
  mode?: CodexRuntimeLoginMode;
};

export type CodexRuntimeLoginStartResult = {
  success: boolean;
  attemptId?: string;
  mode?: CodexRuntimeLoginMode;
  verificationUrl?: string;
  userCode?: string;
  error?: string;
};

export type CodexRuntimeLoginEvent = {
  attemptId: string;
  profileId: string;
  type: "opening-browser" | "device-code" | "completed" | "cancelled" | "failed";
  verificationUrl?: string;
  userCode?: string;
  email?: string;
  accountIdSuffix?: string;
  expiresAt?: string;
  error?: string;
};

export type CodexRuntimeSpec = {
  executable: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
};

type CodexRuntimeLoginManagerOptions = {
  appPath: string;
  isPackaged: boolean;
  resourcesPath: string;
  userDataPath: string;
  openExternal: (url: string) => Promise<unknown>;
  loadSettings: () => ApiConfigSettings;
  saveSettings: (settings: ApiConfigSettings) => void;
  emit: (event: CodexRuntimeLoginEvent) => void;
  resolveRuntime?: () => CodexRuntimeSpec;
};

type RuntimeAttempt = {
  attemptId: string;
  profile: ApiConfig;
  mode: CodexRuntimeLoginMode;
  codexHome: string;
  client: CodexAppServerClient;
  loginId?: string;
  finished: boolean;
  timeout: NodeJS.Timeout;
};

type PendingRpc = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

type RpcMessage = {
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: unknown };
};

type LoginResponse = {
  type: "chatgpt" | "chatgptDeviceCode";
  loginId: string;
  authUrl?: string;
  verificationUrl?: string;
  userCode?: string;
};

export class CodexRuntimeLoginManager {
  private readonly attempts = new Map<string, RuntimeAttempt>();
  private readonly attemptByProfile = new Map<string, string>();

  constructor(private readonly options: CodexRuntimeLoginManagerOptions) {
    cleanupStaleAttemptDirectories(join(options.userDataPath, "codex-login"));
  }

  async start(input: CodexRuntimeLoginStartInput): Promise<CodexRuntimeLoginStartResult> {
    const profile = input?.profile;
    if (!profile?.id?.trim() || profile.provider !== "codex") {
      return { success: false, error: "请选择有效的 Codex OAuth 配置后再连接。" };
    }
    if (this.attemptByProfile.has(profile.id)) {
      return { success: false, error: "这个 Codex 配置正在连接，请等待完成或先取消。" };
    }

    const attemptId = randomUUID();
    const mode = input.mode === "device-code" ? "device-code" : "browser";
    const codexHome = join(this.options.userDataPath, "codex-login", attemptId);
    let client: CodexAppServerClient | null = null;

    try {
      const persistedProfile = this.options.loadSettings().profiles.find((item) => item.id === profile.id);
      if (!persistedProfile || persistedProfile.provider !== "codex") {
        throw new Error("请先保存这个 Codex 配置，再连接 ChatGPT 账号。");
      }
      mkdirSync(codexHome, { recursive: true });
      writeFileSync(join(codexHome, ".owner.json"), JSON.stringify({
        pid: process.pid,
        createdAt: Date.now(),
      }), "utf8");
      writeFileSync(
        join(codexHome, "config.toml"),
        'cli_auth_credentials_store = "file"\nforced_login_method = "chatgpt"\n',
        "utf8",
      );

      const runtime = this.options.resolveRuntime?.() ?? resolveCodexRuntime({
        appPath: this.options.appPath,
        isPackaged: this.options.isPackaged,
        resourcesPath: this.options.resourcesPath,
      });
      client = new CodexAppServerClient(runtime, codexHome);
      const timeout = setTimeout(() => {
        void this.failAttempt(attemptId, "ChatGPT 登录等待超时，请重新连接。", true);
      }, LOGIN_TIMEOUT_MS);
      const attempt: RuntimeAttempt = {
        attemptId,
        profile: { ...profile, apiKey: "" },
        mode,
        codexHome,
        client,
        finished: false,
        timeout,
      };
      this.attempts.set(attemptId, attempt);
      this.attemptByProfile.set(profile.id, attemptId);

      client.onNotification = (message) => {
        if (message.method === "account/login/completed") {
          void this.handleLoginCompleted(attemptId, message.params);
        }
      };
      client.onUnexpectedExit = (message) => {
        void this.failAttempt(attemptId, message, true);
      };

      await client.start();
      await client.request("initialize", {
        clientInfo: {
          name: "tech-cc-hub",
          title: "tech-cc-hub",
          version: "1",
        },
        capabilities: {
          experimentalApi: false,
          requestAttestation: false,
        },
      });
      client.notify("initialized");

      const login = await client.request("account/login/start", mode === "device-code"
        ? { type: "chatgptDeviceCode" }
        : { type: "chatgpt" }) as LoginResponse;
      if (!login?.loginId) {
        throw new Error("Codex runtime 没有返回登录标识。");
      }
      attempt.loginId = login.loginId;

      if (mode === "device-code") {
        if (!login.verificationUrl || !login.userCode) {
          throw new Error("Codex runtime 没有返回设备码登录信息。");
        }
        await this.options.openExternal(login.verificationUrl);
        this.options.emit({
          attemptId,
          profileId: profile.id,
          type: "device-code",
          verificationUrl: login.verificationUrl,
          userCode: login.userCode,
        });
        return {
          success: true,
          attemptId,
          mode,
          verificationUrl: login.verificationUrl,
          userCode: login.userCode,
        };
      }

      if (!login.authUrl) {
        throw new Error("Codex runtime 没有返回 ChatGPT 授权地址。");
      }
      await this.options.openExternal(login.authUrl);
      this.options.emit({ attemptId, profileId: profile.id, type: "opening-browser" });
      return { success: true, attemptId, mode };
    } catch (error) {
      const message = sanitizeCodexRuntimeError(error);
      if (this.attempts.has(attemptId)) {
        await this.failAttempt(attemptId, message, true);
      } else {
        await client?.stop();
        cleanupAttemptDirectory(codexHome);
      }
      return { success: false, error: message };
    }
  }

  async cancel(attemptId: string): Promise<{ success: boolean; error?: string }> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt || attempt.finished) {
      return { success: true };
    }
    attempt.finished = true;
    clearTimeout(attempt.timeout);
    try {
      if (attempt.loginId) {
        await attempt.client.request("account/login/cancel", { loginId: attempt.loginId }, 3_000).catch(() => undefined);
      }
      this.options.emit({ attemptId, profileId: attempt.profile.id, type: "cancelled" });
      return { success: true };
    } finally {
      await this.releaseAttempt(attempt);
    }
  }

  dispose(): void {
    for (const attempt of this.attempts.values()) {
      attempt.finished = true;
      clearTimeout(attempt.timeout);
      attempt.client.stopNow();
      cleanupAttemptDirectory(attempt.codexHome);
    }
    this.attempts.clear();
    this.attemptByProfile.clear();
  }

  private async handleLoginCompleted(attemptId: string, params: unknown): Promise<void> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt || attempt.finished) return;
    const completed = asRecord(params);
    if (stringValue(completed.loginId) && attempt.loginId && stringValue(completed.loginId) !== attempt.loginId) {
      return;
    }
    if (completed.success !== true) {
      await this.failAttempt(attemptId, stringValue(completed.error) || "ChatGPT 登录没有完成。", true);
      return;
    }

    attempt.finished = true;
    clearTimeout(attempt.timeout);
    let finalEvent: CodexRuntimeLoginEvent;
    try {
      const credential = await readRuntimeCredential(attempt.codexHome);
      validateRuntimeCredential(credential);
      this.persistCredential(attempt, credential);
      finalEvent = {
        attemptId,
        profileId: attempt.profile.id,
        type: "completed",
        email: credential.email,
        accountIdSuffix: credential.accountId.slice(-6),
        expiresAt: credential.expired,
      };
    } catch (error) {
      finalEvent = {
        attemptId,
        profileId: attempt.profile.id,
        type: "failed",
        error: sanitizeCodexRuntimeError(error),
      };
    }
    await this.releaseAttempt(attempt);
    this.options.emit(finalEvent);
  }

  private persistCredential(attempt: RuntimeAttempt, credential: CodexOAuthCredential): void {
    const current = this.options.loadSettings();
    const encoded = encodeCodexOAuthCredential(credential);
    const existingIndex = current.profiles.findIndex((profile) => profile.id === attempt.profile.id);
    let nextProfiles: ApiConfig[];
    if (existingIndex >= 0) {
      const existing = current.profiles[existingIndex]!;
      if (existing.provider !== "codex") {
        throw new Error("目标配置已变更为非 Codex 类型，凭据未保存。");
      }
      nextProfiles = current.profiles.map((profile, index) => index === existingIndex
        ? {
            ...profile,
            apiKey: encoded,
            baseURL: CODEX_OAUTH_BASE_URL,
            provider: "codex",
          }
        : profile);
    } else {
      throw new Error("目标 Codex 配置已被删除，凭据未保存。");
    }
    this.options.saveSettings({ profiles: nextProfiles });
  }

  private async failAttempt(attemptId: string, error: string, emit: boolean): Promise<void> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt || attempt.finished) return;
    attempt.finished = true;
    clearTimeout(attempt.timeout);
    const event: CodexRuntimeLoginEvent = {
        attemptId,
        profileId: attempt.profile.id,
        type: "failed",
        error: sanitizeCodexRuntimeError(error),
      };
    await this.releaseAttempt(attempt);
    if (emit) {
      this.options.emit(event);
    }
  }

  private async releaseAttempt(attempt: RuntimeAttempt): Promise<void> {
    this.attempts.delete(attempt.attemptId);
    if (this.attemptByProfile.get(attempt.profile.id) === attempt.attemptId) {
      this.attemptByProfile.delete(attempt.profile.id);
    }
    await attempt.client.stop();
    cleanupAttemptDirectory(attempt.codexHome);
  }
}

class CodexAppServerClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lines: ReadLineInterface | null = null;
  private readonly pending = new Map<number, PendingRpc>();
  private nextRequestId = 1;
  private stopping = false;
  private stopPromise: Promise<void> | null = null;
  private stderr = "";

  onNotification?: (message: RpcMessage) => void;
  onUnexpectedExit?: (message: string) => void;

  constructor(
    private readonly runtime: CodexRuntimeSpec,
    private readonly codexHome: string,
  ) {}

  async start(): Promise<void> {
    const args = this.runtime.args ?? ["app-server", "--stdio"];
    const child = spawn(this.runtime.executable, args, {
      cwd: this.codexHome,
      env: {
        ...process.env,
        ...this.runtime.env,
        CODEX_HOME: this.codexHome,
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    this.lines = createInterface({ input: child.stdout });
    this.lines.on("line", (line) => this.handleLine(line));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderr = `${this.stderr}${sanitizeCodexRuntimeError(chunk)}`.slice(-2_000);
    });
    child.stdin.on("error", (error) => this.handleExit(error.message));
    child.on("error", (error) => this.handleExit(error.message));
    child.on("exit", (code, signal) => {
      if (!this.stopping) {
        this.handleExit(this.stderr.trim() || `Codex runtime 已退出（code=${code ?? "null"}, signal=${signal ?? "none"}）。`);
      }
    });

    await new Promise<void>((resolve, reject) => {
      if (child.pid) {
        resolve();
        return;
      }
      const timer = setTimeout(() => reject(new Error("Codex runtime 启动超时。")), 5_000);
      child.once("spawn", () => {
        clearTimeout(timer);
        resolve();
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  request(method: string, params?: unknown, timeoutMs = RPC_TIMEOUT_MS): Promise<unknown> {
    const child = this.child;
    if (!child?.stdin.writable) {
      return Promise.reject(new Error("Codex runtime 尚未启动。"));
    }
    const id = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex runtime 请求超时：${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      child.stdin.write(`${JSON.stringify({ method, id, params })}\n`, (error) => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        clearTimeout(pending.timeout);
        pending.reject(new Error(sanitizeCodexRuntimeError(error)));
      });
    });
  }

  notify(method: string, params?: unknown): void {
    if (!this.child?.stdin.writable) return;
    const message = params === undefined ? { method } : { method, params };
    this.child.stdin.write(`${JSON.stringify(message)}\n`, (error) => {
      if (error) this.handleExit(error.message);
    });
  }

  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = (async () => {
      this.stopping = true;
      this.lines?.close();
      this.lines = null;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Codex runtime 已停止。"));
      }
      this.pending.clear();
      const child = this.child;
      this.child = null;
      if (!child || child.exitCode !== null || child.signalCode !== null) return;
      await new Promise<void>((resolve) => {
        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          resolve();
        };
        const timer = setTimeout(() => {
          forceKillProcessTree(child);
          finish();
        }, 1_000);
        child.once("exit", () => {
          clearTimeout(timer);
          finish();
        });
        if (!child.killed) child.kill();
      });
    })();
    return this.stopPromise;
  }

  stopNow(): void {
    this.stopping = true;
    this.lines?.close();
    this.lines = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Codex runtime 已停止。"));
    }
    this.pending.clear();
    const child = this.child;
    this.child = null;
    if (child && child.exitCode === null && child.signalCode === null) {
      forceKillProcessTree(child);
    }
  }

  private handleLine(line: string): void {
    let message: RpcMessage;
    try {
      message = JSON.parse(line) as RpcMessage;
    } catch {
      return;
    }
    if (message.id !== undefined && typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) {
        pending.reject(new Error(sanitizeCodexRuntimeError(stringValue(message.error.message) || "Codex runtime 请求失败。")));
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (message.method) {
      this.onNotification?.(message);
    }
  }

  private handleExit(message: string): void {
    if (this.stopping) return;
    this.stopping = true;
    const error = new Error(sanitizeCodexRuntimeError(message));
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
    this.onUnexpectedExit?.(error.message);
  }
}

export function resolveCodexRuntime(input: {
  appPath: string;
  isPackaged: boolean;
  resourcesPath: string;
  platform?: NodeJS.Platform;
  arch?: string;
}): CodexRuntimeSpec {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  const target = resolveRuntimeTarget(platform, arch);
  const nodeModulesRoot = input.isPackaged
    ? join(input.resourcesPath, "app.asar.unpacked", "node_modules")
    : join(input.appPath, "node_modules");
  const executableName = platform === "win32" ? "codex.exe" : "codex";
  const candidates = [
    join(nodeModulesRoot, "@openai", target.packageDirectory, "vendor", target.triple, "bin", executableName),
    // electron-builder preserves npm alias packages under the parent package using
    // their manifest name (`@openai/codex`) instead of the alias directory name.
    join(nodeModulesRoot, "@openai", "codex", "node_modules", "@openai", "codex", "vendor", target.triple, "bin", executableName),
  ];
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) {
    throw new Error("应用内置的 Codex 登录 runtime 缺失，请重新安装或更新 tech-cc-hub。");
  }
  return { executable };
}

export function sanitizeCodexRuntimeError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value
    .replace(/(["']?)(authorization|access_token|refresh_token|id_token|user_code|code)\1\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, "$1$2$1=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, "[token]")
    .replace(/https?:\/\/[^\s)]+/gi, "[url]")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 600) || "Codex runtime 登录失败。";
}

export function validateRuntimeCredential(credential: CodexOAuthCredential | null): asserts credential is CodexOAuthCredential {
  if (!credential?.accessToken || !credential.refreshToken || !credential.accountId) {
    throw new Error("Codex runtime 登录完成，但生成的凭据不完整。");
  }
  const expiresAt = Date.parse(credential.expired ?? "");
  if (!Number.isFinite(expiresAt) || expiresAt - Date.now() <= 60_000) {
    throw new Error("Codex runtime 返回的访问凭据已经过期。");
  }
}

async function readRuntimeCredential(codexHome: string): Promise<CodexOAuthCredential | null> {
  const authPath = join(codexHome, "auth.json");
  const deadline = Date.now() + AUTH_FILE_WAIT_MS;
  while (Date.now() < deadline) {
    if (existsSync(authPath)) {
      try {
        const credential = parseCodexCliAuthCredential(readFileSync(authPath, "utf8"));
        if (credential) {
          rmSync(authPath, { force: true });
          return credential;
        }
      } catch {
        // The runtime may still be replacing the file; retry without exposing its contents.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Codex runtime 登录完成，但没有生成可读取的 auth.json。");
}

function forceKillProcessTree(child: ChildProcessWithoutNullStreams): void {
  const pid = child.pid;
  if (!pid || !Number.isInteger(pid) || pid <= 0) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      return;
    } catch {
      // Fall back to the direct child if taskkill raced with normal exit.
    }
  }
  try {
    child.kill("SIGKILL");
  } catch {
    // The process may already have exited.
  }
}

function cleanupAttemptDirectory(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch (error) {
    console.warn("[codex-runtime-login] Failed to remove isolated login state:", error instanceof Error ? error.message : String(error));
  }
}

function cleanupStaleAttemptDirectories(loginRoot: string): void {
  if (!existsSync(loginRoot)) return;
  const staleAfterMs = LOGIN_TIMEOUT_MS + 5 * 60_000;
  for (const entry of readdirSync(loginRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const attemptPath = join(loginRoot, entry.name);
    let ownerPid = 0;
    let createdAt = 0;
    try {
      const owner = JSON.parse(readFileSync(join(attemptPath, ".owner.json"), "utf8")) as { pid?: unknown; createdAt?: unknown };
      ownerPid = typeof owner.pid === "number" ? owner.pid : 0;
      createdAt = typeof owner.createdAt === "number" ? owner.createdAt : 0;
    } catch {
      createdAt = statSync(attemptPath).mtimeMs;
    }
    const ownerAlive = ownerPid > 0 && isProcessAlive(ownerPid);
    if (ownerAlive && Date.now() - createdAt < staleAfterMs) continue;
    if (!ownerPid && Date.now() - createdAt < staleAfterMs) continue;
    cleanupAttemptDirectory(attemptPath);
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function resolveRuntimeTarget(platform: NodeJS.Platform, arch: string): { packageDirectory: string; triple: string } {
  const key = `${platform}-${arch}`;
  const targets: Record<string, { packageDirectory: string; triple: string }> = {
    "win32-x64": { packageDirectory: "codex-win32-x64", triple: "x86_64-pc-windows-msvc" },
    "win32-arm64": { packageDirectory: "codex-win32-arm64", triple: "aarch64-pc-windows-msvc" },
    "darwin-x64": { packageDirectory: "codex-darwin-x64", triple: "x86_64-apple-darwin" },
    "darwin-arm64": { packageDirectory: "codex-darwin-arm64", triple: "aarch64-apple-darwin" },
    "linux-x64": { packageDirectory: "codex-linux-x64", triple: "x86_64-unknown-linux-musl" },
    "linux-arm64": { packageDirectory: "codex-linux-arm64", triple: "aarch64-unknown-linux-musl" },
  };
  const target = targets[key];
  if (!target) {
    throw new Error(`当前平台不支持内置 Codex 登录 runtime：${platform}/${arch}`);
  }
  return target;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
