# pro-workflow/skills/survey-generator/scripts/build-survey.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：240

## 文件职责

Builds research surveys using LLM calls. Handles bibliography management, version tracking, and survey generation with citation support.

## 关键符号

- `pickProvider@0 - Selects provider from args or environment (checks PROVIDER_DEFAULTS)`
- `callProvider@0 - Makes LLM API call with provider-specific request format`
- `bibCitationId@0 - Generates stable citation IDs from bibliography keys`
- `appendBibliographyToSources@0 - Updates sources.md with new bibliography entries, avoiding duplicates`
- `nextVersion@0 - Calculates next version number for survey iterations`

## 依赖输入

- `fs`
- `path`
- `https`
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
const https = require('https');
const { execFileSync } = require('child_process');

const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..', '..', '..');
const COUNCIL = path.join(PRO_WORKFLOW_ROOT, 'skills', 'llm-council', 'scripts', 'council.js');

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

function die(msg) { console.error(`[survey] ${msg}`); process.exit(1); }

function getStore() {
  const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
  if (!fs.existsSync(distPath)) die(`built store missing at ${distPath}. Run npm run build`);
  return require(distPath).createStore();
}

function postJSON(urlStr, body, headers, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, res => {
      let chunks = '';
      res.on('data', c => { chunks += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('survey request timeout')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const PROVIDER_DEFAULTS = {
  anthropic: { envKey: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com', model: 'claude-opus-4-7' },
  openai: { envKey: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  openrouter: { envKey: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-opus-4' },
  fireworks: { envKey: 'FIREWORKS_API_KEY', baseUrl: 'https://api.fireworks.ai/inference/v1', model: 'accounts/fireworks/models/kimi-k2p5' },
  custom: { envKey: 'LLM_COUNCIL_API_KEY', baseUrl: process.env.LLM_COUNCIL_BASE_URL || '', model: process.env.LLM_COUNCIL_CHAIRMAN || '' },
};

function pickProvider(arg) {
  if (arg && PROVIDER_DEFAULTS[arg]) return arg;
  for (const [name, p] of Object.entries(PROVIDER_DEFAULTS)) if (process.env[p.envKey]) return name;
  return null;
}

async function callProvider(providerName, model, system, user, maxTokens) {
  const p = PROVIDER_DEFAULTS[providerName];
  if (!process.env[p.envKey]) die(`${p.envKey} not set`);
  if (providerName === 'anthropic') {
    const res = await postJSON(`${p.baseUrl}/v1/messages`, {
      model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }],
    }, { 'x-api-key': process.env[p.envKey], 'anthropic-version': '2023-06-01' });
    if (res.status >= 400) die(`anthropic error ${res.status}: ${res.body.slice(0, 300)}`);
    const data = JSON.parse(res.body);
    return (data.content || []).map(b => b.text || '').join('');
  }
  const res = await postJSON(`${p.baseUrl}/chat/completions`, {
    model, max_tokens: maxTokens, temperature: 0.7,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  }, { Authorization: `Bearer ${process.env[p.envKey]}` });
  if (res.status >= 400) die(`${providerName} error ${res.status}: ${res.body.slice(0, 300)}`);
  const data = JSON.parse(res.body);
  return data.choices?.[0]?.message?.content || '';
}

function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }

function bibCitationId(key) {
  return `src-bib-${slugify(key)}`;
}

function appendBibliographyToSources(wikiRoot, bibliography) {
  const file = path.join(wikiRoot, 'sources.md');
  let existing = '';
  if (fs.existsSync(file)) existing = fs.readFileSync(file, 'utf8');
  const seenKeys = new Set();
  for (const m of existing.matchAll(/\| (src-bib-[a-z0-9-]+) \|/g)) seenKeys.add(m[1]);

  const newRows = [];
  fo
... (truncated)
```
