# pro-workflow/scripts/config-watcher.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：91

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `getTempDir@15`
- `ensureDir@19`
- `log@25`
- `main@29`
- `fs@11`
- `path@13`
- `os@14`
- `data@31`
- `input@39`
- `configFile@40`
- `fileName@41`
- `sensitiveFiles@42`
- `isSensitive@49`
- `tempDir@62`
- `logFile@65`
- `MAX_LOG_SIZE@66`
- `stat@68`
- `entry@75`

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
 * ConfigChange Hook (Claude Code 2.1.49+)
 *
 * Fires when configuration files change during a session.
 * Detects when quality gates, hooks, or permissions are modified.
 *
 * Input (stdin): { config_file, changes }
 * Output (stdout): Same JSON (pass-through)
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

async function main() {
  let data = '';

  process.stdin.on('data', chunk => {
    data += chunk;
  });

  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(data);
      const configFile = input.config_file || input.file || '';
      const fileName = path.basename(configFile);

      const sensitiveFiles = [
        'settings.json',
        'settings.local.json',
        'hooks.json',
        '.claudeignore'
      ];

      const isSensitive = sensitiveFiles.some(f => fileName === f);

      if (isSensitive) {
        log(`[ProWorkflow] Config changed: ${fileName}`);

        if (fileName === 'hooks.json') {
          log('[ProWorkflow] Hooks configuration modified — quality gates may be affected');
        }

        if (fileName === 'settings.json' || fileName === 'settings.local.json') {
          log('[ProWorkflow] Settings changed mid-session — verify permissions are as expected');
        }

        const tempDir = getTempDir();
        ensureDir(tempDir);
        const logFile = path.join(tempDir, 'config-changes.log');
        const MAX_LOG_SIZE = 100 * 1024;
        try {
          const stat = fs.statSync(logFile);
          if (stat.size > MAX_LOG_SIZE) {
            fs.writeFileSync(logFile, '');
          }
        } catch (_e) {
          // File doesn't exist yet
        }
        const entry = `${new Date().toISOString()} ${configFile}\n`;
        fs.appendFileSync(logFile, entry);
      }

      console.log(data);
    } catch (err) {
      console.error('[ProWorkflow] config-watcher error:', err.message);
      console.log(data || '{}');
    }
  });
}

main().catch(err => {
  console.error('[ProWorkflow] Error:', err.message);
  process.exit(0);
});

```
