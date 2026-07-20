import { safeStorage } from "electron";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { loadGlobalRuntimeConfig } from "../config-store.js";

type WooRuntimeEnv = Record<string, unknown>;

export type WooAuthConfig = {
  baseUrl: string;
  projectId: string;
};

// Desktop OAuth clients cannot keep a client secret. These public deployment
// identifiers are packaged so a fresh install can start the hosted login flow;
// controlled runtime config can still replace the pair for another deployment.
export const DEFAULT_WOO_AUTH_CONFIG = Object.freeze({
  baseUrl: "https://iaccount.hwlnk.com",
  projectId: "4ca11f5f21214dd2970ab5ad4b984431",
});

type WooTokenInfo = {
  universalUserId: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt?: string;
  refreshExpiresAt?: string;
};

type WooUser = {
  universalUserId: string;
  realName?: string;
  userHandle?: string;
  userEmail?: string;
  avatarUrl?: string;
  ifEnabled?: boolean;
};

export type WooAuthState = {
  status: "anonymous" | "authenticated";
  user: WooUser | null;
  challenges: string[];
  loginMethods: {
    password: boolean;
    email: boolean;
    thirdParty: boolean;
  } | null;
  error?: string;
};

type StoredWooSession = {
  tokenInfo: WooTokenInfo;
  challenges: string[];
};

const STORE_FILE_NAME = "woo-auth-session.bin";
const THIRD_PARTY_LOGIN_TIMEOUT_MS = 3 * 60 * 1000;
const THIRD_PARTY_POLL_INTERVAL_MS = 1000;

type ThirdPartyLoginOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function resolveWooAuthConfig(runtime: unknown): WooAuthConfig {
  const env = asRecord(asRecord(runtime)?.env) as WooRuntimeEnv | null;
  const baseUrl = typeof env?.WOO_BASE_URL === "string" ? env.WOO_BASE_URL.trim().replace(/\/$/, "") : "";
  const projectId = typeof env?.WOO_CLIENT_ID === "string" ? env.WOO_CLIENT_ID.trim() : "";
  if (!baseUrl && !projectId) {
    return { ...DEFAULT_WOO_AUTH_CONFIG };
  }
  if (!baseUrl || !projectId) {
    throw new Error("Woo 登录尚未配置。请在受控运行时配置中设置 WOO_BASE_URL 与 WOO_CLIENT_ID。");
  }
  return { baseUrl, projectId };
}

function getRuntimeConfig(): WooAuthConfig {
  return resolveWooAuthConfig(loadGlobalRuntimeConfig());
}

function unwrapResponse(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record || !("code" in record)) return payload;
  if (record.code !== 0) {
    throw new Error(typeof record.message === "string" ? record.message : "Woo 请求失败");
  }
  return record.data;
}

function normalizeTokenInfo(payload: unknown): WooTokenInfo {
  const record = asRecord(payload);
  if (!record || typeof record.accessToken !== "string" || !record.accessToken.trim()) {
    throw new Error("Woo 登录未返回 accessToken。");
  }
  return {
    universalUserId: typeof record.universalUserId === "string" ? record.universalUserId : "",
    accessToken: record.accessToken,
    refreshToken: typeof record.refreshToken === "string" ? record.refreshToken : "",
    tokenType: typeof record.tokenType === "string" && record.tokenType ? record.tokenType : "Bearer",
    expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : undefined,
    refreshExpiresAt: typeof record.refreshExpiresAt === "string" ? record.refreshExpiresAt : undefined,
  };
}

