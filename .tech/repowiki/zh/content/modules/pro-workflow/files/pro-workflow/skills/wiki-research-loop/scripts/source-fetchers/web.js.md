# pro-workflow/skills/wiki-research-loop/scripts/source-fetchers/web.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：92

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `httpGet@7`
- `stripTags@51`
- `extractDuckDuckGoLite@55`
- `https@1`
- `http@2`
- `MAX_BODY_BYTES@4`
- `BODY_DEADLINE_MS@6`
- `u@11`
- `client@12`
- `opts@13`
- `req@24`
- `loc@27`
- `chunks@30`
- `received@31`
- `bodyTimer@32`
- `cleanup@33`
- `fail@37`
- `out@57`
- `linkRe@58`
- `snipRe@59`
- `links@60`
- `snippets@63`
- `limit@81`
- `url@82`
- `res@84`
- `match@78`
- `estimateCost@79`

## 依赖输入

- `https`
- `http`
- `url`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
const https = require('https');
const http = require('http');
const { URL } = require('url');

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const BODY_DEADLINE_MS = 30000;

function httpGet(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const u = new URL(url);
    const client = u.protocol === 'http:' ? http : https;
    const opts = {
      hostname: u.hostname,
      port: u.port || undefined,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; pro-workflow/wiki-research-loop)',
        Accept: 'text/html,application/xhtml+xml',
        ...headers,
      },
    };
    const req = client.get(opts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = new URL(res.headers.location, u).toString();
        return httpGet(loc, headers, redirects + 1).then(resolve, reject);
      }
      const chunks = [];
      let received = 0;
      let bodyTimer = null;
      const cleanup = () => {
        if (bodyTimer) clearTimeout(bodyTimer);
        res.removeAllListeners();
      };
      const fail = (err) => { cleanup(); res.destroy(); reject(err); };
      bodyTimer = setTimeout(() => fail(new Error('body read deadline exceeded')), BODY_DEADLINE_MS);
      res.on('data', c => {
        received += c.length;
        if (received > MAX_BODY_BYTES) return fail(new Error(`body exceeds ${MAX_BODY_BYTES} bytes`));
        chunks.push(c);
      });
      res.on('end', () => { cleanup(); resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }); });
      res.on('error', fail);
    });
    req.setTimeout(15000, () => req.destroy(new Error('web fetch timeout')));
    req.on('error', reject);
  });
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function extractDuckDuckGoLite(html, limit) {
  const out = [];
  const linkRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snipRe = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
  const links = [];
  let m;
  while ((m = linkRe.exec(html)) !== null) links.push({ url: m[1], title: stripTags(m[2]) });
  const snippets = [];
  while ((m = snipRe.exec(html)) !== null) snippets.push(stripTags(m[1]));
  for (let i = 0; i < Math.min(limit, links.length); i++) {
    out.push({
      url: links[i].url,
      title: links[i].title,
      content: snippets[i] || '',
      fetched_at: new Date().toISOString(),
    });
  }
  return out;
}

module.exports = {
  name: 'web',
  match: () => true,
  estimateCost: () => ({ usd: 0, tokens: 0 }),
  async fetch(query, opts = {}) {
    const limit = opts.limit ?? 3;
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    try {
      const res = await httpGet(url);
      if (res.status !== 200) return [];
      return extractDuckDuckGoLite(res.body, limit);
    } catch {
      return [];
    }
  }
};

```
