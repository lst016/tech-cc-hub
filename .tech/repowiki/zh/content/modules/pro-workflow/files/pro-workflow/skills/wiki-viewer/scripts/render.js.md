# pro-workflow/skills/wiki-viewer/scripts/render.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：579

## 文件职责

Renders wiki pages as standalone HTML. Parses markdown (headings, lists, tables, code, blockquotes), builds link graph visualization (SVG), applies filters, generates sidebar navigation.

## 关键符号

- `renderMarkdown@0 - Converts markdown to HTML with inline code, bold, italic, citations [^id], links, lists, tables, blockquotes`
- `buildLinkGraph@0 - Analyzes wiki pages for link relationships to build graph data`
- `svgGraph@0 - Renders link graph as SVG with clickable nodes`
- `buildHtml@0 - Assembles full HTML page with header, sidebar, content, backlinks, citation list`
- `applyFilter@0 - Filters page content by type (tasks, claims, todos) or search query`
- `renderPage@0 - Main entry point: loads page from store, renders markdown, builds graph, outputs HTML`

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

const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..', '..', '..');

function getStore() {
  const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
  if (!fs.existsSync(distPath)) {
    console.error(`[wiki-viewer] built store missing at ${distPath}. Run: cd ${PRO_WORKFLOW_ROOT} && npm install && npm run build`);
    process.exit(1);
  }
  return require(distPath).createStore();
}

function die(msg) { console.error(`[wiki-viewer] ${msg}`); process.exit(1); }

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdown(md) {
  if (!md) return '';
  const lines = md.split(/\r?\n/);
  const out = [];
  let inCode = false;
  let inList = false;
  let inTable = false;
  let codeLang = '';
  let para = [];

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(' ').trim();
    if (text) out.push(`<p>${inline(text)}</p>`);
    para = [];
  };
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const closeTable = () => { if (inTable) { out.push('</tbody></table>'); inTable = false; } };

  function inline(s) {
    let r = escapeHtml(s);
    r = r.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    r = r.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    r = r.replace(/(?<![*])\*(?!\*)([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    r = r.replace(/\[\^([a-zA-Z0-9_-]+)\]/g, (_, id) => `<a class="cite" href="#src-row-${escapeHtml(id)}" data-src-id="${escapeHtml(id)}">[${escapeHtml(id)}]</a>`);
    r = r.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, (_, t, u) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${t}</a>`);
    return r;
  }

  for (const raw of lines) {
    const line = raw;
    const codeFence = line.match(/^```(\w*)\s*$/);
    if (codeFence) {
      flushPara(); closeList(); closeTable();
      if (inCode) { out.push('</code></pre>'); inCode = false; codeLang = ''; }
      else { inCode = true; codeLang = codeFence[1] || ''; out.push(`<pre><code data-lang="${escapeHtml(codeLang)}">`); }
      continue;
    }
    if (inCode) { out.push(escapeHtml(line)); continue; }

    if (/^\s*$/.test(line)) { flushPara(); closeList(); closeTable(); continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara(); closeList(); closeTable();
      const lvl = heading[1].length;
      out.push(`<h${lvl}>${inline(heading[2])}</h${lvl}>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushPara(); closeTable();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara(); closeList();
      if (!inTable) {
        out.push('<table><thead><tr>');
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        for (const c of cells) out.push(`<th>${inline(c)}</th>`);
        out.push('</tr></thead><tbody>');
        inTable = true;
        continue;
      }
      if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue;
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      out.push('<tr>');
      for (const c of cells) out.push(`<td>${inline(c)}</td>`);
      out.push('</tr>');
      continue;
    } else { closeTable(); }

    if (/^>\s+/.test(line)) {
      flushPara(); closeList();
      out.push(`<blockquote>${inline(line.replace(/^>\s+/, ''))}</blockquote>`);
      continue;
    }

    para.push(line);
  }
  flushPara();
  closeList();
  closeTable();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

function buildLinkGraph(pages)
... (truncated)
```