function normalizeChallenges(payload: unknown): string[] {
  const record = asRecord(payload);
  const challenges = record?.authChallenges;
  return Array.isArray(challenges) ? challenges.filter((item): item is string => typeof item === "string") : [];
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export class WooAuthManager {
  private state: WooAuthState = {
    status: "anonymous",
    user: null,
    challenges: [],
    loginMethods: null,
  };

  constructor(
    private readonly userDataPath: string,
    private readonly resolveRuntimeConfig: () => WooAuthConfig = getRuntimeConfig,
  ) {}

  getState(): WooAuthState {
    return this.state;
  }

  async getLoginMethods(): Promise<WooAuthState> {
    const config = this.resolveRuntimeConfig();
    const response = await this.request(`${config.baseUrl}/api/v1/auth/config?clientId=${encodeURIComponent(config.projectId)}&continueUrl=${encodeURIComponent("tech-cc-hub://woo/auth/callback")}`);
    const data = asRecord(unwrapResponse(response));
    this.state = {
      ...this.state,
      loginMethods: {
        password: data?.ifPwd === true,
        email: data?.ifMail === true,
        thirdParty: data?.ifThirdParty === true,
      },
      error: undefined,
    };
    return this.state;
  }

  async loginWithPassword(input: { userName: string; password: string }): Promise<WooAuthState> {
    const result = await this.requestLogin("/api/v1/auth/login/password", input);
    return await this.completeLogin(result);
  }

  async sendEmailCode(input: { mail: string }): Promise<void> {
    const config = this.resolveRuntimeConfig();
    await this.request(`${config.baseUrl}/api/v1/auth/login/email/code`, {
      method: "POST",
      body: { mail: input.mail, projectId: config.projectId },
    });
  }

  async loginWithEmail(input: { mail: string; code: string }): Promise<WooAuthState> {
    const config = this.resolveRuntimeConfig();
    const result = await this.requestLogin("/api/v1/auth/login/email", {
      mail: input.mail,
      code: input.code,
      projectId: config.projectId,
    });
    return await this.completeLogin(result);
  }

  async loginWithThirdParty(
    openExternal: (url: string) => Promise<void>,
    options: ThirdPartyLoginOptions = {},
  ): Promise<WooAuthState> {
    const config = this.resolveRuntimeConfig();
    const generated = asRecord(unwrapResponse(await this.request(`${config.baseUrl}/api/v1/auth/challenge/generate`, {
      method: "POST",
      body: {},
    })));
    const challengeCode = typeof generated?.challengeCode === "string" ? generated.challengeCode.trim() : "";
    const challengeSecret = typeof generated?.challengeSecret === "string" ? generated.challengeSecret.trim() : "";
    if (!challengeCode || !challengeSecret) {
      throw new Error("Woo 未返回第三方登录挑战，请稍后重试。");
    }

    const loginUrl = new URL("/login", `${config.baseUrl}/`);
    loginUrl.searchParams.set("popup", "true");
    loginUrl.searchParams.set("challengeCode", challengeCode);
    await openExternal(loginUrl.toString());

    const timeoutMs = Math.max(1, options.timeoutMs ?? THIRD_PARTY_LOGIN_TIMEOUT_MS);
    const pollIntervalMs = Math.max(0, options.pollIntervalMs ?? THIRD_PARTY_POLL_INTERVAL_MS);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await wait(pollIntervalMs);
      const pollUrl = new URL("/api/v1/auth/challenge/poll", `${config.baseUrl}/`);
      pollUrl.searchParams.set("challengeCode", challengeCode);
      pollUrl.searchParams.set("challengeSecret", challengeSecret);
      const result = asRecord(unwrapResponse(await this.request(pollUrl.toString())));
      if (result?.status === "success" && result.tokenInfo) {
        return await this.completeLogin(result);
      }
      if (result?.status === "fail") {
        throw new Error(typeof result.message === "string" ? result.message : "Woo 第三方登录失败，请重试。");
      }
    }
    throw new Error("Woo 第三方登录已超时，请重新登录。");
  }

  async restore(): Promise<WooAuthState> {
    const session = this.readSession();
    if (!session) return this.state;
    try {
      return await this.completeSession(session);
    } catch {
      this.clearStoredSession();
      this.state = { ...this.state, status: "anonymous", user: null, challenges: [], error: "Woo 登录已失效，请重新登录。" };
      return this.state;
    }
  }

  async logout(): Promise<WooAuthState> {
    const session = this.readSession();
    if (session) {
      try {
        const config = this.resolveRuntimeConfig();
        await this.request(`${config.baseUrl}/api/v1/auth/logout`, {
          method: "POST",
          token: session.tokenInfo.accessToken,
        });
      } catch {
        // Local credentials must be removed even when the remote logout request fails.
      }
    }
    this.clearStoredSession();
    this.state = { status: "anonymous", user: null, challenges: [], loginMethods: this.state.loginMethods };
    return this.state;
  }

  private async requestLogin(path: string, body: Record<string, string>): Promise<unknown> {
    const config = this.resolveRuntimeConfig();
    const response = await this.request(`${config.baseUrl}${path}`, { method: "POST", body });
    return unwrapResponse(response);
  }

  private async completeLogin(payload: unknown): Promise<WooAuthState> {
    const record = asRecord(payload);
    const tokenInfo = normalizeTokenInfo(record?.tokenInfo ?? payload);
    return await this.completeSession({ tokenInfo, challenges: normalizeChallenges(payload) });
  }

  private async completeSession(session: StoredWooSession): Promise<WooAuthState> {
    const config = this.resolveRuntimeConfig();
    const response = await this.request(`${config.baseUrl}/api/v1/account/current`, { token: session.tokenInfo.accessToken });
    const user = asRecord(unwrapResponse(response));
    if (!user || typeof user.universalUserId !== "string") {
      throw new Error("Woo 未返回当前用户信息。");
    }
    this.writeSession(session);
    this.state = {
      status: "authenticated",
      user: {
        universalUserId: user.universalUserId,
        realName: typeof user.realName === "string" ? user.realName : undefined,
        userHandle: typeof user.userHandle === "string" ? user.userHandle : undefined,
        userEmail: typeof user.userEmail === "string" ? user.userEmail : undefined,
        avatarUrl: typeof user.avatarUrl === "string" ? user.avatarUrl : undefined,
        ifEnabled: typeof user.ifEnabled === "boolean" ? user.ifEnabled : undefined,
      },
      challenges: session.challenges,
      loginMethods: this.state.loginMethods,
    };
    return this.state;
  }

  private async request(url: string, options: { method?: "POST"; body?: Record<string, string>; token?: string } = {}): Promise<unknown> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.body) headers["content-type"] = "application/json";
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const record = asRecord(payload);
      throw new Error(typeof record?.message === "string" ? record.message : `Woo 请求失败（HTTP ${response.status}）。`);
    }
    return payload;
  }

  private getStorePath(): string {
    return join(this.userDataPath, STORE_FILE_NAME);
  }

  private readSession(): StoredWooSession | null {
    try {
      const path = this.getStorePath();
      if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) return null;
      const encrypted = readFileSync(path, "utf8");
      const decoded = safeStorage.decryptString(Buffer.from(encrypted, "base64"));
      const parsed = JSON.parse(decoded) as StoredWooSession;
      return parsed?.tokenInfo?.accessToken ? parsed : null;
    } catch {
      return null;
    }
  }

  private writeSession(session: StoredWooSession): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("当前系统不支持安全存储，无法保存 Woo 登录会话。");
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(session));
    writeFileSync(this.getStorePath(), encrypted.toString("base64"), "utf8");
  }

  private clearStoredSession(): void {
    const path = this.getStorePath();
    if (existsSync(path)) unlinkSync(path);
  }
}
