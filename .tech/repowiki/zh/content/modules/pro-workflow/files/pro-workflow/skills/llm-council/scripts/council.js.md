# pro-workflow/skills/llm-council/scripts/council.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：287

## 文件职责

Multi-provider LLM council for voting/consensus on responses. Supports Anthropic, OpenAI, OpenRouter, Fireworks, and custom providers. Returns structured entries with latency, tokens, and content.

## 关键符号

- `PROVIDERS@0 - Map of provider configs with envKey, baseUrl, defaultModels, defaultChairman, and call function`
- `callOpenAICompat@0 - Calls OpenAI-compatible API (OpenAI, OpenRouter, Fireworks) via /chat/completions`
- `callAnthropic@0 - Calls Anthropic API via /v1/messages with anthropic-version header`
- `cmdRun@0 - Runs council with multiple providers, collects responses, persists to wiki, returns unified result`
- `cmdProviders@0 - Shows configured and available providers`

## 依赖输入

- `fs`
- `path`
- `os`
- `https`

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
const https = require('https');

const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..', '..', '..');
const COUNCIL_ROOT = path.join(os.homedir(), '.pro-workflow', 'council');

const PROVIDERS = {
  anthropic: {
    envKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com',
    defaultModels: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    defaultChairman: 'claude-opus-4-7',
    call: callAnthropic,
  },
  openai: {
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    defaultChairman: 'gpt-4o',
    call: callOpenAICompat,
  },
  openrouter: {
    envKey: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: ['anthropic/claude-opus-4', 'openai/gpt-4o', 'google/gemini-2.0-flash'],
    defaultChairman: 'anthropic/claude-opus-4',
    call: callOpenAICompat,
  },
  fireworks: {
    envKey: 'FIREWORKS_API_KEY',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModels: [
      'accounts/fireworks/models/glm-5',
      'accounts/fireworks/models/deepseek-v3p2',
      'accounts/fireworks/models/kimi-k2p5',
    ],
    defaultChairman: 'accounts/fireworks/models/glm-5',
    call: callOpenAICompat,
  },
  custom: {
    envKey: 'LLM_COUNCIL_API_KEY',
    baseUrl: process.env.LLM_COUNCIL_BASE_URL || '',
    defaultModels: (process.env.LLM_COUNCIL_MODELS || '').split(',').filter(Boolean),
    defaultChairman: process.env.LLM_COUNCIL_CHAIRMAN || '',
    call: callOpenAICompat,
  },
};

function pickProvider(arg) {
  if (arg && PROVIDERS[arg]) return arg;
  for (const [name, p] of Object.entries(PROVIDERS)) {
    if (process.env[p.envKey]) return name;
  }
  return null;
}

function postJSON(urlStr, body, headers, timeoutMs = 120000) {
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
    req.setTimeout(timeoutMs, () => req.destroy(new Error('council request timeout')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function callOpenAICompat(provider, model, system, user) {
  const start = Date.now();
  const url = `${provider.baseUrl}/chat/completions`;
  const res = await postJSON(url, {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: 4000,
    temperature: 1,
  }, { Authorization: `Bearer ${process.env[provider.envKey]}` });
  const elapsed = Date.now() - start;
  if (res.status >= 400) return { success: false, content: `[ERROR ${res.status}: ${res.body.slice(0, 300)}]`, model, latency_ms: elapsed };
  let data;
  try { data = JSON.parse(res.body); } catch (e) { return { success: false, content: `[parse-error]`, model, latency_ms: elapsed }; }
  const content = data.choices?.[0]?.message?.content || '';
  return { success: true, content, model, latency_ms: elapsed, tokens: data.usage || {} };
}

async function callAnthropic(provider, model, system, user) {
  const start = Date.now();
  const url = `${provider.baseUrl}/v1/messages`;
  const res = await postJSON(url, {
    model,
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: user }],
  }, {
    'x-api-key': process.env[provider.envKey],
    'anthropic-version': '2023-06-01',
  });
  const elapsed = Date.now() - start;
  if (res.status >= 400) return { success: false, content: `[ERROR ${res.status}: ${res.body.slice(0, 300)}]`, model, latency_ms: elapsed };
  let data;
  try { data = JSON.parse(res.body); } catch { return { success: false, content: '[parse-error]', model, latency_ms: elapsed }; }
  const content = (data.content || []).map(b =>
... (truncated)
```
