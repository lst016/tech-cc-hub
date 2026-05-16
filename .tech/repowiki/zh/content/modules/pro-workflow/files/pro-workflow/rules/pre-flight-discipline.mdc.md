# pro-workflow/rules/pre-flight-discipline.mdc

> 模块：`pro-workflow` · 语言：`unknown` · 行数：63

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```unknown
---
description: Pre-flight discipline - prevent silent assumptions, scope creep, and drive-by edits before they happen
alwaysApply: true
---

Quality gates and self-correction catch mistakes after the fact. These rules prevent the upstream failures.

## 1. Surface, don't assume

- State assumptions explicitly. If uncertain, ask before coding.
- If the request has multiple interpretations, present them - never pick silently.
- If a simpler approach exists than what was asked, say so.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Minimum viable code

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or configurability that wasn't requested.
- No error handling for scenarios that cannot happen.
- If the diff is 200 lines and 50 would do, rewrite it.

Senior-engineer test: would they call this overcomplicated? If yes, simplify before showing.

## 3. Stay in your lane

Every changed line must trace to the user's request.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style even if you'd write it differently.
- Notice unrelated dead code? Mention it. Don't delete it.

When your changes orphan something:
- Remove imports/symbols that *your* edit made unused.
- Leave pre-existing dead code alone unless asked.

## 4. Verifiable goals over imperatives

Convert tasks into verification loops:

| Imperative | Verifiable goal |
|------------|-----------------|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug" | "Write a failing test that reproduces it, then make it pass" |
| "Refactor X" | "Tests pass before and after; behavior unchanged" |

For multi-step work, plan as `step → verify`:

```
1. [step] → verify: [check]
2. [step] → verify: [check]
3. [step] → verify: [check]
```

Strong success criteria let the loop run independently. "Make it work" requires constant re-clarification.

---

**Tradeoff:** These rules bias toward caution over speed. For trivial fixes (typos, one-liners, obvious renames), use judgment - not every change needs the full rigor.

**Source:** Adapted from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls, via [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) (MIT).

```
