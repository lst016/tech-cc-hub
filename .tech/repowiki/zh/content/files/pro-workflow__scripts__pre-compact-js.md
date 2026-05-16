# pro-workflow/scripts/pre-compact.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：99

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `getTempDir@15`
- `ensureDir@19`
- `log@25`
- `getDateString@29`
- `getTimeString@33`
- `main@37`
- `fs@11`
- `path@13`
- `os@14`
- `data@39`
- `input@47`
- `sessionId@48`
- `tempDir@51`
- `compactDir@52`
- `compactFile@54`
- `state@56`
- `editCountFile@64`
- `promptCountFile@70`

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
/**
 * PreCompact Hook
 *
 * Runs before context compaction.
 * Saves important state that should survive compaction.
 *
 * Input (stdin): { session_id, summary }
 * Output (stdout): Same JSON
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function getTempDir() {
  return path.join(os.tmpdir(), 'pro-workflow');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function log(msg) {
  console.error(msg);
}

function getDateString() {
  return new Date().toISOString().split('T')[0];
}

function getTimeString() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

async function main() {
  let data = '';

  process.stdin.on('data', chunk => {
    data += chunk;
  });

  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(data);
      const sessionId = input.session_id || 'default';

      // Save pre-compact state
      const tempDir = getTempDir();
      const compactDir = path.join(tempDir, 'compacts');
      ensureDir(compactDir);

      const compactFile = path.join(compactDir, `${getDateString()}-${sessionId.slice(-6)}.json`);

      const state = {
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        summary: input.summary || 'No summary provided'
      };

      // Read edit count if exists
      const editCountFile = path.join(tempDir, `edit-count-${sessionId}`);
      if (fs.existsSync(editCountFile)) {
        state.edits_before_compact = parseInt(fs.readFileSync(editCountFile, 'utf8').trim(), 10);
      }

      // Read prompt count if exists
      const promptCountFile = path.join(tempDir, `prompt-count-${sessionId}`);
      if (fs.existsSync(promptCountFile)) {
        state.prompts_before_compact = parseInt(fs.readFileSync(promptCountFile, 'utf8').trim(), 10);
      }

      fs.writeFileSync(compactFile, JSON.stringify(state, null, 2));

      log('[ProWorkflow] Context compacting - state saved');
      log(`[ProWorkflow] Edits: ${state.edits_before_compact || 0}, Prompts: ${state.prompts_before_compact || 0}`);

      // Reset counters after compact
      if (fs.existsSync(editCountFile)) {
        fs.writeFileSync(editCountFile, '0');
      }
      if (fs.existsSync(promptCountFile)) {
        fs.writeFileSync(promptCountFile, '0');
      }

      console.log(data);
    } catch (err) {
      console.log(data);
    }
  });
}

main().catch(err => {
  console.error('[ProWorkflow] Error:', err.message);
  process.exit(0);
});

```
