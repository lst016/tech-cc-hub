# doc/40-product/1.0.0/40-delivery/58-S0功能点细分清单.md

> 模块：`doc` · 语言：`markdown` · 行数：85

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-58"
title: "58-S0功能点细分清单"
doc_type: "delivery"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "Product"
  - "Engineering"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "feature-breakdown"
  - "s0"
---

# 58-S0功能点细分清单

## Purpose
把 `S0 / FE-M1 / BE-M1` 拆到可直接开发、测试和验收的功能点级别。

## Scope
本文件只覆盖第一开发切片，不展开 `Task Graph` 与 `Replay/Analysis` 深水区能力。

## Interfaces / Types
| Area | Feature ID | Description | Acceptance |
|---|---|---|---|
| `Shell` | `S0-FE-001` | 桌面三栏壳子 + 底部抽屉 | 首屏结构稳定、桌面宽度可用 |
| `Sidebar` | `S0-FE-002` | Session 列表与激活态 | 能切换当前 Session |
| `Chat` | `S0-FE-003` | Chat Workspace 主消息流 | 能显示 human / assistant 消息 |
| `Agent Picker` | `S0-FE-004` | `Claude Code / Codex` 二选一 | 默认 `Claude Code`，切换互斥 |
| `Composer` | `S0-FE-005` | 输入框 + 提交 | 能发消息、清空输入 |
| `Timeline` | `S0-FE-006` | 右侧时间线 | 新事件出现后可见 |
| `Drawer` | `S0-FE-007` | Artifacts / Events 底部抽屉 | 能切换开合 |
| `Session API` | `S0-BE-001` | 列出 / 创建 Session | 基础生命周期可用 |
| `Chat API` | `S0-BE-002` | 提交消息 + 生成响应 | 返回最小 assistant 输出 |
| `Event API` | `S0-BE-003` | Session 事件查询 | 时间线可拉取 |
| `Event Stream` | `S0-BE-004` | WebSocket 事件推送 | 前端能实时收到事件 |
| `Health` | `S0-BE-005` | 健康检查 | QA 能快速确认服务存活 |

## Behavior / Flow
### FE Delivery Order

1. `S0-FE-001`
2. `S0-FE-002`
3. `S0-FE-003`
4. `S0-FE-004`
5. `S0-FE-005`
6. `S0-FE-006`
7. `S0-FE-007`

### BE Delivery Order

1. `S0-BE-005`
2. `S0-BE-001`
3. `S0-BE-003`
4. `S0-BE-002`
5. `S0-BE-004`

### QA Main Cases

1. 打开应用，默认显示 Session Sidebar 和 Chat Workspace
2. 新建 Session 后，侧栏出现新 Session
3. 默认 Agent 为 `Claude Code`
4. 切换到 `Codex` 后，当前 Session 头部正确更新
5. 发送消息后：
   - 消息流出现 human message
   - 时间线出现提交事件
   - assistant response 返回
6. 打开底部抽屉后能看到事件和产物占位

## Failure Modes
- 如果 `S0-BE-002` 先于 `S0-BE-001`，前端无法稳定绑定 Session。
- 如果 `S0-FE-004` 没先锁成互斥模型，后续会在聊天主轴重新返工。

## Observability
- 每个功能点都至少要有：
  - 1 个状态事件
  - 1 个失败路径
  - 1 条 QA 验收用例


```
