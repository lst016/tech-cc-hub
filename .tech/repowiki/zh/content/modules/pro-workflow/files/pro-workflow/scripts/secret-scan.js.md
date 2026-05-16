# pro-workflow/scripts/secret-scan.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：68

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `readStdin@23`
- `surroundingLine@32`
- `scan@38`
- `PATTERNS@2`
- `ALLOWLIST@17`
- `data@26`
- `start@34`
- `end@35`
- `m@42`
- `snippet@44`
- `context@45`
- `line@47`
- `raw@54`
- `input@55`
- `content@57`
- `path@58`
- `hit@63`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
#!/usr/bin/env node
const PATTERNS = [
  { name: 'AWS Access Key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'AWS Secret Key', re: /\b(?:aws_)?secret(?:_access)?_key\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/i },
  { name: 'GitHub Token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'GitHub Fine-Grained Token', re: /\bgithub_pat_[A-Za-z0-9_]{82}\b/ },
  { name: 'Anthropic API Key', re: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/ },
  { name: 'OpenAI API Key', re: /\bsk-(?:proj-)?(?!ant-)[A-Za-z0-9_\-]{20,}\b/ },
  { name: 'Slack Token', re: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/ },
  { name: 'Google API Key', re: /\bAIza[0-9A-Za-z_\-]{35}\b/ },
  { name: 'Stripe Secret Key', re: /\bsk_live_[0-9a-zA-Z]{24,}\b/ },
  { name: 'Private Key Block', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'Generic Bearer Token', re: /\bBearer\s+[A-Za-z0-9_\-.=]{30,}/ },
  { name: 'Generic Password Assignment', re: /\b(?:password|passwd|pwd)\s*[=:]\s*["'][^"'\s]{8,}["']/i },
  { name: 'Generic Secret Assignment', re: /\b(?:api[_\-]?key|api[_\-]?secret|secret|token)\s*[=:]\s*["'][A-Za-z0-9_\-]{20,}["']/i },
];

const ALLOWLIST = [
  /example|placeholder|your[_\-]?(?:api[_\-]?)?key|xxx+|\*{4,}|<[A-Z_]+>/i,
  /process\.env\./,
  /os\.getenv|os\.environ/,
];

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

function surroundingLine(content, index) {
  const start = content.lastIndexOf('\n', index - 1) + 1;
  const end = content.indexOf('\n', index);
  return content.slice(start, end === -1 ? content.length : end);
}

function scan(content) {
  if (!content) return null;
  for (const { name, re } of PATTERNS) {
    const m = content.match(re);
    if (!m) continue;
    const snippet = m[0];
    const context = surroundingLine(content, m.index);
    if (ALLOWLIST.some(a => a.test(context))) continue;
    const line = content.slice(0, m.index).split('\n').length;
    return { name, snippet: snippet.slice(0, 40), line };
  }
  return null;
}

(async () => {
  const raw = await readStdin();
  let input = {};
  try { input = JSON.parse(raw); } catch {}
  const content = input?.tool_input?.content || input?.tool_input?.new_string || '';
  const path = input?.tool_input?.file_path || '';
  if (/\.(env|pem|key)$|\/secrets?\//i.test(path)) {
    console.error(`[pro-workflow] secret-scan: refusing to write to secret-like path: ${path}`);
    process.exit(2);
  }
  const hit = scan(content);
  if (!hit) process.exit(0);
  console.error(`[pro-workflow] secret-scan: detected ${hit.name} near line ${hit.line}: ${hit.snippet}... — remove or load from env.`);
  process.exit(2);
})();

```
