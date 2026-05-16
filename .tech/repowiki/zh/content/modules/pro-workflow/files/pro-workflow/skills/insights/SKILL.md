# pro-workflow/skills/insights/SKILL.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：107

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
name: insights
description: Show session analytics, learning patterns, correction trends, heatmaps, and productivity metrics. Computes stats from project memory and session history. Use when asking for stats, statistics, progress, how am I doing, coding history, or dashboard.
---

# Session Insights

Surface patterns from learnings and session history.

## Trigger

Use when asking "show stats", "how am I doing", "analytics", "insights", "heatmap", or "correction rate".

## Data Sources

Gather data from these locations before computing metrics:

```bash
# Session history and learnings
cat .claude/LEARNED.md 2>/dev/null || cat CLAUDE.md | grep -A999 "LEARNED"
cat .claude/learning-log.md 2>/dev/null

# Session activity
git log --oneline --since="today" --author="$(git config user.name)"
git diff --stat
```

A **correction** is any instance where the user redirected, fixed, or overrode agent output during a session. Count `[LEARN]` entries and explicit correction markers in session history.

## What It Shows

### Session Summary

```
Session Insights
  Duration: 47 min
  Edits: 23 files modified
  Corrections: 2 self-corrections applied
  Learnings: 3 new patterns captured
  Context: 62% used (safe)
```

### Learning Analytics

```
Learning Insights (42 total)

Top categories:
  Testing     12 learnings (29%)
  Navigation   8 learnings (19%)
  Git          7 learnings (17%)
  Quality      6 learnings (14%)

Most applied:
  #12 [Testing] Run tests before commit — 15 times
  #8  [Navigation] Confirm path for common names — 11 times

Stale learnings (never applied):
  #15 [Editing] Prefer named exports — 0 times (45 days old)
```

### Correction Heatmap

```
Correction Heatmap

By category (all time):
  ████████████ Testing      34 corrections
  ████████     Navigation   22 corrections
  ██████       Git          18 corrections
  ████         Quality      12 corrections

Hot learnings (most corrected, least learned):
  - [Testing] Mock external deps — corrected 8x, learned 0x
    → Consider: /learn-rule to capture this permanently

Cold learnings (learned but never applied):
  - [Editing] Use named exports — learned 45 days ago, applied 0x
    → Consider removing if no longer relevant
```

### Productivity Metrics

```
Productivity (last 10 sessions)
  Avg session: 35 min
  Avg edits/session: 18
  Correction rate: 12% (improving)
  Learning capture: 2.1 per session
```

## Guardrails

- Use actual data from project memory and session history.
- Surface actionable suggestions, not just numbers.
- Flag recurring corrections that should become permanent rules.
- Identify stale learnings that may no longer be relevant.

## Output

Formatted analytics report with:
- Current session stats
- Category breakdown
- Most/least applied learnings
- Correction trends with suggestions
- Productivity metrics over time

```
