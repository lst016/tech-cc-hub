# doc/_standards/软件工程文档体系规范.md

> 模块：`doc` · 语言：`markdown` · 行数：452

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "DOC-GOVERNANCE-V2"
title: "软件工程文档体系规范"
doc_type: "standard"
layer: "meta"
status: "active"
version: "2.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
tags:
  - "tech-cc-hub"
  - "docs"
  - "governance"
  - "software-engineering"
  - "standard"
---

# 软件工程文档体系规范

## 1. 目标

`doc/` 不是聊天记录、计划垃圾桶或临时灵感池。

它必须服务软件工程中的四件事：

1. 让新人知道系统是什么、为什么存在、当前边界在哪里。
2. 让实现者知道要做什么、接口是什么、验收怎么判断。
3. 让维护者知道当前架构、数据流、状态机和风险点。
4. 让未来的 Agent 能基于稳定文档继续工作，而不是每轮重新猜。

本规范用于替代早期“按编号继续追加”的写法。后续新增文档必须先判断文档类型和生命周期，再决定路径与模板。

## 2. 当前问题诊断

当前 `doc/` 的主要问题不是文档太少，而是边界混乱：

| 问题 | 表现 | 后果 |
|---|---|---|
| 编号流水账 | `40-delivery` 下面持续追加 `59`、`60`、`61`、`62`、`63`、`64`、`65`、`68`、`72` | 编号变成时间顺序，不再表达信息架构 |
| 主线与草稿混放 | PRD、实现计划、复盘、调研、QA 规则都在同一层 | 读者无法判断哪个是事实、哪个是计划、哪个已过期 |
| 长期规范与短期任务混放 | 开发流程、一次性修复计划、发布说明混在一起 | 后续 Agent 容易把临时结论当长期规则 |
| Research 镜像污染索引 | AionUi 源码镜像在 `doc/00-research/AionUi` 下被普通文件扫描看到 | 文档工具很难区分“参考源码”和“正式文档” |
| 缺少生命周期 | 很多文档没有清晰的 active / draft / superseded / archived 迁移口径 | 旧文档会持续误导实现 |
| 缺少读者角色 | 文档没有明确写给产品、架构、前端、后端、QA 还是发布维护者 | 内容粒度失控 |

## 3. 文档分层

后续文档只允许进入以下层级之一。

| Layer | 目录 | 目的 | 例子 |
|---|---|---|---|
| `L0` | `doc/00-overview/` | 项目定位、术语、导航、成功指标 | 产品定义、术语表、文档入口 |
| `L1` | `doc/10-architecture/` | 稳定架构视图 | C4、容器图、核心组件图 |
| `L2` | `doc/20-contracts/` | 稳定工程契约 | IPC、事件、状态机、数据模型、配置模型 |
| `L3` | `doc/30-product/` | 产品需求与版本范围 | PRD、用户故事、需求追踪 |
| `L4` | `doc/40-engineering/` | 实现方案与模块地图 | 前端结构、Electron 主进程、Preview、Settings |
| `L5` | `doc/50-quality/` | QA、验收、发布、可观测 | QA plan、release checklist、故障演练 |
| `L6` | `doc/60-decisions/` | ADR 和重大决策 | ADR-001、技术选型记录 |
| `L7` | `doc/70-research/` | 外部调研与参考材料 | AionUi 调研总结、竞品对比 |
| `L8` | `doc/80-operations/` | 日常运维与使用手册 | 本地启动、打包发布、更新机制 |
| `L9` | `doc/90-archive/` | 历史草稿、过期计划、旧版本 | 已废弃 PRD、一次性计划、复盘 |
| `meta` | `doc/_standards/` | 文档规范 | 本文件、front matter 规范 |
| `template` | `doc/_templates/` | 模板 | PRD 模板、ADR 模板、QA 模板 |
| `tool` | `doc/_tools/` | 文档自动化脚本 | front matter 校验、坏链检查 |

## 4. 文档类型

