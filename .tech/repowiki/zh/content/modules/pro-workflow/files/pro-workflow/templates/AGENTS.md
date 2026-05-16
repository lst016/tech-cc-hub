# pro-workflow/templates/AGENTS.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：41

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# [Project Name]

## Build / Test / Lint
```bash
[build command]      # Build the project
[test command]       # Run tests
[lint command]       # Lint and format
[typecheck command]  # Type checking (if applicable)
```

## Code Style
- [Language] with [framework]
- [Naming convention: e.g., camelCase for variables, PascalCase for types]
- [Import ordering: e.g., stdlib > external > internal > relative]
- [Error handling pattern: e.g., Result types, try/catch, error codes]
- [Test file convention: e.g., __tests__/foo.test.ts, foo_test.go]

## Architecture
```text
src/
  [layer]/       # [Purpose]
  [layer]/       # [Purpose]
  [layer]/       # [Purpose]
```

Key decisions:
- [State management approach]
- [API pattern: REST/GraphQL/RPC]
- [Database and ORM]

## Gotchas
- [Thing that breaks if you forget it]
- [Non-obvious dependency or ordering requirement]
- [Environment variable that must be set]
- [Command that must run after schema/config changes]

## Do NOT
- [Anti-pattern specific to this project]
- [File or directory to never modify directly]
- [Deprecated approach that still appears in old code]

```
