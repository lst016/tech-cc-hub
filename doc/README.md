---
doc_id: "DOC-README-V2"
title: "tech-cc-hub 文档体系 v2"
doc_type: "overview"
layer: "root"
status: "active"
version: "2.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "contributors"
  - "frontend"
  - "electron"
source_of_truth: true
tags:
  - "tech-cc-hub"
  - "docs"
  - "readme"
  - "v2"
---

# tech-cc-hub 文档体系 v2

> 本文档是 tech-cc-hub 项目文档的唯一入口。新增文档必须遵守 [软件工程文档体系规范](_standards/软件工程文档体系规范.md)。
>
> **注意：** 原 CLAW v1 编号体系已冻结。不要继续在 `40-product/1.0.0/40-delivery/` 下追加 73+ 流水账编号。

---

## Start Here

| 文档 | 说明 |
|------|------|
| [CLAUDE.md](../CLAUDE.md) | 开发环境、命令、编码规范、启动口径 |
| [AGENTS.md](../AGENTS.md) | 项目入口规则、当前接力上下文、Session 级决策 |
| [软件工程文档体系规范](_standards/软件工程文档体系规范.md) | 本文档体系的规则定义 |
| [文档贡献规范](_standards/文档贡献规范.md) | 旧版规范（迁移中，以体系规范为准） |

---

## Product（产品需求）

| 文档 | 状态 |
|------|------|
| [40-产品开发文档索引](40-product/40-产品开发文档索引.md) | 旧版索引（CLAW 体系） |

> 产品层迁移尚未开始。当前 PRD、用户故事、需求追踪仍在 `doc/40-product/1.0.0/` 下以旧编号体系存在。

---

## Architecture（系统架构）

| 文档 | 说明 |
|------|------|
| [10-系统上下文图](10-architecture/10-系统上下文图.md) | C1 系统边界 |
| [11-系统容器图](10-architecture/11-系统容器图.md) | C2 容器层级 |
| [12-控制平面组件图](10-architecture/12-控制平面组件图.md) | C3 控制平面 |
| [13-执行平面组件图](10-architecture/13-执行平面组件图.md) | C3 执行平面 |
| [14-数据与智能平面组件图](10-architecture/14-数据与智能平面组件图.md) | C3 数据平面 |
| [15-核心流程图](10-architecture/15-核心流程图.md) | 核心流程 |

---

## Contracts（工程契约）

| 文档 | 说明 |
|------|------|
| [20-Contracts 索引](20-contracts/INDEX.md) | IPC、事件、状态机、数据模型、配置模型 |

---

## Engineering（实现方案）

| 文档 | 说明 |
|------|------|
| [40-Engineering 索引](40-engineering/INDEX.md) | 模块地图、组件入口、关联代码路径 |

活跃模块：

| 模块 | Spec | 入口代码 |
|------|------|---------|
| Chat / Composer | [spec](40-engineering/chat-composer/spec.md) | `src/ui/components/PromptInput.tsx` |
| Preview / Browser Workbench | [spec](40-engineering/preview-workbench/spec.md) | `src/ui/components/PreviewPanel.tsx` |
| Activity Rail / Trace | [spec](40-engineering/activity-rail/spec.md) | `src/ui/components/ActivityRail.tsx` |
| Settings / Skills | [spec](40-engineering/settings-skills/spec.md) | `src/ui/components/settings/` |
| Electron Main / IPC | [spec](40-engineering/electron-ipc/spec.md) | `src/electron/main.ts` |

---

## Quality & Release（质量与发布）

| 文档 | 说明 |
|------|------|
| [50-Quality QA 索引](50-quality/INDEX.md) | QA 规范、验收核对表、测试 |
| [80-Operations 运维索引](80-operations/INDEX.md) | 构建、打包、发布、自动更新 |

---

## Decisions（技术决策）

> 暂无独立决策索引。现有 ADR 分散在以下位置：
> - `doc/30-operations/35-ADR目录.md` — CLAW 旧版 ADR 目录
> - `doc/adr/` — CLAW ADR 记录（ADR-001 ~ 005）
>
> 后续应统一迁入 `doc/60-decisions/` 并建立索引。

---

## Research（调研与参考）

| 目录 | 说明 |
|------|------|
| `doc/00-research/AionUi-调研报告/` | AionUi 工作台 UI 参考 |
| `doc/00-research/AionUi/` | AionUi 源码镜像（reference，不进入主线索引） |
| `doc/superpowers/` | 早期研究材料 |

---

## Archive（历史归档）

| 文档 | 说明 |
|------|------|
| [90-Archive 索引](90-archive/INDEX.md) | 已完成迭代计划、复盘、CLAW 旧版文档 |

---

## 历史草稿

以下文档保留在 `doc/` 根目录，属于 CLAW 早期草稿，不作为当前事实来源：

- [CLAW.md](CLAW.md)
- [CLAW-需求分析文档.md](CLAW-需求分析文档.md)
- [CLAW-v1.0-需求架构Spec.md](CLAW-v1.0-需求架构Spec.md)

---

## 治理

- [软件工程文档体系规范](_standards/软件工程文档体系规范.md) — 本文档体系的完整规则
- [文档贡献规范](_standards/文档贡献规范.md) — 旧版规范（部分内容待合并）
- [Markdown Frontmatter 规范](_standards/Markdown-Frontmatter-规范.md)
- [Front Matter 校验脚本](_tools/validate_frontmatter.py)

---

## 迁移进度

- [x] 冻结旧编号增长（禁止 73+ 流水账）
- [x] 建立新目录骨架（00-90 层）
- [x] 创建 Initial INDEX（40-engineering、50-quality、20-contracts、80-operations、90-archive）
- [x] 重写 doc/README.md 为 v2 入口
- [x] 分流 40-delivery/59-72 为长期规范 / spec / runbook / archive（11 篇，2026-05-01）
- [x] 逐模块提取 spec（Chat、Preview、Activity Rail、Settings、Electron/IPC）— 5/5 完成
- [x] 补充 20-contracts 层独立 spec 文档（ipc、events、session-lifecycle、config）
- [ ] 迁移 80-operations 下的正式 runbook
- [x] 补充坏链检查与孤儿文档检查脚本 ([doc/_tools/check_doc_links.py](_tools/check_doc_links.py))
