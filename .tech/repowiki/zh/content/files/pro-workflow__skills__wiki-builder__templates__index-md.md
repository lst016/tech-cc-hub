# pro-workflow/skills/wiki-builder/templates/index.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：22

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# {{TITLE}}

> {{FLAVOR}} wiki · created {{TODAY}}

A persistent knowledge base on **{{TITLE}}**.

## Sections

_Add links to compiled pages here as you build them._

## Open questions

_List unresolved threads. New seeds for the research loop start here._

## Sources

See [sources.md](../sources.md).

## Maintenance log

See [logs/maintenance-log.md](../logs/maintenance-log.md).

```
