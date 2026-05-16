# pro-workflow/skills/wiki-research-loop/scripts/research-loop.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：368

## 文件职责

Core research loop for automated wiki building. Manages seeds, fetches sources, compiles pages with novelty scoring, derives follow-up questions. Handles concurrency, source-fetchers, and seed queue.

## 关键符号

- `loadFetchers@0 - Loads source fetcher modules from skills/scripts/source-fetchers or ~/.pro-workflow/fetchers`
- `jaccardNovelty@0 - Calculates Jaccard similarity between tokenized texts to score content novelty`
- `compilePage@0 - Compiles markdown page from seed and fetched docs, extracts claims, formats with sources and citations`
- `deriveFollowUps@0 - Generates follow-up questions from compiled page content`
- `runOne@0 - Processes single seed: loads fetchers, fetches docs, compiles page, calculates novelty, upserts to store`
- `cmdSeed/cmdRun/cmdStatus@0 - CLI commands for seed management and loop execution control`

## 依赖输入

- `fs`
- `path`
- `os`
- `crypto`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILL_ROOT = path.resolve(__dirname, '..');
const STOP_FILE = path.join(os.homedir(), '.pro-workflow', 'STOP');

function getStore() {
  const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
  if (!fs.existsSync(distPath)) {
    die(`built store missing at ${distPath}. Run: cd ${PRO_WORKFLOW_ROOT} && npm install && npm run build`);
  }
  return require(distPath).createStore();
}

function die(msg) { console.error(`[research-loop] ${msg}`); process.exit(1); }
function log(msg) { console.error(`[research-loop] ${msg}`); }

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

function loadFetchers(names) {
  const fetchers = {};
  const dirs = [
    path.join(SKILL_ROOT, 'scripts', 'source-fetchers'),
    path.join(os.homedir(), '.pro-workflow', 'fetchers'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.js')) continue;
      const name = path.basename(f, '.js');
      if (names && !names.includes(name)) continue;
      try {
        fetchers[name] = require(path.join(dir, f));
      } catch (e) {
        log(`failed to load fetcher ${name}: ${e.message}`);
      }
    }
  }
  return fetchers;
}

function readWikiConfig(rootPath) {
  const cfgPath = path.join(rootPath, 'wiki.config.md');
  if (!fs.existsSync(cfgPath)) return {};
  const raw = fs.readFileSync(cfgPath, 'utf8');
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const obj = {};
  let nested = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const indent = line.match(/^(\s*)/)[1].length;
    const trimmed = line.trim();
    const kv = trimmed.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const k = kv[1], v = kv[2];
    if (indent === 0) {
      if (v === '') { obj[k] = {}; nested = obj[k]; }
      else { obj[k] = parseScalar(v); nested = null; }
    } else if (nested) {
      nested[k] = parseScalar(v);
    }
  }
  return obj;
}

function parseScalar(v) {
  if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function tokenize(text) {
  return new Set((text.toLowerCase().match(/[a-z0-9_]{4,}/g) || []));
}

function jaccardNovelty(newText, prevTexts) {
  const a = tokenize(newText);
  if (a.size === 0) return 1;
  const b = new Set();
  for (const p of prevTexts) tokenize(p).forEach(t => b.add(t));
  if (b.size === 0) return 1;
  let overlap = 0;
  for (const t of a) if (b.has(t)) overlap++;
  return 1 - (overlap / a.size);
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'page';
}

function compilePage(seed, docs, prevPages) {
  const claims = [];
  const seen = new Set();
  for (const d of docs) {
    const text = d.content || '';
    for (const sentence of text.split(/(?<=[.!?])\s+/).slice(0, 8)) {
      const trimmed = sentence.trim();
      if (trimmed.length < 40 || trimmed.length > 400) continue;
      const key = trimmed.toLowerCase().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      claims.push({ text: trimmed, source: d.url || d.title || 'unknown' });
    }
  }
  if (!claims.length) return null;

  const novelty = jaccardNovelty(claims.map(c => c.text).join(' '), prevPages.map(p => p.content || ''));

  const lines = [];
  lines.push(`# ${seed.query}`);
  lines.push('');
  lines.push(`> seed-${seed.id} · depth ${seed.depth} · novelty ${(novelty * 100).toFixed(0)}%`);
  lines.push('');
  lines.push('## So
... (truncated)
```
