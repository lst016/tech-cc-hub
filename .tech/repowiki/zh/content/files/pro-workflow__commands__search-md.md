# pro-workflow/commands/search.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：53

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# /search <query> - Search Learnings

Search the pro-workflow learnings database using full-text search (BM25).

## Usage

```
/search testing
/search "file paths"
/search git commit
```

## Search Features

- **BM25 ranking**: Results are ranked by relevance
- **Prefix matching**: "test" matches "testing", "tests", etc.
- **Phrase search**: Use quotes for exact phrases
- **Multiple terms**: Space-separated terms are OR'd together

## Output Format

```
Found 3 learnings matching "testing":

#1 [Testing] Always run tests before commit
   Mistake: Pushed broken code
   Applied: 5 times

#2 [Testing] Use --related flag to run only affected tests
   Mistake: Ran full test suite unnecessarily
   Applied: 2 times

#3 [Quality] Mock external APIs in tests
   Mistake: Tests failed due to network issues
   Applied: 1 time
```

## Options

- **Category filter**: `/search testing category:Quality`
- **Project filter**: `/search testing project:my-app`
- **Limit results**: Results are limited to top 10 by default

## Related Commands

- `/learn` - Add a new learning to the database
- `/list` - List all learnings (no search filter)
- `/stats` - Show learning analytics (coming soon)

---

**Trigger:** Use when user asks "how did I handle...", "what was the rule for...", or needs to recall a past learning.

```
