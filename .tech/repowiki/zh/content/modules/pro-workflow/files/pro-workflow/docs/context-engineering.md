# pro-workflow/docs/context-engineering.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：122

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Context Engineering Reference

The emerging discipline of building systems that provide the right information to LLMs at the right time. Not prompt engineering (crafting one message) but engineering the entire information pipeline.

## The Four Operations

Every context system performs these operations:

| Operation | What It Does | Example |
|-----------|-------------|---------|
| **Write** | Persist information for later | CLAUDE.md, LEARNED.md, auto-memory |
| **Select** | Choose what to load now | Ancestor loading, lazy descendant loading, RAG |
| **Compress** | Reduce tokens while preserving meaning | Compaction, summarization, deduplication |
| **Isolate** | Separate contexts to prevent pollution | Sub-agents, worktrees, `context: fork` |

Every tool that works with LLMs implements some combination of these. The skill is knowing which to apply when.

## Memory Taxonomy

Four types of memory, each with different persistence and access patterns:

| Type | What | Where | Loaded When |
|------|------|-------|-------------|
| **Episodic** | Session history, corrections, what happened | Auto-memory, LEARNED.md | Session start |
| **Semantic** | Facts, conventions, architecture | CLAUDE.md, AGENTS.md | Ancestor walk + lazy |
| **Procedural** | How to do things, workflows | Skills, commands | On invocation |
| **Shared** | Cross-agent knowledge, team state | Shared tasks, mailbox, KV | On access |

Episodic decays (old sessions matter less). Semantic is stable. Procedural is invoked. Shared is synchronized.

## AGENTS.md as Universal Standard

AGENTS.md originated in Codex but has become the cross-tool standard for project instructions. Tools that read it:

| Tool | File | Notes |
|------|------|-------|
| Claude Code | CLAUDE.md | Also reads AGENTS.md in same directory |
| Codex | AGENTS.md | Primary instruction file |
| Cursor | .cursorrules, AGENTS.md | Reads both |
| Gemini CLI | GEMINI.md, AGENTS.md | Falls back to AGENTS.md |
| GitHub Copilot | .github/copilot-instructions.md, AGENTS.md | Reads AGENTS.md |
| Windsurf | .windsurfrules, AGENTS.md | Reads AGENTS.md |
| Cline | .clinerules, AGENTS.md | Reads AGENTS.md |
| Amazon Q | AGENTS.md | Reads it directly |
| Augment Code | AGENTS.md | Reads it directly |
| Kiro | AGENTS.md | Reads it directly |
| OpenCode | AGENTS.md | Reads it directly |

Recommendation: maintain an AGENTS.md with build commands, code style, architecture, and gotchas. It works everywhere. Add tool-specific files only for tool-specific features (hooks, skills, MCP config).

## Compaction Triggers

When tools auto-compress context to stay within limits:

| Tool | Trigger | What Happens |
|------|---------|-------------|
| Claude Code | 86-92% of window | Summarizes conversation, destroys KV cache |
| Gemini CLI | ~50% of window | Earlier compaction threshold |
| Codex | ~90% of window | Summarizes and continues |
| Cursor | Varies | Model-dependent compaction |

Each compaction costs ~$0.40 in API calls and destroys the KV cache, forcing a cold restart. Minimizing compaction events is one of the highest-leverage optimizations.

### Strategies to Reduce Compaction

1. **Keep CLAUDE.md lean** (< 60 lines root, < 150 max)
2. **Use sub-agents for exploration** (their context is isolated)
3. **Use `context: fork` on heavy skills** (runs in separate context)
4. **Compact manually at task boundaries** (preserves logical coherence)
5. **Split monolith CLAUDE.md** into package-level files (only loads what's needed)

## Key Research

### ACE: Agentic Context Engineering (ICLR 2026)

Showed that a 17-problem accuracy gap between "same model, different harness" comes from context engineering, not model capability. The scaffolding around the model matters more than the model itself.

Key finding: on SWE-bench, the same base model scored dramatically differently depending on how context was managed. The best-performing system used selective file retrieval, iterative context refinement, and structured memory.

### MCE: Multi-turn Context Engineering

Demonstrated that multi-turn context management (deciding what to keep, drop, or summarize across turns) has a larger impact on task completion than single-turn pro
... (truncated)
```
