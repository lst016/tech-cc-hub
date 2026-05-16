# pro-workflow/skills/wiki-builder/scripts/wiki-cli.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：231

## 文件职责

CLI for wiki management: init (create new wiki), list, info, page (add/update pages), reindex. Manages SQLite store and wiki directories.

## 关键符号

- `cmdInit@0 - Creates new wiki by running init_wiki.sh, registers in store with slug/title/flavor/scope`
- `cmdList@0 - Lists wikis with formatting, supports --json and --scope filter`
- `cmdPage@0 - Adds/updates wiki page: validates path, extracts title/summary/type, writes file and store entry`
- `sha256@0 - Generates 16-char hash for page IDs`

## 依赖输入

- `fs`
- `path`
- `os`
- `crypto`
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
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..', '..', '..');

function getStore() {
  const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
  if (!fs.existsSync(distPath)) {
    die(`Built store missing at ${distPath}. Run: cd ${PRO_WORKFLOW_ROOT} && npm install && npm run build`);
  }
  const mod = require(distPath);
  if (typeof mod.createStore !== 'function') die('createStore not exported');
  return mod.createStore();
}

function die(msg) {
  console.error(`[wiki] ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    } else {
      out._.push(a);
    }
  }
  return out;
}

function defaultRoot(scope) {
  if (scope === 'project') {
    const proj = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    return path.join(proj, '.claude', 'wikis');
  }
  return process.env.WIKI_ROOT || path.join(os.homedir(), '.pro-workflow', 'wikis');
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

function cmdInit(args) {
  const slug = args._[0];
  if (!slug) die('init: slug required');
  const title = args.title || slug;
  const flavor = args.flavor || 'research';
  const scope = args.scope || 'global';
  const root = args.root || defaultRoot(scope);

  const initSh = path.join(__dirname, 'init_wiki.sh');
  const dest = execFileSync('bash', [initSh, slug, '--title', title, '--flavor', flavor, '--scope', scope, '--root', root], { encoding: 'utf8' }).trim();

  const store = getStore();
  try {
    store.upsertWiki({ slug, title, flavor, root_path: dest, scope });
  } catch (e) {
    die(e.message);
  } finally {
    store.close();
  }
  console.log(JSON.stringify({ slug, title, flavor, scope, root_path: dest }, null, 2));
}

function cmdList(args) {
  const store = getStore();
  try {
    const wikis = store.listWikis(args.scope);
    if (args.json) { console.log(JSON.stringify(wikis, null, 2)); return; }
    if (!wikis.length) { console.log('(no wikis)'); return; }
    for (const w of wikis) {
      console.log(`${w.slug.padEnd(24)} ${w.flavor.padEnd(12)} ${w.scope.padEnd(8)} ${w.root_path}`);
    }
  } finally {
    store.close();
  }
}

function cmdInfo(args) {
  const slug = args._[0];
  if (!slug) die('info: slug required');
  const store = getStore();
  try {
    const wiki = store.getWiki(slug);
    if (!wiki) die(`unknown wiki: ${slug}`);
    const pages = store.listWikiPages(slug);
    console.log(JSON.stringify({ wiki, page_count: pages.length, pages: pages.map(p => p.rel_path) }, null, 2));
  } finally {
    store.close();
  }
}

function cmdPage(args) {
  const slug = args._[0];
  const relPath = args._[1];
  if (!slug || !relPath) die('page: slug and rel-path required');

  const store = getStore();
  try {
    const wiki = store.getWiki(slug);
    if (!wiki) die(`unknown wiki: ${slug}. Run: wiki-cli.js init ${slug} --title "..."`);

    const rootAbs = path.resolve(wiki.root_path);
    const fileAbs = path.resolve(wiki.root_path, relPath);
    if (fileAbs !== rootAbs && !fileAbs.startsWith(rootAbs + path.sep)) {
      die(`rel-path escapes wiki root: ${relPath}`);
    }
    let content = '';
    if (args['from-file']) {
      content = fs.readFileSync(args['from-file'], 'utf8');
      fs.mkdirSync(path.dirname(fileAbs), { recursive: true });
      fs.writeFileSync(fileAbs, content);
    } else if (fs.existsSync(fileAbs)) {
      content = fs.readFileSync(fileAbs, 'utf8');
    } else {
      die(`page file does not exist: ${fileAbs}. Pass --from-file or write the file first.`);
    }

    const title = args.title || extractTitle(content) || path.basename(relPath, '.md');
    const summary = args.summary || extractSummary(content);
    const pageType = args.type || inferType(relPat
... (truncated)
```
