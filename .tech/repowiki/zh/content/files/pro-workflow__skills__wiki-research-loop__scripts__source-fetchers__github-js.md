# pro-workflow/skills/wiki-research-loop/scripts/source-fetchers/github.js

> 模块：`git-workbench` · 语言：`javascript` · 行数：53

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `httpsGet@2`
- `authHeader@20`
- `https@1`
- `opts@6`
- `req@7`
- `data@12`
- `tok@22`
- `limit@31`
- `url@32`
- `res@34`
- `json@36`
- `items@37`
- `desc@39`
- `stars@40`
- `match@28`
- `estimateCost@29`

## 依赖输入

- `https`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
const https = require('https');

function httpsGet(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const opts = { headers: { 'User-Agent': 'pro-workflow/wiki-research-loop', Accept: 'application/vnd.github+json', ...headers } };
    const req = https.get(url, opts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return httpsGet(res.headers.location, headers, redirects + 1).then(resolve, reject);
      }
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.setTimeout(15000, () => req.destroy(new Error('github fetch timeout')));
    req.on('error', reject);
  });
}

function authHeader() {
  const tok = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

module.exports = {
  name: 'github',
  match: () => true,
  estimateCost: () => ({ usd: 0, tokens: 0 }),
  async fetch(query, opts = {}) {
    const limit = opts.limit ?? 3;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=${limit}`;
    try {
      const res = await httpsGet(url, authHeader());
      if (res.status !== 200) return [];
      const json = JSON.parse(res.body);
      const items = json.items || [];
      return items.map(r => {
        const desc = r.description || '';
        const stars = r.stargazers_count || 0;
        return {
          title: r.full_name,
          content: `${desc} (${stars}★, ${r.language || 'unknown'})`,
          url: r.html_url,
          fetched_at: new Date().toISOString(),
        };
      });
    } catch {
      return [];
    }
  }
};

```
