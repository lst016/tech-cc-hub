# pro-workflow/templates/split-claude-md/CLAUDE.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：44

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Project: [Project Name]

## Quick Links
- Workflow rules: see [AGENTS.md](./AGENTS.md)
- Style/personality: see [SOUL.md](./SOUL.md)
- Custom commands: see [COMMANDS.md](./COMMANDS.md)
- Learned patterns: see [LEARNED.md](./LEARNED.md)

## Project Overview
[Brief description of what this project does]

## Quick Start
```bash
# Install dependencies
npm install

# Start development
npm run dev

# Run tests
npm test
```

## Architecture
```
src/
├── components/    # UI components
├── lib/          # Utilities
├── pages/        # Routes
└── api/          # Backend
```

## Key Files
- `src/index.ts` - Entry point
- `src/config.ts` - Configuration
- `.env.example` - Required environment variables

## Testing
```bash
npm test                    # All tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

```
