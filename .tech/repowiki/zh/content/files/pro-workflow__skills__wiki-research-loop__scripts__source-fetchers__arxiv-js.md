# pro-workflow/skills/wiki-research-loop/scripts/source-fetchers/arxiv.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：57

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `httpsGet@2`
- `extractTag@19`
- `parseEntries@27`
- `https@1`
- `req@6`
- `data@11`
- `re@21`
- `out@22`
- `entries@29`
- `title@31`
- `summary@32`
- `idMatch@33`
- `url@34`
- `published@35`
- `limit@45`
- `q@46`
- `url@47`
- `res@49`
- `match@42`
- `estimateCost@43`

## 依赖输入

- `https`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
const https = require('https');

function httpsGet(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const req = https.get(url, { headers: { 'User-Agent': 'pro-workflow/wiki-research-loop' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return httpsGet(res.headers.location, redirects + 1).then(resolve, reject);
      }
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.setTimeout(15000, () => req.destroy(new Error('arxiv fetch timeout')));
    req.on('error', reject);
  });
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

function parseEntries(xml) {
  const entries = extractTag(xml, 'entry');
  return entries.map(entry => {
    const title = (extractTag(entry, 'title')[0] || '').replace(/\s+/g, ' ').trim();
    const summary = (extractTag(entry, 'summary')[0] || '').replace(/\s+/g, ' ').trim();
    const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
    const url = idMatch ? idMatch[1].trim() : null;
    const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1] || null;
    return { title, content: summary, url, fetched_at: new Date().toISOString(), published };
  });
}

module.exports = {
  name: 'arxiv',
  match: () => true,
  estimateCost: () => ({ usd: 0, tokens: 0 }),
  async fetch(query, opts = {}) {
    const limit = opts.limit ?? 3;
    const q = encodeURIComponent(query);
    const url = `https://export.arxiv.org/api/query?search_query=all:${q}&start=0&max_results=${limit}`;
    try {
      const res = await httpsGet(url);
      if (res.status !== 200) return [];
      return parseEntries(res.body);
    } catch {
      return [];
    }
  }
};

```
