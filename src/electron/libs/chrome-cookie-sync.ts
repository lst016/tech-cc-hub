import { existsSync, readFileSync } from "fs";
import { copyFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir, homedir } from "os";
import { execFile } from "child_process";
import { createDecipheriv, createHash } from "crypto";
import { promisify } from "util";
import Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChromeCookie {
  url: string;
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expirationDate?: number;
  sameSite?: "unspecified" | "no_restriction" | "lax" | "strict";
}

interface RawCookieRow {
  host_key: string;
  name: string;
  encrypted_value: Buffer;
  path: string;
  expires_utc: number;
  is_secure: number;
  is_httponly: number;
  samesite: number;
}

export type ChromeCookieSyncStatus =
  | "ok"
  | "unsupported"
  | "unavailable"
  | "locked"
  | "error";

export interface ChromeCookieSyncResult {
  status: ChromeCookieSyncStatus;
  cookies: ChromeCookie[];
  profilesScanned: number;
  rowsRead: number;
  decrypted: number;
  skipped: number;
  errors: string[];
}

type ChromeProfileCandidate = {
  name: string;
  dirName: string;
  cookiePath: string;
};

type CookieRowsResult = {
  rows: RawCookieRow[];
  error?: string;
  locked?: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHROME_COOKIE_TMP_PREFIX = "tech-cc-hub-chrome-cookies";

// Chrome epoch offset: microseconds between 1601-01-01 and 1970-01-01
const CHROME_EPOCH_OFFSET = 11644473600000000n;

// ---------------------------------------------------------------------------
// Master key cache
// ---------------------------------------------------------------------------

let cachedMasterKey: Buffer | null = null;
let pendingMasterKey: Promise<Buffer | null> | null = null;
const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Check whether Chrome is installed (Windows only).
 */
export function isChromeInstalled(): boolean {
  if (process.platform !== "win32") return false;
  const localStatePath = getChromeLocalStatePath();
  return existsSync(localStatePath) && getChromeProfileCandidates().length > 0;
}

/**
 * Retrieve Chrome cookies matching the given domain, converted to Electron-compatible format.
 * Returns a structured result so callers can distinguish "no matching cookies"
 * from "Chrome has the database locked".
 */
export async function getChromeCookies(domain: string): Promise<ChromeCookieSyncResult> {
  if (process.platform !== "win32") return emptyResult("unsupported");

  try {
    const masterKey = await getMasterKey();
    if (!masterKey) return emptyResult("unavailable", ["Chrome master key is unavailable"]);

    const profiles = getChromeProfileCandidates();
    if (!profiles.length) return emptyResult("unavailable", ["Chrome cookie store is unavailable"]);

    const results: ChromeCookie[] = [];
    const errors: string[] = [];
    let rowsRead = 0;
    let skipped = 0;
    let sawLockedProfile = false;

    for (const profile of profiles) {
      const readResult = await readCookieRows(profile, domain);
      if (readResult.locked) sawLockedProfile = true;
      if (readResult.error) errors.push(`${profile.name}: ${readResult.error}`);
      if (!readResult.rows.length) continue;
      rowsRead += readResult.rows.length;

      for (const row of readResult.rows) {
        try {
          const value = decryptCookieValue(row, masterKey);
          if (value === null) {
            skipped += 1;
            continue;
          }

          results.push({
            url: buildCookieUrl(row.host_key, row.path, row.is_secure === 1),
            name: row.name,
            value,
            domain: row.host_key,
            path: row.path,
            secure: row.is_secure === 1,
            httpOnly: row.is_httponly === 1,
            expirationDate: convertChromeTimestamp(row.expires_utc),
            sameSite: mapSameSite(row.samesite),
          });
        } catch {
          skipped += 1;
        }
      }

      if (results.length > 0) break;
    }

    const status: ChromeCookieSyncStatus = results.length > 0
      ? "ok"
      : rowsRead > 0 && skipped > 0
        ? "error"
        : rowsRead > 0
          ? "ok"
      : sawLockedProfile
        ? "locked"
        : errors.length > 0
          ? "error"
          : "ok";

    return {
      status,
      cookies: results,
      profilesScanned: profiles.length,
      rowsRead,
      decrypted: results.length,
      skipped,
      errors,
    };
  } catch (err) {
    const message = (err as Error).message;
    console.error("[chrome-cookie-sync] Failed to read Chrome cookies:", message);
    return emptyResult("error", [message]);
  }
}

/**
 * Backward-compatible spelling for existing imports.
 */
export async function getChromeCookes(domain: string): Promise<ChromeCookie[]> {
  const result = await getChromeCookies(domain);
  return result.cookies;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emptyResult(status: ChromeCookieSyncStatus, errors: string[] = []): ChromeCookieSyncResult {
  return {
    status,
    cookies: [],
    profilesScanned: 0,
    rowsRead: 0,
    decrypted: 0,
    skipped: 0,
    errors,
  };
}

function getChromeUserDataPath(): string {
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  return join(localAppData, "Google", "Chrome", "User Data");
}

function getChromeLocalStatePath(): string {
  return join(getChromeUserDataPath(), "Local State");
}

function getChromeProfileCandidates(): ChromeProfileCandidate[] {
  const userDataPath = getChromeUserDataPath();
  const localStatePath = getChromeLocalStatePath();
  const orderedDirNames: string[] = [];

  if (existsSync(localStatePath)) {
    try {
      const localState = JSON.parse(readFileSync(localStatePath, "utf-8"));
      const lastUsed = typeof localState?.profile?.last_used === "string"
        ? localState.profile.last_used
        : "";
      if (lastUsed) orderedDirNames.push(lastUsed);
      const infoCache = localState?.profile?.info_cache;
      if (infoCache && typeof infoCache === "object" && !Array.isArray(infoCache)) {
        orderedDirNames.push(...Object.keys(infoCache));
      }
    } catch {
      // Fall back to Default below.
    }
  }

  orderedDirNames.push("Default");

  const seen = new Set<string>();
  return orderedDirNames
    .filter((dirName) => {
      if (!dirName || seen.has(dirName)) return false;
      seen.add(dirName);
      return true;
    })
    .map((dirName) => ({
      name: dirName,
      dirName,
      cookiePath: join(userDataPath, dirName, "Network", "Cookies"),
    }))
    .filter((profile) => existsSync(profile.cookiePath));
}

/**
 * Extract and decrypt the AES master key from Chrome's Local State via DPAPI.
 * The result is cached for the lifetime of the process.
 */
async function getMasterKey(): Promise<Buffer | null> {
  if (cachedMasterKey) return cachedMasterKey;

  if (pendingMasterKey) return await pendingMasterKey;
  pendingMasterKey = loadMasterKey();
  try {
    return await pendingMasterKey;
  } finally {
    pendingMasterKey = null;
  }
}

async function loadMasterKey(): Promise<Buffer | null> {

  const localStatePath = getChromeLocalStatePath();
  if (!existsSync(localStatePath)) {
    console.error("[chrome-cookie-sync] Chrome Local State not found");
    return null;
  }

  let encryptedKeyB64: string;
  try {
    const localState = JSON.parse(readFileSync(localStatePath, "utf-8"));
    encryptedKeyB64 = localState?.os_crypt?.encrypted_key;
    if (!encryptedKeyB64) {
      console.error("[chrome-cookie-sync] encrypted_key not found in Local State");
      return null;
    }
  } catch {
    console.error("[chrome-cookie-sync] Failed to parse Local State JSON");
    return null;
  }

  // Base64 decode and strip "DPAPI" prefix (first 5 bytes)
  const encryptedKey = Buffer.from(encryptedKeyB64, "base64").subarray(5);

  // Decrypt via DPAPI using PowerShell
  const decrypted = await dpapiDecrypt(encryptedKey);
  if (!decrypted) return null;

  cachedMasterKey = decrypted;
  return cachedMasterKey;
}

/**
 * Use PowerShell + DPAPI to decrypt a byte array.
 */
async function dpapiDecrypt(encrypted: Buffer): Promise<Buffer | null> {
  const b64Input = encrypted.toString("base64");

  const psScript = [
    "Add-Type -AssemblyName System.Security;",
    `$bytes = [Convert]::FromBase64String('${b64Input}');`,
    "$dec = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser);",
    "[Convert]::ToBase64String($dec)",
  ].join(" ");

  try {
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      psScript,
    ], {
      encoding: "utf-8",
      timeout: 10000,
      windowsHide: true,
    });

    return Buffer.from(stdout.trim(), "base64");
  } catch (err) {
    console.error("[chrome-cookie-sync] DPAPI decryption failed:", (err as Error).message);
    return null;
  }
}

