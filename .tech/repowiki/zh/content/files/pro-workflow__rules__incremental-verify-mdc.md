# pro-workflow/rules/incremental-verify.mdc

> 模块：`pro-workflow` · 语言：`unknown` · 行数：42

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```unknown
---
description: Verify each behavior before building the next. One test, one implementation, one commit. No bulk-writing tests for behavior that does not yet exist.
globs:
alwaysApply: true
---

# Incremental Verification

## Principle

Behavior you have not written cannot be tested honestly. Writing many tests
before any implementation produces tests shaped by **imagined** behavior,
not actual behavior — they assert on function signatures and data shapes,
survive real regressions silently, and break on harmless refactors.

## Rule

For every new behavior: write one failing assertion, write the minimum
implementation that makes it pass, commit, repeat. No batched test
authoring. No scaffolding dozens of test cases before a single green run.

## Checklist

- [ ] Is there exactly one failing test right now? If more, split the commit.
- [ ] Does the test exercise a public interface a caller would actually hit?
- [ ] Would the test still make sense after a full internal refactor?
- [ ] Was the implementation written **after** seeing the test fail?

## Failure modes to catch

- "Shape tests": asserting on object keys, array length, or types rather
  than observable output. Rewrite against a caller's perspective.
- "Mock-driven tests": the test mostly configures mocks then asserts the
  mock was called. Move the mock to a system boundary or delete it.
- "Green before red": if every test you wrote passed on the first run,
  the test did not drive the design — treat it as suspect.

## When to break the rule

Exploratory spikes where you are probing an unknown API. Mark the spike
branch as throwaway and do not merge its tests.

```
