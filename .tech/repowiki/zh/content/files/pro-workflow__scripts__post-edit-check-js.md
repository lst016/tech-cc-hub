# pro-workflow/scripts/post-edit-check.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：81

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `log@10`
- `main@14`
- `fs@8`
- `data@16`
- `input@24`
- `filePath@25`
- `content@31`
- `lines@33`
- `issues@34`
- `isTestFile@35`
- `lineNum@38`

## 依赖输入

- `fs`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
#!/usr/bin/env node
/**
 * Post-Edit Check
 *
 * Runs after code edits to catch common issues.
 * Supports the self-correction loop by surfacing potential mistakes.
 */

const fs = require('fs');

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
      const filePath = input.tool_input?.file_path;

      if (!filePath || !fs.existsSync(filePath)) {
        console.log(data);
        return;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const issues = [];
      const isTestFile = /\.(test|spec)\.[jt]sx?$|__tests__\/|\/test\/|\/tests\/|^test_.*\.py$|_test\.py$/.test(filePath);

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;

        // Check for console.log (JS/TS) — skip in test files
        if (!isTestFile && /console\.(log|debug|info)\(/.test(line) && !/\/\/.*console/.test(line)) {
          issues.push(`${lineNum}: console.log found`);
        }

        // Check for print statements (Python) — skip in test files
        if (!isTestFile && /\bprint\s*\(/.test(line) && !/^#/.test(line.trim()) && filePath.endsWith('.py')) {
          issues.push(`${lineNum}: print() found`);
        }

        // Check for TODO/FIXME — only flag if no ticket reference (e.g., TODO(JIRA-123))
        if (/\b(TODO|FIXME|XXX|HACK)\b/i.test(line) && !/\b(TODO|FIXME|XXX|HACK)\s*\([A-Z]+-\d+\)/i.test(line)) {
          issues.push(`${lineNum}: ${line.match(/\b(TODO|FIXME|XXX|HACK)\b/i)[0]} without ticket reference`);
        }

        // Check for hardcoded secrets patterns
        if (/(['"])?(api[_-]?key|secret|password|token)(['"])?[\s]*[:=][\s]*(['"])[^'"]{8,}/i.test(line)) {
          issues.push(`${lineNum}: Possible hardcoded secret`);
        }
      });

      if (issues.length > 0) {
        log(`[ProWorkflow] Issues in ${filePath}:`);
        issues.slice(0, 5).forEach(issue => log(`  ${issue}`));
        if (issues.length > 5) {
          log(`  ... and ${issues.length - 5} more`);
        }
        log('[ProWorkflow] Consider: [LEARN] to remember patterns');
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
