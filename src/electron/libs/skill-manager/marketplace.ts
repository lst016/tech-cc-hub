// Source: CV from skills-manager Rust commands/browse.rs + skillssh_api.rs
// Adapted for Electron TypeScript backend

import { getSetting, setSetting, getSetting as getCacheRaw } from "./db.js";
import type { SkillsShSkill } from "./types.js";

// ── skills.sh API ──

const SKILLSSH_BASE = "https://skills.sh";
const SKILLSSH_API_BASE = `${SKILLSSH_BASE}/api`;
const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function proxyUrl(): string | undefined {
  const url = getSetting("proxy_url");
  return url || undefined;
}

async function fetchWithProxy(url: string): Promise<Response> {
  const proxy = proxyUrl();
  if (proxy) {
    // Simple proxy support via environment variable
    const origProxy = process.env.HTTPS_PROXY;
    try {
      process.env.HTTPS_PROXY = proxy;
      return await fetch(url);
    } finally {
      if (origProxy !== undefined) {
        process.env.HTTPS_PROXY = origProxy;
      } else {
        delete process.env.HTTPS_PROXY;
      }
    }
  }
  return fetch(url);
}

// ── Leaderboard ──

export type LeaderboardType = "hot" | "trending" | "alltime";

export async function fetchLeaderboard(board: string): Promise<SkillsShSkill[]> {
  const cacheKey = `leaderboard_${board}`;

  // Check cache
  const cached = getCache(cacheKey, LEADERBOARD_CACHE_TTL_MS);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch { /* ignore */ }
  }

  const url = leaderboardUrl(board);
  const response = await fetchWithProxy(url);
  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`skills.sh API error: ${response.status} ${response.statusText}`);
  }
  const skills = parseLeaderboardHtml(await response.text());

  // Update cache
  try {
    setCache(cacheKey, JSON.stringify(skills));
  } catch { /* ignore */ }

  return skills;
}

// ── Search ──

export async function searchSkillssh(query: string, limit?: number): Promise<SkillsShSkill[]> {
  const bounded = Math.max(1, Math.min(limit || 60, 300));
  const url = `${SKILLSSH_API_BASE}/search?q=${encodeURIComponent(query)}&limit=${bounded}`;
  const response = await fetchWithProxy(url);
  if (!response.ok) {
    throw new Error(`skills.sh search error: ${response.status} ${response.statusText}`);
  }
  return normalizeSkills(await response.json());
}

function leaderboardUrl(board: string): string {
  if (board === "trending") return `${SKILLSSH_BASE}/trending`;
  if (board === "hot") return `${SKILLSSH_BASE}/hot`;
  return `${SKILLSSH_BASE}/`;
}

function parseLeaderboardHtml(html: string): SkillsShSkill[] {
  const fromNext = parseNextData(html);
  if (fromNext.length > 0) return fromNext;
  return parseEmbeddedSkillObjects(html);
}

function parseNextData(html: string): SkillsShSkill[] {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start < 0) return [];
  const contentStart = start + marker.length;
  const end = html.indexOf("</script>", contentStart);
  if (end < 0) return [];

  try {
    const data = JSON.parse(html.slice(contentStart, end));
    const pageProps = data?.props?.pageProps;
    return normalizeSkills(pageProps?.initialSkills ?? pageProps?.skills ?? pageProps?.items ?? []);
  } catch {
    return [];
  }
}

function parseEmbeddedSkillObjects(html: string): SkillsShSkill[] {
  const skills: SkillsShSkill[] = [];
  const seen = new Set<string>();
  const regex = /(?:\\)?"source(?:\\)?":(?:\\)?"(?<source>[^"\\]+)(?:\\)?"(?:[^{}]|\\.)*?(?:(?:\\)?"skillId(?:\\)?"|(?:\\)?"skill_id(?:\\)?"):(?:\\)?"(?<skill_id>[^"\\]+)(?:\\)?"(?:[^{}]|\\.)*?(?:\\)?"name(?:\\)?":(?:\\)?"(?<name>[^"\\]*)(?:\\)?"(?:[^{}]|\\.)*?(?:\\)?"installs(?:\\)?":(?<installs>\d+)/g;

  for (const match of html.matchAll(regex)) {
    const groups = match.groups;
    const source = unescapeJsonish(groups?.source ?? "");
    const skillId = unescapeJsonish(groups?.skill_id ?? "");
    if (!source || !skillId) continue;
    const id = `${source}/${skillId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    skills.push({
      id,
      skill_id: skillId,
      name: unescapeJsonish(groups?.name ?? "") || skillId,
      source,
      installs: Number(groups?.installs ?? 0) || 0,
    });
  }

  return skills;
}

function normalizeSkills(payload: unknown): SkillsShSkill[] {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { skills?: unknown })?.skills)
      ? (payload as { skills: unknown[] }).skills
      : [];

  const seen = new Set<string>();
  const skills: SkillsShSkill[] = [];

  for (const item of raw as Array<Record<string, unknown>>) {
    const source = stringValue(item.source);
    const skillId = stringValue(item.skill_id) || stringValue(item.skillId) || stringValue(item.id).split("/").pop() || "";
    if (!source || !skillId) continue;

    const id = `${source}/${skillId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    skills.push({
      id,
      skill_id: skillId,
      name: stringValue(item.name) || skillId,
      source,
      installs: numberValue(item.installs),
    });
  }

  return skills;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function unescapeJsonish(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
}

// ── SkillsMP AI search ──

export async function searchSkillsmp(
  query: string,
  ai?: boolean,
  page?: number,
  limit?: number,
): Promise<SkillsShSkill[]> {
  const apiKey = getSetting("skillsmp_api_key");
  if (!apiKey) {
    throw new Error("SkillsMP API key not configured");
  }

  const baseUrl = "https://api.skillsmp.com/v1";
  const mode = ai ? "ai" : "keyword";
  const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&mode=${mode}&page=${page || 1}&limit=${limit || 20}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`SkillsMP API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// ── Cache helpers (simple JSON file cache via db settings) ──

interface CacheEntry {
  value: string;
  expires_at: number;
}

function getCache(key: string, ttlMs: number): string | null {
  try {
    const raw = getSetting(`cache:${key}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() > entry.expires_at) return null;
    return entry.value;
  } catch {
    return null;
  }
}

function setCache(key: string, value: string): void {
  const entry: CacheEntry = {
    value,
    expires_at: Date.now() + LEADERBOARD_CACHE_TTL_MS,
  };
  setSetting(`cache:${key}`, JSON.stringify(entry));
}
