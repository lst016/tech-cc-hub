# scripts/sync-claude-code-compat.mjs

> 模块：`scripts` · 语言：`javascript` · 行数：200

## 文件职责

从claudelog.com抓取Claude Code changelog并生成TypeScript兼容性注册表

## 关键符号

- `extractSections@0 - 解析HTML页面，按版本号提取changelog段落`
- `extractCommandItems@0 - 从changelog条目中提取/command命令和agents/plugin关键词`
- `buildPromptHints@0 - 根据命令描述生成prompt提示符注册表`
- `renderRegistry@0 - 将registry对象渲染为TypeScript源码并写入文件`

## 依赖输入

- `node:fs/promises`
- `node:path`

## 对外暴露

- `ClaudeCodeCompatRegistry`
- `CLAUDE_CODE_COMPAT_REGISTRY`
- `CLAUDE_CODE_COMPAT_COMMAND_ITEMS`
- `buildClaudeCodeCompatPromptAppend`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SOURCE_URL = "https://claudelog.com/claude-code-changelog/";
const OUTPUT_FILE = resolve("src/electron/libs/claude-code-compat-registry.ts");

const args = parseArgs(process.argv.slice(2));
const requestedVersion = normalizeVersion(args.version ?? args.v);

const html = await fetchText(SOURCE_URL);
const sections = extractSections(html);
const section = requestedVersion
  ? sections.find((item) => item.version === requestedVersion)
  : sections[0];

if (!section) {
  const suffix = requestedVersion ? ` for v${requestedVersion}` : "";
  console.error(`No Claude Code changelog section found${suffix}.`);
  process.exit(1);
}

const registry = {
  sourceUrl: SOURCE_URL,
  sourceVersion: section.version,
  sourceDate: section.date,
  generatedAt: new Date().toISOString(),
  commandItems: extractCommandItems(section.items),
  promptHints: buildPromptHints(section.items),
};

await writeFile(OUTPUT_FILE, renderRegistry(registry), "utf8");
console.log(`Wrote ${OUTPUT_FILE} from Claude Code v${section.version}.`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq >= 0) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      out[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function normalizeVersion(input) {
  if (!input) return "";
  const raw = String(input).trim().replace(/^v/i, "");
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return "";
  if (match[1] === "0" && match[2] === "2") return `2.1.${match[3]}`;
  return raw;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "tech-cc-hub-claude-compat-sync/1.0",
      accept: "text/html, text/plain;q=0.9, */*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  return response.text();
}

function extractSections(html) {
  const normalized = decodeHtmlEntities(html)
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<h[1-6][^>]*>/gi, "\n### ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n");

  const matches = [...normalized.matchAll(/(?:^|\n)\s*#{0,6}\s*(?:Claude Code\s*)?v(2\.1\.(\d+))\b[^\n]*/gi)];
  return matches.map((match, index) => {
    const version = match[1];
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    const body = normalized.slice(start, end);
    const items = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim().replace(/\s+/g, " "))
      .filter(Boolean);
    const dateMatch = body.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/);
    return { version, date: dateMatch?.[0] ?? "", items };
  });
}

function extractCommandItems(items) {
  const commands = new Map();
  for (const item of items) {
    const text = stripTicks(item);
    for (const match of text.matchAll(/\/([a-z][a-z0-9-]*)\b/gi)) {
      addCommand(commands, match[1], text);
    }
    if (/\bclaude\s+agents\b/i.test(text)) {
      addCommand(commands, "agents", text);
    }
    if (/\bclaude\s+plugin\s+details\b/i.test(text)) {
      addCommand(commands, "plugin", text);
    }
  }
  return Array.from(commands.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function addCommand(commands, rawName, description) {
  const name = rawName.trim().replace(/^\/+/, "").toLowerCase();
  if (!name) return;
  if (!commands.has(name)) {
    commands.set(name, { name, description });
  }
}

function buildPromptHi
... (truncated)
```
