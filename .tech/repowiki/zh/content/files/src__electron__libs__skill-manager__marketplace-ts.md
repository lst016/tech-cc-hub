# src/electron/libs/skill-manager/marketplace.ts

> 模块：`electron` · 语言：`typescript` · 行数：232

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `proxyUrl@12`
- `fetchWithProxy@17`
- `fetchLeaderboard@40`
- `searchSkillssh@71`
- `leaderboardUrl@81`
- `parseLeaderboardHtml@87`
- `parseNextData@93`
- `parseEmbeddedSkillObjects@110`
- `normalizeSkills@136`
- `stringValue@167`
- `numberValue@171`
- `unescapeJsonish@175`
- `searchSkillsmp@181`
- `getCache@212`
- `setCache@224`
- `SKILLSSH_BASE@8`
- `SKILLSSH_API_BASE@10`
- `LEADERBOARD_CACHE_TTL_MS@11`
- `url@14`
- `proxy@19`
- `origProxy@22`
- `cacheKey@42`
- `cached@45`
- `url@51`
- `response@53`
- `skills@60`
- `bounded@73`
- `url@74`
- `response@75`
- `fromNext@89`
- `marker@95`
- `start@96`
- `contentStart@98`
- `end@99`
- `data@103`
- `pageProps@104`
- `seen@113`
- `regex@114`
- `groups@117`
- `source@118`

## 依赖输入

- `./db.js`
- `./types.js`

## 对外暴露

- `LeaderboardType`
- `fetchLeaderboard`
- `searchSkillssh`
- `searchSkillsmp`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
      installs:
... (truncated)
```
