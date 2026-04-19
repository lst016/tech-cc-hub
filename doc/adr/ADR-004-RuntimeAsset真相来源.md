---
doc_id: "ADR-004"
title: "ADR-004-RuntimeAsset真相来源"
doc_type: "decision"
layer: "adr"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "adr"
  - "storage"
---

# ADR-004-RuntimeAsset真相来源

- Status: Accepted
- Date: 2026-04-19
- Owners: CLAW Core

## Context
CLAW v1 被定义为 local-first / single-user / desktop-first。如果运行时真相落在云端或 Git，同步和恢复会出现大量不确定性；如果所有资产都混在一个目录下，又会损害治理能力。

## Decision
将本地文件系统定义为 v1 RuntimeAsset 的事实真相来源：
- `runtime/` 保存会话、事件、快照和任务图
- `artifacts/` 保存回放、分析、冲突等可读产物
- Git 只同步 `SpecAsset` 和静态文档，不作为运行时真相
- 未来若替换为数据库，只允许替换存储后端，不改变语义分层

## Consequences
- 好处：
  - 保持 local-first 一致性
  - 便于离线运行、回放和本地证据留存
  - 为将来数据库迁移保留了抽象边界
- 代价：
  - 需要更严格的目录和命名治理
  - 跨设备协作在 v1 中不是主路径

## Links
- [26-存储与Markdown产物规范.md](../20-specs/26-%E5%AD%98%E5%82%A8%E4%B8%8EMarkdown%E4%BA%A7%E7%89%A9%E8%A7%84%E8%8C%83.md)
- [01-设计原则与非目标.md](../00-overview/01-%E8%AE%BE%E8%AE%A1%E5%8E%9F%E5%88%99%E4%B8%8E%E9%9D%9E%E7%9B%AE%E6%A0%87.md)
- [34-MVP切片与迭代路线图.md](../30-operations/34-MVP%E5%88%87%E7%89%87%E4%B8%8E%E8%BF%AD%E4%BB%A3%E8%B7%AF%E7%BA%BF%E5%9B%BE.md)
