// Source: CV from skills-manager Rust commands/browse.rs + skillssh_api.rs
// Adapted for Electron TypeScript backend

import { getSetting, setSetting } from "./db.js";
import type { SkillsShSkill } from "./types.js";

// ── skills.sh API ──

const SKILLSSH_BASE = "https://skills.sh";
const SKILLSSH_API_BASE = `${SKILLSSH_BASE}/api`;
const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SKILL_DETAIL_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  const cached = getCache(cacheKey);
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

export async function enrichSkillsshSkills(skills: SkillsShSkill[]): Promise<SkillsShSkill[]> {
  return await Promise.all(skills.map(async (skill) => {
    const base = {
      detail_url: buildSkillDetailUrl(skill.source, skill.skill_id),
      repo_url: buildRepoUrl(skill.source),
      zh_description: buildChineseSkillIntro(skill.name || skill.skill_id),
    } satisfies Partial<SkillsShSkill>;

    try {
      const detail = await fetchSkillsshSkillDetail(skill.source, skill.skill_id);
      return { ...skill, ...base, ...detail };
    } catch {
      return { ...skill, ...base };
    }
  }));
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
      description: stringValue(item.description) || undefined,
      detail_url: stringValue(item.url) || stringValue(item.detail_url) || undefined,
      repo_url: stringValue(item.repo_url) || stringValue(item.repository) || undefined,
      installs: numberValue(item.installs),
    });
  }

  return skills;
}

async function fetchSkillsshSkillDetail(source: string, skillId: string): Promise<Partial<SkillsShSkill>> {
  const normalizedSource = normalizeSource(source);
  const normalizedSkillId = skillId.trim().replace(/^\/+|\/+$/g, "");
  const cacheKey = `skill_meta:${normalizedSource}/${normalizedSkillId}`;
  const cached = getCache(cacheKey);
  if (cached) {
    try {
      const cachedDetail = JSON.parse(cached) as Partial<SkillsShSkill>;
      if (cachedDetail.description) {
        return cachedDetail;
      }
      const repoDetail = await fetchGithubSkillMetadata(normalizedSource, normalizedSkillId).catch(() => null);
      if (!repoDetail) {
        return cachedDetail;
      }
      const merged = { ...cachedDetail, ...repoDetail };
      try {
        setCache(cacheKey, JSON.stringify(merged), SKILL_DETAIL_CACHE_TTL_MS);
      } catch {
        // Ignore cache rewrite failures.
      }
      return merged;
    } catch {
      // Ignore a bad cache entry and refresh it.
    }
  }

  const detailUrl = buildSkillDetailUrl(normalizedSource, normalizedSkillId);
  const response = await fetchWithProxy(detailUrl);
  if (!response.ok) {
    throw new Error(`skills.sh detail error: ${response.status} ${response.statusText}`);
  }

  const detail = parseSkillDetailHtml(await response.text(), detailUrl, normalizedSource, normalizedSkillId);
  if (!detail.description) {
    const repoDetail = await fetchGithubSkillMetadata(normalizedSource, normalizedSkillId).catch(() => null);
    if (repoDetail) {
      detail.description = detail.description || repoDetail.description;
      detail.zh_description = detail.zh_description || repoDetail.zh_description;
      detail.repo_url = detail.repo_url || repoDetail.repo_url;
      detail.detail_url = detail.detail_url || repoDetail.detail_url;
    }
  }
  try {
    setCache(cacheKey, JSON.stringify(detail), SKILL_DETAIL_CACHE_TTL_MS);
  } catch {
    // Ignore cache failures and keep the fresh result.
  }
  return detail;
}

function parseSkillDetailHtml(
  html: string,
  fallbackUrl: string,
  source: string,
  skillId: string,
): Partial<SkillsShSkill> {
  const scripts = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    const json = match[1]?.trim();
    if (!json) continue;
    try {
      const parsed = JSON.parse(json);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      for (const record of records) {
        if (!record || typeof record !== "object") continue;
        const type = stringValue((record as { "@type"?: unknown })["@type"]);
        if (type !== "SoftwareApplication") continue;

        const description = sanitizeDescription(stringValue((record as { description?: unknown }).description));
        const detailUrl = stringValue((record as { url?: unknown }).url) || fallbackUrl;
        const repoUrl = buildRepoUrl(source);
        return {
          description: description || undefined,
          zh_description: buildChineseSkillIntro(stringValue((record as { name?: unknown }).name) || skillId),
          detail_url: detailUrl,
          repo_url: repoUrl,
        };
      }
    } catch {
      // Ignore malformed structured data blocks.
    }
  }

  return {
    zh_description: buildChineseSkillIntro(skillId),
    detail_url: fallbackUrl,
    repo_url: buildRepoUrl(source),
  };
}

