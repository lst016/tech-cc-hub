# pro-workflow/scripts/task-created.js

> 模块：`task-engine` · 语言：`javascript` · 行数：23

## 文件职责

入口文件

## 关键符号

- `data@3 - `
- `input@7 - `
- `description@8 - `

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
    const description = input.description || '';

    if (description.length < 5) {
      console.error('[ProWorkflow] Task description too short — add detail for tracking');
    }

    if (description.length > 200) {
      console.error('[ProWorkflow] Task description very long — consider breaking into subtasks');
    }

    console.log(data);
  } catch (err) {
    console.log(data || '{}');
  }
});

```
