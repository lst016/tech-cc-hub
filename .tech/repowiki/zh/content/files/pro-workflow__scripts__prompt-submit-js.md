# pro-workflow/scripts/prompt-submit.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：132

## 文件职责

Handles prompt submission events: detects correction patterns (no, that's wrong, undo), learn triggers (remember this, add to rules), updates session counts in DB or temp files, searches wiki for relevant pages on 3+ word queries.

## 关键符号

- `correctionPatterns@0 - Regex patterns detecting user corrections: no/wrong, should/shouldn't, wrong file, undo, revert, stop`
- `learnPatterns@0 - Patterns triggering learn capture: remember, add to rules, don't do that again, [LEARN]`
- `isCorrection@0 - Boolean from testing correctionPatterns against prompt`
- `isLearnTrigger@0 - Boolean from testing learnPatterns against prompt`

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

function getStore() {
  const distPath = path.join(__dirname, '..', 'dist', 'db', 'store.js');
  if (fs.existsSync(distPath)) {
    const { createStore } = require(distPath);
    return createStore();
  }
  return null;
}

async function main() {
  let data = '';

  process.stdin.on('data', chunk => {
    data += chunk;
  });

  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(data);
      const prompt = input.prompt || '';
      const sessionId = input.session_id || 'default';

      const correctionPatterns = [
        /no,?\s*(that's|thats)?\s*(wrong|incorrect|not right)/i,
        /you\s*(should|shouldn't|need to|forgot)/i,
        /that's not what I (meant|asked|wanted)/i,
        /wrong file/i,
        /undo that/i,
        /revert/i,
        /don't do that/i,
        /stop/i,
        /wait/i
      ];

      const isCorrection = correctionPatterns.some(p => p.test(prompt));

      if (isCorrection) {
        log('[ProWorkflow] Correction detected - use /learn to capture this pattern');
      }

      const learnPatterns = [
        /remember (this|that)/i,
        /add (this|that) to (your )?rules/i,
        /don't (do|make) that (again|mistake)/i,
        /learn from this/i,
        /\[LEARN\]/i
      ];

      const isLearnTrigger = learnPatterns.some(p => p.test(prompt));

      if (isLearnTrigger) {
        log('[ProWorkflow] Learning trigger detected - use /learn to save to database');
      }

      let store = null;
      let sessionUpdated = false;
      try {
        store = getStore();
      } catch (e) {
        // Store not available
      }

      if (store) {
        try {
          const session = store.getSession(sessionId);
          if (session) {
            store.updateSessionCounts(sessionId, 0, isCorrection ? 1 : 0, 1);
            sessionUpdated = true;
          }

          if (typeof store.searchWiki === 'function' && prompt.split(/\s+/).length >= 3) {
            const hits = store.searchWiki(prompt, { limit: 3, loose: true });
            if (hits.length > 0) {
              log(`[ProWorkflow] ${hits.length} relevant wiki page(s):`);
              for (const h of hits) {
                log(`  - ${h.wiki_slug} · ${h.rel_path} — ${h.title}`);
              }
              log('  (use /wiki ask "<query>" --wiki <slug> for full retrieval)');
            }
          }
        } catch (e) {
          // DB error, fall back to file-based
        } finally {
          if (store) {
            try { store.close(); } catch (e) { /* ignore close errors */ }
          }
        }
      }

      if (!sessionUpdated) {
        const tempDir = getTempDir();
        ensureDir(tempDir);
        const countFile = path.join(tempDir, `prompt-count-${sessionId}`);

        let count = 1;
        if (fs.existsSync(countFile)) {
          count = parseInt(fs.readFileSync(countFile, 'utf8').trim(), 10) + 1;
        }
        fs.writeFileSync(countFile, String(count));
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
