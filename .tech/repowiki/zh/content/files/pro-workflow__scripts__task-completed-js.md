# pro-workflow/scripts/task-completed.js

> 模块：`task-engine` · 语言：`javascript` · 行数：16

## 文件职责

入口文件

## 关键符号

- `data@3 - `
- `input@7 - `

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
    console.error('[ProWorkflow] Task completed: ' + (input.task_id || 'unknown'));
    console.error('[ProWorkflow] Run quality gates before marking done');
    console.log(data);
  } catch (err) {
    console.error('[ProWorkflow] JSON parse error:', err.message);
    console.log(data || '{}');
  }
});

```
