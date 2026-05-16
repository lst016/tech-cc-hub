# pro-workflow/scripts/session-start.js

> 模块：`session-engine` · 语言：`javascript` · 行数：132

## 文件职责

会话启动钩子，加载最近学习记录、会话历史、wiki列表

## 关键符号

- `findProjectRoot@0 - 向上遍历目录找到.git所在的项目根目录`
- `getStore@0 - 尝试加载dist/db/store.js获取数据库store，回退到null`
- `main@0 - 主逻辑：加载learnings、recentSessions、wikis，无数据库时读LEARNED.md文件`

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

function log(msg) {
  console.error(msg);
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
  const claudeDir = path.join(projectRoot, '.claude');
  const learnedFile = path.join(claudeDir, 'LEARNED.md');
  const sessionId = process.env.CLAUDE_SESSION_ID || String(process.ppid) || 'default';

  let store = null;
  try {
    store = getStore();
  } catch (e) {
    // Store not available, continue with file-based approach
  }

  if (store) {
    try {
      store.startSession(sessionId, projectName);

      const { getRecentLearnings } = require(path.join(__dirname, '..', 'dist', 'search', 'fts.js'));

      const recentLearnings = getRecentLearnings(store.db, 5, projectName);

      if (recentLearnings.length > 0) {
        log(`[ProWorkflow] Loaded ${recentLearnings.length} learnings from database:`);
        recentLearnings.slice(0, 3).forEach((l) => {
          log(`  - [${l.category}] ${l.rule}`);
        });
        if (recentLearnings.length > 3) {
          log(`  ... and ${recentLearnings.length - 3} more`);
        }
      }

      const recentSessions = store.getRecentSessions(3);
      if (recentSessions.length > 1) {
        const lastSession = recentSessions[1];
        if (lastSession && lastSession.ended_at) {
          log(`[ProWorkflow] Previous session: ${lastSession.started_at.split('T')[0]} (${lastSession.edit_count} edits, ${lastSession.corrections_count} corrections)`);
        }
      }

      if (typeof store.listWikis === 'function') {
        const wikis = store.listWikis();
        if (wikis.length > 0) {
          log(`[ProWorkflow] ${wikis.length} wiki(s) available:`);
          wikis.slice(0, 5).forEach(w => {
            log(`  - ${w.slug} (${w.flavor}, ${w.scope})`);
          });
          if (wikis.length > 5) log(`  ... and ${wikis.length - 5} more`);
        }
      }
    } catch (e) {
      log(`[ProWorkflow] DB error: ${e.message}`);
    } finally {
      if (store) {
        try { store.close(); } catch (e) { /* ignore close errors */ }
      }
    }
  } else {
    if (fs.existsSync(learnedFile)) {
      const content = fs.readFileSync(learnedFile, 'utf8');
      const learnedPatterns = (content.match(/\[LEARN\]/g) || []).length;

      if (learnedPatterns > 0) {
        log(`[ProWorkflow] Loaded ${learnedPatterns} learned patterns from LEARNED.md`);
      }
    }

    const sessionsDir = path.join(os.tmpdir(), 'pro-workflow', 'sessions');
    if (fs.existsSync(sessionsDir)) {
      const files = fs.readdirSync(sessionsDir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse();

      if (files.length > 0) {
        const lastSession = files[0];
        log(`[ProWorkflow] Previous session: ${lastSession}`);
      }
    }
  }

  try {
    const { execSync } = require('child_process');
    const worktrees = execSync('git worktree list 2>/dev/null', { encoding: 'utf8' });
    const count = worktrees.split('\n').filter(l => l.trim()).length;

    if (count > 1) {
      log(`[ProWorkflow] ${count} worktrees available for parallel work`);
    }
  } catch (e) {
    // Not a git repo or git not available
  }

  log('[ProWorkflow] Ready. Use /wrap-up before ending, /learn to capture corrections.');

  process.exit(0);
}

main().catch(err => {
  console.error('[ProWorkflow] Error:', err.message);
  process.exit(0);
});

```
