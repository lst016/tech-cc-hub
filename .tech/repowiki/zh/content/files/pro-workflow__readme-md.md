# pro-workflow/README.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：466

## 文件职责

这是配置文件，定义构建、运行、依赖或工具行为。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
<p align="center">
  <img src="assets/banner.svg" alt="Pro Workflow" width="100%"/>
</p>

<p align="center">
  <a href="https://github.com/rohitg00/pro-workflow/stargazers"><img src="https://img.shields.io/github/stars/rohitg00/pro-workflow?style=for-the-badge&logo=github&color=D97757&labelColor=1e1e2e" alt="Stars"/></a>
  <a href="https://www.npmjs.com/package/pro-workflow"><img src="https://img.shields.io/npm/v/pro-workflow?style=for-the-badge&logo=npm&color=E8926F&labelColor=1e1e2e" alt="npm"/></a>
  <a href="https://github.com/rohitg00/pro-workflow/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge&labelColor=1e1e2e" alt="License"/></a>
  <a href="https://agenstskills.com"><img src="https://img.shields.io/badge/SkillKit-32%2B%20agents-f59e0b?style=for-the-badge&labelColor=1e1e2e" alt="SkillKit"/></a>
  <a href="https://rohitg00-pro-workflow.mintlify.app/"><img src="https://img.shields.io/badge/Docs-Mintlify-0D9373?style=for-the-badge&logo=mintlify&labelColor=1e1e2e" alt="Docs"/></a>
</p>

<h3 align="center">Your Claude Code gets smarter every session.</h3>

<p align="center">
  Self-correcting memory + persistent FTS5-indexed wikis + auto-research loop, all on one SQLite store.<br/>
  Correct Claude once &mdash; it never repeats the mistake. Build a wiki on a topic &mdash; it grows itself overnight.<br/>
  <b>34 skills</b> &bull; <b>8 agents</b> &bull; <b>22 commands</b> &bull; <b>37 hook scripts across 24 events</b><br/>
  Works with <b>Claude Code</b>, <b>Cursor</b>, and <b>32+ agents</b> via SkillKit.
</p>

---

## The Problem

You correct Claude the same way 50 times. You explain conventions every new session. Context compacts, learnings vanish, mistakes repeat. You research the same topic in three different sessions because there is nowhere durable for the answers to land.

**Every Claude Code user hits this wall.**

## The Solution

Pro Workflow puts a single SQLite store underneath every session.

- **Self-correction memory** &mdash; every correction becomes a rule, FTS5-searchable, auto-loaded on session start.
- **Knowledge plane** &mdash; persistent research wikis on disk + FTS5 shadow index, queryable from any session, optionally grown by an auto-research loop.
- **Quality gates** &mdash; LLM-powered hooks, deterministic git/secret guards, compaction-aware state, cost tracking.

After 50 sessions you barely correct anything. After a week of auto-research, your wiki on a topic is denser than the curated lists you started from.

<p align="center">
  <img src="assets/self-correction-demo.svg" alt="Self-Correction Loop" width="700"/>
</p>

```
Session 1:  You → "Don't mock the database in tests"
            Claude → Proposes rule → You approve → Saved to SQLite

Session 2:  SessionStart loads all learnings + lists your wikis
            UserPromptSubmit auto-injects top wiki hits when relevant
            Claude writes integration tests, cites the right wiki page

Session 50: Correction rate near zero. Wiki has 200 cited claims.
```

---

## Install

```bash
/plugin marketplace add rohitg00/pro-workflow
/plugin install pro-workflow@pro-workflow
```

<details>
<summary>Other install methods</summary>

```bash
# Cursor
/add-plugin pro-workflow

# Any agent via SkillKit
npx skillkit install pro-workflow

# Manual
git clone https://github.com/rohitg00/pro-workflow.git /tmp/pw
cp -r /tmp/pw/templates/split-claude-md/* ./.claude/

# Build SQLite-backed components
cd ~/.claude/plugins/*/pro-workflow && npm install && npm run build
```

</details>

---

## 60-second tour

```bash
# 1. Self-correction (existing)
/learn-rule          # capture a correction
/wrap-up             # end session, persist learnings, audit changes
/insights            # heatmaps, trends, productivity

# 2. Knowledge plane (v3.3, new)
/wiki init agent-memory --title "Agent Memory" --flavor research
/wiki page agent-memory wiki/concepts/episodic-memory.md --type concept
/wiki ask "what is episodic memory" --wiki agent-memory

# 3. Auto-research (budget-capped, opt-in)
/wiki seed agent-memory "memory consolidation in agents"
/wiki research agent-memory --max-pages 5 --budget-usd 0.50

# 4. Hybrid retrie
... (truncated)
```
