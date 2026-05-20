#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const BASE_URL = "https://chatgpt.com";
const AUTH_CLAIM = "https://api.openai.com/auth";
const COMPACT_MODEL_SUFFIX = "-openai-compact";
const DEFAULT_MODEL = "gpt-5.5";
const SMALL_MODEL = "gpt-5.3-codex-spark";
const BASE_MODELS = [
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gpt-5.2",
  "gpt-5",
  "gpt-5-codex",
  "gpt-5-codex-mini",
  "gpt-5.1",
  "gpt-5.1-codex",
  "gpt-5.1-codex-max",
  "gpt-5.1-codex-mini",
  "gpt-5.2-codex",
];
const MODELS = Array.from(new Set([
  ...BASE_MODELS,
  ...BASE_MODELS.map((model) => `${model}${COMPACT_MODEL_SUFFIX}`),
]));

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const [rawKey, inlineValue] = item.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function getDefaultConfigPath() {
  if (process.env.TECH_CC_HUB_API_CONFIG) return process.env.TECH_CC_HUB_API_CONFIG;
  if (platform() === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "tech-cc-hub", "api-config.json");
  }
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", "tech-cc-hub", "api-config.json");
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "tech-cc-hub", "api-config.json");
}

function getDefaultCodexAuthPath() {
  const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
  return join(codexHome, "auth.json");
}

function readSettings(configPath) {
  if (!existsSync(configPath)) return { profiles: [] };
  const parsed = JSON.parse(readFileSync(configPath, "utf8"));
  return Array.isArray(parsed.profiles) ? parsed : { profiles: [parsed] };
}

function writeSettings(configPath, settings) {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(settings, null, 2), "utf8");
}

function buildCodexProfile(previous, credential, args) {
  const profileName = String(args.profileName || previous?.name || "Codex OAuth").trim() || "Codex OAuth";
  const previousModels = Array.isArray(previous?.models) ? previous.models : [];
  const model = typeof previous?.model === "string" && previous.model.trim() ? previous.model.trim() : DEFAULT_MODEL;
  const expertModel = typeof previous?.expertModel === "string" && previous.expertModel.trim()
    ? previous.expertModel.trim()
    : DEFAULT_MODEL;
  const smallModel = typeof previous?.smallModel === "string" && previous.smallModel.trim()
    ? previous.smallModel.trim()
    : SMALL_MODEL;
  const analysisModel = typeof previous?.analysisModel === "string" && previous.analysisModel.trim()
    ? previous.analysisModel.trim()
    : SMALL_MODEL;
  const modelNames = Array.from(new Set([
    ...MODELS,
    ...previousModels.map((item) => typeof item?.name === "string" ? item.name.trim() : "").filter(Boolean),
  ]));

  return {
    id: String(args.profileId || previous?.id || randomUUID()).trim(),
    name: profileName,
    apiKey: JSON.stringify(removeUndefined(credential), null, 2),
    baseURL: BASE_URL,
    model,
    expertModel,
    smallModel,
    imageModel: previous?.imageModel || undefined,
    analysisModel,
    models: modelNames.map((name) => ({
      name,
      contextWindow: previousModels.find?.((item) => item?.name === name)?.contextWindow ?? 200000,
      compressionThresholdPercent: previousModels.find?.((item) => item?.name === name)?.compressionThresholdPercent ?? 70,
      routingWeight: previousModels.find?.((item) => item?.name === name)?.routingWeight,
    })),
    enabled: true,
    provider: "codex",
    apiType: "anthropic",
  };
}

function saveCodexProfile(configPath, credential, args) {
  const settings = readSettings(configPath);
  const profiles = Array.isArray(settings.profiles) ? [...settings.profiles] : [];
  const targetIndex = profiles.findIndex((profile) => (
    (args.profileId && profile?.id === args.profileId)
    || profile?.provider === "codex"
    || profile?.name === "Codex OAuth"
  ));
  const previous = targetIndex >= 0 ? profiles[targetIndex] : undefined;
  const nextProfile = buildCodexProfile(previous, credential, args);
  const nextProfiles = profiles.map((profile) => ({ ...profile }));
  if (targetIndex >= 0) {
    nextProfiles[targetIndex] = nextProfile;
  } else {
    nextProfiles.unshift(nextProfile);
  }
  writeSettings(configPath, { profiles: nextProfiles });
  return nextProfile;
}

