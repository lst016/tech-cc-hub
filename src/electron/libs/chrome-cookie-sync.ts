import { existsSync, copyFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir, homedir } from "os";
import { execSync } from "child_process";
import { createDecipheriv } from "crypto";
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHROME_COOKIE_TMP = join(tmpdir(), "tech-cc-hub-chrome-cookies-tmp");

// Chrome epoch offset: microseconds between 1601-01-01 and 1970-01-01
const CHROME_EPOCH_OFFSET = 11644473600000000n;

// ---------------------------------------------------------------------------
// Master key cache
// ---------------------------------------------------------------------------

let cachedMasterKey: Buffer | null = null;

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Check whether Chrome is installed (Windows only).
 */
export function isChromeInstalled(): boolean {
  if (process.platform !== "win32") return false;
  const cookiePath = getChromeCookiePath();
  const localStatePath = getChromeLocalStatePath();
  return existsSync(cookiePath) && existsSync(localStatePath);
}

/**
 * Retrieve Chrome cookies matching the given domain, converted to Electron-compatible format.
 * Returns an empty array on any error or non-Windows platform.
 */
export async function getChromeCookes(domain: string): Promise<ChromeCookie[]> {
  if (process.platform !== "win32") return [];

  try {
    const masterKey = getMasterKey();
    if (!masterKey) return [];

    const rows = readCookieRows(domain);
    if (!rows.length) return [];

    const results: ChromeCookie[] = [];

    for (const row of rows) {
      try {
        const value = decryptCookieValue(row.encrypted_value, masterKey);
        if (value === null) continue;

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
        // Skip individual cookie decryption failures silently
      }
    }

    return results;
  } catch (err) {
    console.error("[chrome-cookie-sync] Failed to read Chrome cookies:", (err as Error).message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getChromeCookiePath(): string {
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  return join(localAppData, "Google", "Chrome", "User Data", "Default", "Network", "Cookies");
}

function getChromeLocalStatePath(): string {
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  return join(localAppData, "Google", "Chrome", "User Data", "Local State");
}

/**
 * Extract and decrypt the AES master key from Chrome's Local State via DPAPI.
 * The result is cached for the lifetime of the process.
 */
function getMasterKey(): Buffer | null {
  if (cachedMasterKey) return cachedMasterKey;

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
  const decrypted = dpapiDecrypt(encryptedKey);
  if (!decrypted) return null;

  cachedMasterKey = decrypted;
  return cachedMasterKey;
}

/**
 * Use PowerShell + DPAPI to decrypt a byte array.
 */
function dpapiDecrypt(encrypted: Buffer): Buffer | null {
  const b64Input = encrypted.toString("base64");

  const psScript = [
    "Add-Type -AssemblyName System.Security;",
    `$bytes = [Convert]::FromBase64String('${b64Input}');`,
    "$dec = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser);",
    "[Convert]::ToBase64String($dec)",
  ].join(" ");

  try {
    const stdout = execSync(`powershell -NoProfile -NonInteractive -Command "${psScript}"`, {
      encoding: "utf-8",
      timeout: 10000,
      windowsHide: true,
    }).trim();

    return Buffer.from(stdout, "base64");
  } catch (err) {
    console.error("[chrome-cookie-sync] DPAPI decryption failed:", (err as Error).message);
    return null;
  }
}

/**
 * Copy the Chrome Cookies DB to a temp location (to bypass file lock)
 * and read rows matching the domain.
 */
function readCookieRows(domain: string): RawCookieRow[] {
  const cookiePath = getChromeCookiePath();
  if (!existsSync(cookiePath)) {
    console.error("[chrome-cookie-sync] Chrome Cookies DB not found");
    return [];
  }

  // Copy to temp to bypass Chrome's file lock
  try {
    copyFileSync(cookiePath, CHROME_COOKIE_TMP);
  } catch (err) {
    console.error("[chrome-cookie-sync] Failed to copy Cookies DB:", (err as Error).message);
    return [];
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(CHROME_COOKIE_TMP, { readonly: true });

    // Normalize domain for LIKE query: ensure we match both .example.com and example.com
    const normalizedDomain = domain.startsWith(".") ? domain.substring(1) : domain;

    const rows = db.prepare(`
      SELECT host_key, name, encrypted_value, path, expires_utc, is_secure, is_httponly, samesite
      FROM cookies
      WHERE host_key LIKE ? OR host_key LIKE ?
    `).all(`%${normalizedDomain}`, `.${normalizedDomain}`) as RawCookieRow[];

    return rows;
  } catch (err) {
    console.error("[chrome-cookie-sync] SQLite read failed:", (err as Error).message);
    return [];
  } finally {
    try { db?.close(); } catch { /* ignore */ }
    try { unlinkSync(CHROME_COOKIE_TMP); } catch { /* ignore */ }
  }
}

/**
 * Decrypt a single cookie value using AES-256-GCM.
 * Format: "v10" or "v20" (3 bytes) + nonce (12 bytes) + ciphertext + auth_tag (16 bytes)
 */
function decryptCookieValue(encrypted: Buffer, masterKey: Buffer): string | null {
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
    return decrypted.toString("utf-8");
  } catch {
    return null;
  }
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