每份文档必须属于一种主类型。不要一篇文档同时承担 PRD、架构、计划和复盘。

| doc_type | 用途 | 必须回答的问题 |
|---|---|---|
| `overview` | 项目总览 | 这是什么、为什么做、边界是什么 |
| `prd` | 产品需求 | 用户是谁、场景是什么、成功标准是什么 |
| `spec` | 工程规格 | 对象、接口、状态、错误、边界是什么 |
| `architecture` | 架构视图 | 系统如何分层、模块如何协作 |
| `module-map` | 代码结构地图 | 当前实现在哪里、入口是什么、依赖关系是什么 |
| `runbook` | 操作手册 | 如何执行、失败如何恢复 |
| `qa-plan` | 验收计划 | 验什么、怎么验、通过标准是什么 |
| `release-note` | 发布说明 | 本版本改了什么、风险是什么、如何回滚 |
| `adr` | 架构决策 | 选项是什么、为什么这么选、后果是什么 |
| `research` | 调研 | 来源是什么、结论是什么、哪些可复用 |
| `iteration-plan` | 一次性计划 | 本轮做什么、切片是什么、完成后归档到哪里 |
| `postmortem` | 复盘 | 发生了什么、根因是什么、以后如何避免 |
| `standard` | 规范 | 规则是什么、适用范围是什么、如何检查 |

## 5. 生命周期

`status` 字段必须表达文档生命周期。

| status | 含义 | 允许被索引为主线吗 |
|---|---|---|
| `active` | 当前事实来源 | 可以 |
| `draft` | 草稿，尚未被采用 | 不可以作为主线事实 |
| `proposed` | 提案，等待评审 | 不可以作为主线事实 |
| `accepted` | 决策已接受，常用于 ADR | 可以 |
| `superseded` | 已被新文档替代 | 不可以 |
| `archived` | 历史保留 | 不可以 |
| `reference` | 外部参考或镜像 | 不可以直接进入主线 |

原则：

- 旧文档不能静默留在主线里。
- 被替代的文档必须在 front matter 标记 `superseded_by`。
- 一次性计划完成后应迁移到 `90-archive/iterations/` 或转化为长期规范。
- 复盘类文档完成后只保留结论进入规范或 ADR，原复盘进入 archive。

## 6. 命名规范

### 6.1 正式主线文档

正式文档使用语义名，不使用无限递增编号。

推荐：

```text
doc/40-engineering/preview-workbench/module-map.md
doc/40-engineering/chat-composer/spec.md
doc/50-quality/electron-qa-plan.md
doc/80-operations/github-release-runbook.md
```

不推荐：

```text
doc/40-product/1.0.0/40-delivery/72-GitHub-Releases-自动更新发布流程.md
doc/40-product/1.0.0/40-delivery/73-继续优化计划.md
doc/40-product/1.0.0/40-delivery/74-又一个开发方案.md
```

### 6.2 ADR

ADR 保留编号，因为它表达决策时间线。

```text
doc/60-decisions/ADR-001-github-release-auto-update.md
```

### 6.3 一次性迭代计划

一次性计划必须带日期和主题，默认不进入长期主线。

```text
doc/90-archive/iterations/2026-05-01-chat-ui-aionui-alignment.md
```

如果计划仍在执行中，可以放：

```text
doc/40-engineering/_work-in-progress/2026-05-01-chat-ui-aionui-alignment.md
```

完成后必须归档或拆成正式 spec / qa-plan / release-note。

### 6.4 外部研究资料

外部源码镜像不能混进主文档树。

推荐：

```text
doc/70-research/aionui/research-report.md
doc/70-research/aionui/source-mirror/
```

`source-mirror/` 只能作为 reference，不应被文档索引当作正式文档扫描。

## 7. Front Matter 规范

所有正式文档必须有 front matter。

最小字段：

```yaml
---
doc_id: "stable-id"
title: "标题"
doc_type: "spec"
layer: "L2"
status: "active"
version: "1.0.0"
la
... (truncated)
```
