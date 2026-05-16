# pro-workflow/scripts/research-tick.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：77

## 文件职责

Periodic tick script for wiki research automation. Reads wiki.config.md, finds opted-in wikis with pending seeds, spawns research-loop.js to process one page per tick.

## 关键符号

- `readWikiConfig@0 - Parses YAML frontmatter from wiki.config.md into structured object`
- `tick@0 - Main logic: checks STOP file, finds wiki with auto_research.enabled and pending seeds, spawns research-loop`

## 依赖输入

- `fs`
- `path`
- `os`
- `child_process`

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
const { spawnSync } = require('child_process');

const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..');
const STOP_FILE = path.join(os.homedir(), '.pro-workflow', 'STOP');
const LOOP_SCRIPT = path.join(PRO_WORKFLOW_ROOT, 'skills', 'wiki-research-loop', 'scripts', 'research-loop.js');
const TICK_LOG = path.join(os.homedir(), '.pro-workflow', 'tick.log');

function getStore() {
  const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
  if (!fs.existsSync(distPath)) { console.error('build store first'); process.exit(1); }
  return require(distPath).createStore();
}

function readWikiConfig(rootPath) {
  const cfgPath = path.join(rootPath, 'wiki.config.md');
  if (!fs.existsSync(cfgPath)) return {};
  const raw = fs.readFileSync(cfgPath, 'utf8');
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const obj = {}; let nested = null;
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue;
    const indent = line.match(/^(\s*)/)[1].length;
    const trimmed = line.trim();
    const kv = trimmed.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const k = kv[1], v = kv[2];
    const parsed = v === '' ? {} : (v === 'true' ? true : v === 'false' ? false : (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v));
    if (indent === 0) { obj[k] = parsed; nested = (typeof parsed === 'object') ? obj[k] : null; }
    else if (nested) nested[k] = parsed;
  }
  return obj;
}

function appendLog(line) {
  fs.mkdirSync(path.dirname(TICK_LOG), { recursive: true });
  fs.appendFileSync(TICK_LOG, `[${new Date().toISOString()}] ${line}\n`);
}

function tick() {
  if (fs.existsSync(STOP_FILE)) { appendLog('skip: STOP file present'); return { skipped: 'stop' }; }
  const store = getStore();
  let target = null;
  try {
    const wikis = store.listWikis();
    for (const w of wikis) {
      const cfg = readWikiConfig(w.root_path);
      const auto = cfg.auto_research || {};
      if (!auto.enabled) continue;
      const pending = store.db.prepare(`SELECT COUNT(*) AS n FROM wiki_seeds WHERE wiki_slug = ? AND status = 'pending'`).get(w.slug);
      if (!pending || !pending.n) continue;
      target = w; break;
    }
  } finally { store.close(); }

  if (!target) { appendLog('skip: no opted-in wiki with pending seeds'); return { skipped: 'no-target' }; }

  appendLog(`tick: running ${target.slug}`);
  const r = spawnSync('node', [LOOP_SCRIPT, 'run', target.slug, '--max-pages', '1'], {
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
    killSignal: 'SIGKILL',
  });
  if (r.error) appendLog(`error: ${r.error.message}`);
  if (r.signal) appendLog(`signal: ${r.signal}`);
  appendLog(`tick: ${target.slug} exit=${r.status}`);
  if (r.stderr) appendLog(`stderr: ${r.stderr.slice(0, 500)}`);
  return { ran: target.slug, exit: r.status, error: r.error?.message, signal: r.signal };
}

const result = tick();
console.log(JSON.stringify(result));

```
