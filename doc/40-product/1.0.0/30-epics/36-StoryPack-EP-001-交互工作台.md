---
doc_id: "PRD-100-36"
title: "36-StoryPack-EP-001-交互工作台"
doc_type: "epic"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "Product"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "story-pack"
  - "ep-001"
---

# 36-StoryPack-EP-001-交互工作台

## Purpose
把 `EP-001` 拆成可进入设计、开发和测试的用户故事包。

## Scope
本文件覆盖交互工作台相关故事、依赖、验收和实现分配建议。

## Actors / Owners
- Owner: Product
- Readers: 前端、后端、测试

## Inputs / Outputs
- Inputs: [31-Epic-交互工作台.md](./31-Epic-%E4%BA%A4%E4%BA%92%E5%B7%A5%E4%BD%9C%E5%8F%B0.md)
- Outputs: Story Pack、验收标准、依赖关系

## Core Concepts
- `SP-EP001`
- `US-001 ~ US-004`
- `Blocking Story`

## Behavior / Flow
### Story List

`US-001: MUST - As a 高频 Agent 用户, I want to start a chat session with a clear active agent so that I know who is executing my request.`
Acceptance Criteria:
- 页面首次进入时默认选中 `Claude Code`
- `Claude Code / Codex` 为互斥二选一
- 新建 Session 时保存当前聊天 Agent 绑定
- Agent 切换行为写入事件流

`US-002: MUST - As a 高频 Agent 用户, I want to send a prompt and immediately see execution progress so that I know the system is working.`
Acceptance Criteria:
- 发送后 1 秒内出现执行中状态
- 执行中的事件进入时间线
- 停止、失败、完成均有清晰反馈

`US-003: SHOULD - As a 高频 Agent 用户, I want to resume recent sessions from the sidebar so that I can continue work without losing context.`
Acceptance Criteria:
- 侧边栏展示最近 Session 列表
- 点击列表项可以恢复会话视图
- 恢复后看到最近消息和关键事件

`US-004: MUST - As a 高频 Agent 用户, I want to jump from chat to replay, analysis, and artifacts so that I can stay inside one product loop.`
Acceptance Criteria:
- 聊天页能打开 Replay / Analysis / Artifacts
- 若当前 Session 尚未生成对应产物，展示明确状态
- 打开动作写入前端事件

### Dependencies

| Story | Depends On |
|---|---|
| `US-001` | 无 |
| `US-002` | `US-001` |
| `US-003` | `US-001`, `US-002` |
| `US-004` | `US-002` |

### Suggested Delivery Split
- Frontend-first: `US-001`, `US-003`, `US-004`
- Backend-first: `US-002`
- Joint verification: `US-004`

## Interfaces / Types
- `Story ID`
- `Priority`
- `Acceptance Criteria`
- `Dependency`
- `Owner Split`

## Failure Modes
- 如果故事只写一句话不带验收，开发会再次回到“口头理解”。
- 如果 Story Pack 不写依赖，排期很容易错乱。

## Observability
- 关键事件:
  - `chat_agent_selected`
  - `session_created`
  - `user_input_submitted`
  - `replay_opened`
  - `analysis_opened`

## Open Questions / ADR Links
- 关联任务单见 [46-实施任务单-EP-001-交互工作台.md](../40-delivery/46-%E5%AE%9E%E6%96%BD%E4%BB%BB%E5%8A%A1%E5%8D%95-EP-001-%E4%BA%A4%E4%BA%92%E5%B7%A5%E4%BD%9C%E5%8F%B0.md)
