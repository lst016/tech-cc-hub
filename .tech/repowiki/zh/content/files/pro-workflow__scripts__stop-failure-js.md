# pro-workflow/scripts/stop-failure.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：32

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `data@3`
- `input@7`
- `error@8`
- `code@9`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
#!/usr/bin/env node
process.stdin.setEncoding('utf8');
let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const error = input.error || input.message || 'unknown error';
    const code = input.status_code || input.code || '';

    console.error('[ProWorkflow] API error occurred: ' + error);
    if (code) {
      console.error('[ProWorkflow]   Status: ' + code);
    }

    if (/rate.?limit|429/i.test(String(error) + String(code))) {
      console.error('[ProWorkflow]   Rate limited — wait a moment and retry');
    } else if (/timeout|504|408/i.test(String(error) + String(code))) {
      console.error('[ProWorkflow]   Timeout — retry with a simpler prompt or /compact first');
    } else if (/5\d{2}|server/i.test(String(error) + String(code))) {
      console.error('[ProWorkflow]   Server error — retry in a few seconds');
    } else {
      console.error('[ProWorkflow]   Consider retrying or simplifying the request');
    }

    console.log(data);
  } catch (err) {
    console.error('[ProWorkflow] JSON parse error:', err.message);
    console.log(data || '{}');
  }
});

```
