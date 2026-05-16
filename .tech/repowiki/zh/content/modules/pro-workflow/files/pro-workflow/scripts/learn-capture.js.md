# pro-workflow/scripts/learn-capture.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：66

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `getStore@4`
- `main@15`
- `fs@2`
- `path@3`
- `distPath@6`
- `mod@8`
- `data@17`
- `input@21`
- `response@22`
- `regex@27`
- `store@31`
- `count@32`
- `lastIndex@33`
- `projectDir@41`
- `wikiSlug@43`

## 依赖输入

- `fs`
- `path`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function getStore() {
  const distPath = path.join(__dirname, '..', 'dist', 'db', 'store.js');
  if (fs.existsSync(distPath)) {
    const mod = require(distPath);
    if (typeof mod.createStore === 'function') {
      return mod.createStore();
    }
  }
  return null;
}

async function main() {
  let data = '';
  process.stdin.on('data', chunk => { data += chunk; });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(data);
      const response = input.assistant_response || '';
      if (!response) {
        console.log(data);
        return;
      }

      const regex = /\[LEARN\]\s*([\w][\w\s-]*?)\s*:\s*(.+?)(?:\nMistake:\s*(.+?))?(?:\nCorrection:\s*(.+?))?(?:\nWiki:\s*([A-Za-z0-9_-]+))?(?=\n\[LEARN\]|\n\n|$)/gim;

      let match;
      let store = null;
      let count = 0;
      let lastIndex = -1;

      while ((match = regex.exec(response)) !== null) {
        if (regex.lastIndex === lastIndex) break;
        lastIndex = regex.lastIndex;

        if (!store) store = getStore();
        if (!store) break;

        const projectDir = process.env.CLAUDE_PROJECT_DIR || '';
        const wikiSlug = match[5]?.trim() || undefined;
        store.addLearning({
          project: projectDir ? path.basename(projectDir) : null,
          category: match[1].trim(),
          rule: match[2].trim(),
          mistake: match[3]?.trim() || null,
          correction: match[4]?.trim() || null,
        }, wikiSlug);
        count++;
      }

      if (count > 0) {
        console.error(`[ProWorkflow] Auto-saved ${count} learning(s) to database`);
      }
      if (store) store.close();
    } catch (err) {
      console.error(`[ProWorkflow] Learn-capture error: ${err.message}`);
    }
    console.log(data);
  });
}

main().catch(() => process.exit(0));

```
