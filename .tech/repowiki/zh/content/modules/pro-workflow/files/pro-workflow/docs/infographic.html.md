# pro-workflow/docs/infographic.html

> 模块：`pro-workflow` · 语言：`html` · 行数：1337

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1200">
<title>Pro Workflow — Battle-Tested Claude Code Patterns</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

  :root {
    --anthro-coral: #D97757;
    --anthro-coral-light: #E8926F;
    --anthro-dark: #1A1A2E;
    --anthro-navy: #191A23;
    --anthro-bg: #FAFAF8;
    --anthro-card: #FFFFFF;
    --anthro-border: #E5E5E0;
    --anthro-text: #1A1A2E;
    --anthro-muted: #6B7280;
    --anthro-light-coral: #FFF5F0;
    --anthro-tag-bg: #F3F4F6;
    --anthro-green: #059669;
    --anthro-yellow: #D97706;
    --anthro-red: #DC2626;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--anthro-bg);
    color: var(--anthro-text);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .page {
    width: 1200px;
    margin: 0 auto;
    padding: 48px 56px 40px;
  }

  /* ---- HEADER ---- */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .header-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--anthro-coral);
    flex-shrink: 0;
    margin-top: 2px;
  }
  .header-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: var(--anthro-coral);
  }
  .header-sub {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--anthro-muted);
    margin-top: 2px;
  }
  .header-right {
    text-align: right;
  }
  .star-count {
    font-size: 32px;
    font-weight: 900;
    color: var(--anthro-dark);
    line-height: 1;
  }
  .star-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--anthro-muted);
  }

  /* ---- TITLE ---- */
  .title-block {
    margin: 20px 0 12px;
  }
  .title {
    font-size: 52px;
    font-weight: 900;
    line-height: 1.05;
    color: var(--anthro-dark);
    letter-spacing: -1.5px;
  }
  .subtitle {
    font-size: 16px;
    color: var(--anthro-muted);
    margin-top: 10px;
    max-width: 780px;
    line-height: 1.6;
  }

  /* ---- DIVIDER ---- */
  .divider {
    width: 100%;
    height: 1px;
    background: var(--anthro-border);
    margin: 28px 0 28px;
  }

  /* ---- GRID ---- */
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 28px;
    margin-bottom: 28px;
  }
  .grid-2 {
    grid-template-columns: 1fr 1fr;
  }
  .grid-span-2 {
    grid-column: span 2;
  }

  /* ---- SECTION ---- */
  .section-num {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: var(--anthro-muted);
    margin-bottom: 8px;
  }
  .section-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--anthro-dark);
    margin-bottom: 14px;
    line-height: 1.2;
    letter-spacing: -0.5px;
  }
  .section-title-lg {
    font-size: 28px;
  }

  /* ---- TABLE ---- */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  table th {
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--anthro-muted);
    padding: 0 0 8px 0;
    border-bottom: 1px solid var(--anthro-border);
  }
  table td {
    padding: 7px 8px 7px 0;
    border-bottom: 1px solid #F0F0EC;
    vertical-align: top;
    color: var(--anthro-text);
    font-size: 12px;
    line-height: 1.4;
  }
  table tr:last-child td {
    border-bottom: none;
  }
  td strong {
    font-weight: 700;
    color: var(--anthro-dark);
  }

  /* ---- BULLET LIST ---- */
  .bullet-list {
    list-style: none;
    padding: 0;
  }
  .bullet-list li {
    position: relative;
    padding-left: 16px;
    font-size: 12.5px;
    line-height: 1.55;
    margin-bottom: 6px;
    color: var(--anthro-text);
  }
  .bullet-list li::b
... (truncated)
```
