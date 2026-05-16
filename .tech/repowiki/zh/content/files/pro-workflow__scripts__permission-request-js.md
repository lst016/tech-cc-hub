# pro-workflow/scripts/permission-request.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：35

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `data@3`
- `input@7`
- `tool@8`
- `cmd@9`
- `dangerous@10`
- `isDangerous@25`

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
    const tool = (input.tool || 'unknown').toLowerCase();
    const cmd = ((input.tool_input && input.tool_input.command) || '').toLowerCase();
    const dangerous = [
      /\brm\s+(-[rRf]+\s+)*-?[rRf]/,
      /\bdocker\s+(rm|rmi|system\s+prune|container\s+prune)/,
      /\bnpm\s+publish\b/,
      /\bgit\s+push\s+.*--force/,
      /\bgit\s+push\s+-f\b/,
      /\bgit\s+reset\s+--hard/,
      /\bsudo\s+rm\b/,
      /\bchmod\s+777\b/,
      /\bcurl\s+.*\|\s*(ba)?sh/,
      /\bwget\s+.*\|\s*(ba)?sh/,
      /\bdd\s+if=/,
      /\bmkfs\b/,
      />\s*\/dev\//,
    ];
    const isDangerous = dangerous.some(p => p.test(cmd));
    if (isDangerous) {
      console.error('[ProWorkflow] CAUTION: Dangerous operation requested: ' + tool + (cmd ? ' cmd: ' + cmd : ''));
    }
    console.log(data);
  } catch (err) {
    console.error('[ProWorkflow] JSON parse error:', err.message);
    console.log(data || '{}');
  }
});

```