async function fetchGithubSkillMetadata(source: string, skillId: string): Promise<Partial<SkillsShSkill> | null> {
  const candidates = [
    `skills/${skillId}/SKILL.md`,
    `${skillId}/SKILL.md`,
    `skills/${skillId}/skill.md`,
    `${skillId}/skill.md`,
    `skills/${skillId}/README.md`,
    `${skillId}/README.md`,
    `skills/${skillId}/readme.md`,
    `${skillId}/readme.md`,
  ];

  for (const path of candidates) {
    const content = await fetchGithubRepoText(source, path).catch(() => null);
    if (!content) continue;
    const description = extractMarkdownDescription(content);
    if (!description) continue;
    return {
      description,
      zh_description: buildChineseSkillIntro(skillId),
      repo_url: buildRepoUrl(source),
      detail_url: buildGithubFileUrl(source, path),
    };
  }

  return null;
}

async function fetchGithubRepoText(source: string, path: string): Promise<string> {
  const apiUrl = `https://api.github.com/repos/${normalizeSource(source)}/contents/${path}`;
  const response = await fetchWithProxy(apiUrl);
  if (!response.ok) {
    throw new Error(`GitHub contents error: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as { content?: unknown; encoding?: unknown; download_url?: unknown };
  const encoded = typeof payload.content === "string" ? payload.content : "";
  const encoding = typeof payload.encoding === "string" ? payload.encoding : "";
  if (encoded && encoding === "base64") {
    return Buffer.from(encoded, "base64").toString("utf-8");
  }

  const downloadUrl = stringValue(payload.download_url);
  if (!downloadUrl) {
    throw new Error("GitHub file payload did not contain text content");
  }

  const rawResponse = await fetchWithProxy(downloadUrl);
  if (!rawResponse.ok) {
    throw new Error(`GitHub raw download error: ${rawResponse.status} ${rawResponse.statusText}`);
  }
  return await rawResponse.text();
}

function extractMarkdownDescription(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;

  const frontmatter = extractFrontmatterBlock(trimmed);
  if (frontmatter) {
    const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descriptionMatch?.[1]) {
      return sanitizeDescription(stripWrappingQuotes(descriptionMatch[1]));
    }
  }

  const body = frontmatter ? trimmed.slice(frontmatter.length).trim() : trimmed;
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith(">")) continue;
    if (line.startsWith("|")) continue;
    if (/^[-*]\s/.test(line)) continue;
    if (/^\d+\.\s/.test(line)) continue;
    return sanitizeDescription(line);
  }

  return undefined;
}

function extractFrontmatterBlock(content: string): string | null {
  if (!content.startsWith("---")) return null;
  const endIndex = content.indexOf("\n---", 3);
  if (endIndex < 0) return null;
  return content.slice(0, endIndex + 4);
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

function normalizeSource(source: string): string {
  return source.trim().replace(/^@/, "").replace(/^\/+|\/+$/g, "");
}

function buildSkillDetailUrl(source: string, skillId: string): string {
  return `${SKILLSSH_BASE}/${normalizeSource(source)}/${skillId.trim().replace(/^\/+|\/+$/g, "")}`;
}

function buildRepoUrl(source: string): string {
  return `https://github.com/${normalizeSource(source)}`;
}

function buildGithubFileUrl(source: string, path: string): string {
  return `https://github.com/${normalizeSource(source)}/blob/main/${path.replace(/\\/g, "/")}`;
}

function sanitizeDescription(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function stripWrappingQuotes(input: string): string {
  const trimmed = input.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function buildChineseSkillIntro(input: string): string | undefined {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return undefined;

  const specialCases: Record<string, string> = {
    "find-skills": "帮助查找和安装合适的技能",
    "frontend-design": "聚焦前端界面与体验设计",
    "agent-browser": "为代理补充浏览器自动化能力",
    "web-design-guidelines": "沉淀网页设计规范与指南",
    "vercel-react-best-practices": "总结 React 项目的实践建议",
  };
  if (specialCases[normalized]) return specialCases[normalized];

  const tokenMap: Record<string, string> = {
    agent: "代理",
    ai: "AI",
    app: "应用",
    browser: "浏览器",
    compliance: "合规",
    deploy: "部署",
    design: "设计",
    diagnostics: "诊断",
    find: "查找",
    frontend: "前端",
    guidelines: "指南",
    insights: "洞察",
    lookup: "查询",
    practices: "实践",
    prepare: "准备",
    react: "React",
    registration: "注册",
    resource: "资源",
    skills: "技能",
    skill: "技能",
    storage: "存储",
    validate: "校验",
    web: "网页",
  };

  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return undefined;

  const translated = tokens
    .map((token) => tokenMap[token])
    .filter((value): value is string => Boolean(value));

  if (translated.length < Math.max(2, Math.ceil(tokens.length / 2))) {
    return undefined;
  }

  return translated.join("");
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

function getCache(key: string): string | null {
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

function setCache(key: string, value: string, ttlMs = LEADERBOARD_CACHE_TTL_MS): void {
  const entry: CacheEntry = {
    value,
    expires_at: Date.now() + ttlMs,
  };
  setSetting(`cache:${key}`, JSON.stringify(entry));
}
