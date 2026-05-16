# pro-workflow/scripts/permission-denied.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：48

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `fs@2`
- `path@3`
- `os@4`
- `data@7`
- `input@11`
- `tempDir@12`
- `denialsFile@14`
- `denials@16`
- `entry@20`
- `toolCounts@31`
- `topDenied@34`

## 依赖输入

- `fs`
- `path`
- `os`

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

process.stdin.setEncoding('utf8');
let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const tempDir = path.join(os.tmpdir(), 'pro-workflow');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const denialsFile = path.join(tempDir, 'permission-denials.json');
    let denials = [];
    if (fs.existsSync(denialsFile)) {
      try { const parsed = JSON.parse(fs.readFileSync(denialsFile, 'utf8')); denials = Array.isArray(parsed) ? parsed : []; } catch (e) { denials = []; }
    }

    const entry = {
      timestamp: new Date().toISOString(),
      tool: input.tool_name || 'unknown',
      input_summary: input.tool_input ? JSON.stringify(input.tool_input).slice(0, 100) : '',
      session_id: input.session_id || 'unknown'
    };

    denials.push(entry);
    if (denials.length > 500) denials = denials.slice(-500);
    fs.writeFileSync(denialsFile, JSON.stringify(denials, null, 2));

    const toolCounts = {};
    denials.forEach(d => { toolCounts[d.tool] = (toolCounts[d.tool] || 0) + 1; });
    const topDenied = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    if (denials.length > 0 && denials.length % 10 === 0) {
      console.error('[ProWorkflow] Permission denial patterns detected:');
      topDenied.forEach(([tool, count]) => {
        console.error(`  ${tool}: denied ${count}x — consider /permission-tuner`);
      });
    }

    console.log(data);
  } catch (err) {
    console.log(data || '{}');
  }
});

```