/**
 * Copy the Chrome Cookies DB to a temp location (to bypass file lock)
 * and read rows matching the domain.
 */
async function readCookieRows(profile: ChromeProfileCandidate, domain: string): Promise<CookieRowsResult> {
  const cookiePath = profile.cookiePath;
  if (!existsSync(cookiePath)) {
    const message = "Chrome Cookies DB not found";
    console.error("[chrome-cookie-sync]", message);
    return { rows: [], error: message };
  }

  const tempPath = join(tmpdir(), `${CHROME_COOKIE_TMP_PREFIX}-${process.pid}-${Date.now()}-${profile.dirName}`);
  try {
    await copyFile(cookiePath, tempPath);
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    const message = `Failed to copy Cookies DB: ${error.message}`;
    console.error("[chrome-cookie-sync]", message);
    return { rows: [], error: message, locked: isFileLockedError(error) };
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(tempPath, { readonly: true });

    const candidates = buildChromeCookieDomainCandidates(domain);
    if (!candidates.length) return { rows: [] };
    const placeholders = candidates.map(() => "?").join(", ");

    const rows = db.prepare(`
      SELECT host_key, name, encrypted_value, path, expires_utc, is_secure, is_httponly, samesite
      FROM cookies
      WHERE host_key IN (${placeholders})
    `).all(...candidates) as RawCookieRow[];

    return { rows };
  } catch (err) {
    const message = `SQLite read failed: ${(err as Error).message}`;
    console.error("[chrome-cookie-sync]", message);
    return { rows: [], error: message };
  } finally {
    try { db?.close(); } catch { /* ignore */ }
    try { await unlink(tempPath); } catch { /* ignore */ }
  }
}

