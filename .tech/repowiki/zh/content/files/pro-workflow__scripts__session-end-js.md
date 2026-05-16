# pro-workflow/scripts/session-end.js

> 模块：`session-engine` · 语言：`javascript` · 行数：134

## 文件职责

会话结束钩子，保存会话统计到数据库或文件，提醒未提交更改

## 关键符号

- `findProjectRoot@0 - 向上遍历找到项目根目录`
- `getStore@0 - 加载数据库store用于保存会话`
- `main@0 - 尝试用store.endSession保存，否则写临时markdown文件；检查git status提醒未提交`

## 依赖输入

- `fs`
- `path`
- `os`
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
const os = require('os');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function log(msg) {
  console.error(msg);
}

function getDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getTimeString() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function findProjectRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function getStore() {
  const distPath = path.join(__dirname, '..', 'dist', 'db', 'store.js');
  if (fs.existsSync(distPath)) {
    const { createStore } = require(distPath);
    return createStore();
  }
  return null;
}

async function main() {
  const projectRoot = findProjectRoot();
  const projectName = path.basename(projectRoot);
  const sessionId = process.env.CLAUDE_SESSION_ID || String(process.ppid) || 'default';

  let store = null;
  try {
    store = getStore();
  } catch (e) {
    // Store not available
  }

  if (store) {
    try {
      const session = store.getSession(sessionId);

      if (session) {
        store.endSession(sessionId);
        log(`[ProWorkflow] Session saved to database:`);
        log(`  - Edits: ${session.edit_count}`);
        log(`  - Corrections: ${session.corrections_count}`);
        log(`  - Prompts: ${session.prompts_count}`);
      }
    } catch (e) {
      log(`[ProWorkflow] DB error: ${e.message}`);
    } finally {
      if (store) {
        try { store.close(); } catch (e) { /* ignore close errors */ }
      }
    }
  } else {
    const sessionsDir = path.join(os.tmpdir(), 'pro-workflow', 'sessions');
    ensureDir(sessionsDir);

    const today = getDateString();
    const time = getTimeString();
    const shortId = String(sessionId).slice(-6);

    const sessionFile = path.join(sessionsDir, `${today}-${shortId}.md`);

    if (fs.existsSync(sessionFile)) {
      let content = fs.readFileSync(sessionFile, 'utf8');
      content = content.replace(/\*\*Ended:\*\*.*/, `**Ended:** ${time}`);
      fs.writeFileSync(sessionFile, content);
    } else {
      const template = `# Session: ${today}
**Started:** ${time}
**Ended:** ${time}
**Project:** ${projectName}

## Summary
[What was accomplished]

## Learnings
[Patterns discovered]

## Next Steps
[What to do next]
`;
      fs.writeFileSync(sessionFile, template);
    }
  }

  log('[ProWorkflow] Session ending...');
  log('[ProWorkflow] Did you run /wrap-up? Learnings captured?');
  log('[ProWorkflow] Use /search <keyword> to find past learnings');

  try {
    const { execSync } = require('child_process');
    const status = execSync('git status --porcelain 2>/dev/null', {
      encoding: 'utf8',
      cwd: projectRoot
    });

    if (status.trim()) {
      const changes = status.split('\n').filter(l => l.trim()).length;
      log(`[ProWorkflow] WARNING: ${changes} uncommitted changes!`);
    }
  } catch (e) {
    // Not a git repo
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[ProWorkflow] Error:', err.message);
  process.exit(0);
});

```
