# pro-workflow/commands/mcp-audit.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：32

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
description: Audit MCP servers for token overhead, redundancy, and usage — recommend servers to disable for faster sessions
---

# /mcp-audit - MCP Server Optimization

Audit your MCP servers and reduce token overhead.

## Quick Start

Run to see:
- Active MCP servers and their tool counts
- Estimated token overhead per request
- Servers you haven't used recently
- Recommendations for disabling/keeping

## Key Insight

Every MCP server adds ALL its tool descriptions to EVERY API request. A server with 20 tools adds ~2K-4K tokens per request whether you use it or not.

## Thresholds

- Servers: <10 ideal, >15 reduce
- Total tools: <80 ideal, >120 reduce
- Per server: <15 ok, >30 split or disable

## Usage

```
/mcp-audit
```

```