function loadCodexCredential(authPath) {
  if (!existsSync(authPath)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(authPath, "utf8"));
  const credential = codexAuthToCredential(parsed);
  if (!credential) {
    return null;
  }
  return credential;
}

function codexAuthToCredential(parsed) {
  if (!isRecord(parsed)) {
    return null;
  }

  const candidates = [];
  if (isRecord(parsed.tokens)) candidates.push(parsed.tokens);
  if (isRecord(parsed.auth)) candidates.push(parsed.auth);
  candidates.push(parsed);

  for (const candidate of candidates) {
    const accessToken = stringValue(candidate.access_token) || stringValue(candidate.accessToken);
    if (!accessToken) {
      continue;
    }

    const idToken = stringValue(candidate.id_token) || stringValue(candidate.idToken);
    const accessClaims = decodeJwtPayload(accessToken);
    const idClaims = idToken ? decodeJwtPayload(idToken) : null;
    const authClaim = isRecord(accessClaims?.[AUTH_CLAIM]) ? accessClaims[AUTH_CLAIM] : null;
    const accountId = stringValue(candidate.account_id)
      || stringValue(candidate.accountId)
      || (authClaim ? stringValue(authClaim.chatgpt_account_id) : "");

    if (!accountId) {
      continue;
    }

    return {
      id_token: idToken || undefined,
      access_token: accessToken,
      refresh_token: stringValue(candidate.refresh_token) || stringValue(candidate.refreshToken) || undefined,
      account_id: accountId,
      email: stringValue(candidate.email) || stringValue(accessClaims?.email) || stringValue(idClaims?.email) || undefined,
      type: "codex",
      expired: normalizeExpiry(candidate.expired)
        || normalizeExpiry(candidate.expires_at)
        || normalizeExpiry(candidate.expiresAt)
        || jwtExpiresAt(accessClaims)
        || undefined,
      last_refresh: stringValue(candidate.last_refresh)
        || stringValue(candidate.lastRefresh)
        || stringValue(parsed.last_refresh)
        || stringValue(parsed.lastRefresh)
        || new Date().toISOString(),
    };
  }

  return null;
}

function normalizeExpiry(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "";
  }
  const millis = value > 10_000_000_000 ? value : value * 1000;
  return new Date(millis).toISOString();
}

function jwtExpiresAt(claims) {
  if (!isRecord(claims) || typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) {
    return "";
  }
  return new Date(claims.exp * 1000).toISOString();
}

function decodeJwtPayload(token) {
  const [, payload] = String(token).split(".");
  if (!payload) {
    return null;
  }
  try {
    const padded = payload.padEnd(payload.length + ((4 - payload.length % 4) % 4), "=");
    const parsed = JSON.parse(Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function runCodexLogin() {
  console.log("No usable Codex ChatGPT login was found. Starting official `codex login`...");
  console.log("Finish the browser login flow, then return to this terminal.");
  await new Promise((resolve, reject) => {
    const child = spawn("codex", ["login"], {
      shell: platform() === "win32",
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`codex login exited with code ${code ?? "unknown"}.`));
      }
    });
  });
}

function removeUndefined(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = String(args.configPath || getDefaultConfigPath());
  const authPath = String(args.codexAuthPath || getDefaultCodexAuthPath());

  let credential = loadCodexCredential(authPath);
  if (!credential && !args.noLogin) {
    await runCodexLogin();
    credential = loadCodexCredential(authPath);
  }

  if (!credential) {
    throw new Error(`Unable to import Codex ChatGPT credentials from ${authPath}. Run \`codex login\` first, then retry this setup command.`);
  }

  const profile = saveCodexProfile(configPath, credential, args);
  console.log("Codex OAuth profile saved from official Codex login.");
  console.log(`Codex auth: ${authPath}`);
  console.log(`Config: ${configPath}`);
  console.log(`Profile: ${profile.name} (${profile.id})`);
  console.log(`Account: ${credential.email || credential.account_id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