function isFileLockedError(error: NodeJS.ErrnoException): boolean {
  return error.code === "EBUSY" || error.code === "EPERM" || error.code === "EACCES";
}

export function buildChromeCookieDomainCandidates(domain: string): string[] {
  const normalized = domain.trim().toLowerCase().replace(/^\.+/, "");
  if (!normalized) return [];
  if (normalized === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)) {
    return [normalized];
  }

  const labels = normalized.split(".").filter(Boolean);
  const candidates: string[] = [];
  for (let index = 0; index <= labels.length - 2; index += 1) {
    const suffix = labels.slice(index).join(".");
    if (index === 0) candidates.push(suffix);
    candidates.push(`.${suffix}`);
  }
  return Array.from(new Set(candidates));
}

/**
 * Decrypt a single cookie value using AES-256-GCM.
 * Format: "v10" or "v20" (3 bytes) + nonce (12 bytes) + ciphertext + auth_tag (16 bytes)
 */
function decryptCookieValue(row: RawCookieRow, masterKey: Buffer): string | null {
  const encrypted = row.encrypted_value;
  if (!encrypted || encrypted.length < 31) {
    // Too short to contain prefix + nonce + tag; might be empty/unencrypted
    return encrypted?.toString("utf-8") || "";
  }

  // Check for v10/v20 prefix
  const prefix = encrypted.subarray(0, 3).toString("utf-8");
  if (prefix !== "v10" && prefix !== "v20") {
    // Not AES-GCM encrypted - might be DPAPI-encrypted or plaintext
    return encrypted.toString("utf-8") || "";
  }

  const nonce = encrypted.subarray(3, 15);
  const ciphertextWithTag = encrypted.subarray(15);

  // Last 16 bytes are the auth tag
  if (ciphertextWithTag.length < 16) return null;

  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);

  try {
    const decipher = createDecipheriv("aes-256-gcm", masterKey, nonce);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return stripChromeCookieHostHash(decrypted, row.host_key).toString("utf-8");
  } catch {
    return null;
  }
}

export function stripChromeCookieHostHash(value: Buffer, hostKey: string): Buffer {
  if (value.length < 33) return value;
  const digest = createHash("sha256").update(hostKey).digest();
  return value.subarray(0, digest.length).equals(digest)
    ? value.subarray(digest.length)
    : value;
}

/**
 * Convert Chrome's timestamp (microseconds since 1601-01-01) to Unix epoch seconds.
 * Returns undefined for session cookies (expires_utc === 0).
 */
function convertChromeTimestamp(chromeTimestamp: number): number | undefined {
  if (!chromeTimestamp || chromeTimestamp === 0) return undefined;

  const microseconds = BigInt(chromeTimestamp);
  const unixMicroseconds = microseconds - CHROME_EPOCH_OFFSET;
  const unixSeconds = Number(unixMicroseconds / 1000000n);

  // Sanity check: must be a reasonable timestamp (after 2000-01-01)
  if (unixSeconds < 946684800) return undefined;

  return unixSeconds;
}

/**
 * Map Chrome's SameSite integer to Electron cookie string enum.
 * Chrome values: -1 = unspecified, 0 = no_restriction, 1 = lax, 2 = strict
 */
function mapSameSite(samesite: number): ChromeCookie["sameSite"] {
  switch (samesite) {
    case 0: return "no_restriction";
    case 1: return "lax";
    case 2: return "strict";
    default: return "unspecified";
  }
}

/**
 * Build a URL suitable for Electron's cookies.set() from domain/path/secure info.
 */
function buildCookieUrl(domain: string, path: string, secure: boolean): string {
  const scheme = secure ? "https" : "http";
  // Strip leading dot for URL construction
  const host = domain.startsWith(".") ? domain.substring(1) : domain;
  return `${scheme}://${host}${path}`;
}
