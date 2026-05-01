---
doc_id: "DOC-INDEX-CONTRACTS"
title: "20-Contracts 工程契约索引"
doc_type: "index"
layer: "L2"
status: "active"
version: "1.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "frontend"
  - "electron"
source_of_truth: true
tags:
  - "tech-cc-hub"
  - "index"
  - "contracts"
---

# 20-Contracts / 工程契约索引

本层定义跨模块的稳定工程契约：IPC 接口、事件模型、状态机、数据模型、配置模型。这些是前端和 Electron 主进程之间的 shared truth。

## 现有契约来源

当前契约尚未提取为独立文档，主要存在于代码和旧文档中：

### IPC 接口

- 定义：`src/electron/ipc-handlers.ts`
- 事件类型：`src/electron/types.ts`、`src/ui/types.ts`
- 消息格式规范见 [AGENTS.md](../../AGENTS.md) IPC 通信章节

### 事件模型

- 应用层事件：`src/ui/events.ts` — 客户端事件枚举
- Agent 执行事件：`src/shared/activity-rail-model.ts` — `ActivityNode`、`NodeKind`、`NodeStatus`

### 状态机

- 会话生命周期：Session → Message → Event 状态转换
- 存储 schema：`better-sqlite3` 表结构定义在 `src/electron/libs/session-store.ts`

### 数据模型

| 实体 | 定义位置 |
|------|---------|
| Session | `src/electron/libs/session-store.ts` |
| Message | `src/electron/libs/session-store.ts` |
| ActivityRail Node | `src/shared/activity-rail-model.ts` |
| Store (Zustand) | `src/ui/store/useAppStore.ts` |

### 配置模型

- 全局运行时配置：`src/electron/libs/config.ts` + `agent-runtime.json`
- Settings 持久化：`src/ui/components/settings/` 目录下各 SettingsPage

## 已提取 Spec

| 文档 | 说明 |
|------|------|
| [ipc/spec.md](ipc/spec.md) | IPC 通道、消息格式、错误码枚举 |
| [events/spec.md](events/spec.md) | 应用事件与 Agent 执行事件类型定义 |
| [session-lifecycle/spec.md](session-lifecycle/spec.md) | 会话/消息/事件状态机 |
| [config/spec.md](config/spec.md) | 全局配置 schema、API profiles、Skill inventory、环境变量 |

## 关联目录

| 目录 | 说明 |
|------|------|
| `doc/10-architecture/` | 架构视图与容器图 |
| `doc/40-engineering/` | 各模块实现方案 |
| `doc/50-quality/` | 契约变更后的验收门禁 |
