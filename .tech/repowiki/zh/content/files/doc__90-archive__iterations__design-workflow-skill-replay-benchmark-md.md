# doc/90-archive/iterations/design-workflow-skill-replay-benchmark.md

> 模块：`doc` · 语言：`markdown` · 行数：503

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-66"
title: "Workflow 与 Skill 回放 Benchmark 设计方案"
doc_type: "delivery"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-29"
owners:
  - "Product"
  - "Engineering"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "delivery"
  - "benchmark"
  - "workflow"
  - "skill"
---

# Workflow 与 Skill 回放 Benchmark 设计方案

> 来源：用户提供的 ChatGPT share「Benchmark 计算方法」
> 链接：https://chatgpt.com/share/69f1e734-e298-8324-9991-62288ef3411a
> 日期：2026-04-29

## 1. 背景

用户希望把大量历史后台需求沉淀成可反复回放的训练样本，用来优化 workflow、skills、prompt 和工具调用策略。

典型场景包括：

- 后台 CRUD 页面
- 报表页面
- 玩家详情页
- 列表查询、分页、导出、权限、字段映射
- 已经有正式代码实现的历史需求

这类任务高频、结构稳定、人工实现成本重复，非常适合做离线回放 benchmark。这里的目标不是训练模型本身，而是训练和评测「执行系统」：

```text
历史需求 = 样本
正式代码 = 黄金答案
skill = 可进化资产
workflow = 自动化生产线
benchmark = 质量尺子
```

## 2. 目标

### 2.1 产品目标

建立一个面向 workflow / skills 的回放评测系统，让用户能回答以下问题：

- 当前 skill 是否真的更好？
- 哪套 workflow 更适合后台 CRUD？
- 同一批历史需求，在不同 skill 版本下成功率、耗时、token、步骤数如何变化？
- 失败到底是模型问题、工具问题、上下文问题，还是 workflow 设计问题？
- 优化后的 skill 是否能减少步数、减少 token、提高成功率？

### 2.2 工程目标

- 从历史需求文档中抽取标准任务。
- 在 sandbox 中隔离删除相关实现，避免破坏正式代码。
- 用指定 workflow / skill 重新生成实现。
- 通过构建、测试、静态分析、代码对比、规则评分得到 benchmark 分数。
- 持续记录每次运行的指标、失败原因、产物差异和优化建议。

## 3. 非目标

- 不直接训练大模型权重。
- 不在正式分支真实删除业务代码。
- 不只依赖 AI 自评作为最终分数。
- 不把所有后台需求塞进一个万能 skill。
- 不用单次成功/失败替代长期稳定性指标。

## 4. 核心流程

```text
历史需求文档
  ↓
抽取标准任务
  ↓
定位黄金实现
  ↓
创建 sandbox 工作区
  ↓
隔离或删除目标实现
  ↓
按当前 workflow / skill 重写
  ↓
自动构建 / 测试 / 静态检查
  ↓
AI 自评 + 规则评分 + 黄金代码对比
  ↓
记录分数、步骤、耗时、token、失败原因
  ↓
产出 skill / prompt / workflow 优化建议
  ↓
重复回放
```

## 5. 核心概念

| 概念 | 说明 |
| --- | --- |
| Benchmark Suite | 一组可重复运行的历史任务集合 |
| Benchmark Task | 从历史需求抽取出来的一条标准任务 |
| Golden Implementation | 正式代码中的历史实现，用作对照答案 |
| Sandbox Workspace | 临时目录或临时分支，用于删除和重写代码 |
| Workflow Variant | 一套固定执行流程，例如直接生成、先抽 schema、分 agent 生成 |
| Skill Version | 被评测的 skill 版本 |
| Run Record | 一次实际回放运行的指标、日志、评分和产物 |
| Failure Taxonomy | 失败原因分类体系 |

## 6. 任务抽取

历史需求不能直接丢给 agent 自由发挥，需要先抽成结构化任务 JSON。

示例：

```json
{
  "taskId": "player-detail-page-001",
  "domain": "backend-admin",
  "pageType": "playerDetail",
  "entity": "Player",
  "sourceRequirement": "docs/history/player-detail.md",
  "goldenFiles": [
    "src/views/player/PlayerDetail.vue",
    "src/api/player.ts",
    "src/permission/player.ts"
  ],
  "expectedFeatures": [
    "detail",
    "search",
    "table",
    "pagination",
    "export",
    "permission",
    "i18n"
  ],
  "fields": [
    "playerId",
    "nickname",
    "registerTime",
    "balance"
  ],
  "apis": [
    {
      "name": "getPlayerDetail",
      "method": "GET",
      "path": "/player/detail"
    }
  ]
}
```

这样可以降低随机性，让 skill 评测稳定复现。

## 7. Sandbox 策略

正式代码不能直接删除。每次 benchmark 应创建隔离环境：

```text
源工作区
  ↓
复制到临时目录或创建临时 worktree
  ↓
按任务 manifest 删除目标文件
  ↓
运行 agent 重写
  ↓
产物和黄金实现对比
  ↓
保留 run artifact，清理临时工作区
```

Sandbox 需要保存：

- 删除前文件快照
- Agent 生成后的文件快照
- 构建日志
- 测试日志
- 工具调用日志
- diff 摘要
- 评分结果

## 8. Workflow 变体

至少保留三套固定 workflow 做 A/B 测试。

### 8.1 V1 直接生成

```text
读需求 → 写代码 → 自检
```

优点是快，缺点是容易遗漏字段、权限和接口细节。

### 8.2 V2 先抽 Schema

```text
读需求 → 抽字段/接口/权限/页面结构 → 写代码 → 自检
```

适合 CRUD、报表、详情页。预期比 V1 更稳定。

### 8.3 V3 分角色执行

```text
需求分析 agent → 代码生成 agent → reviewer agent → 修复 agent
```

适合复杂页面或跨前后端任务，但成本和步骤数更高。

### 8.4 V4 黄金实现引导

```text
抽任务 → 摘要黄金实现结构 → 隔离源码 → 重写 → 对比黄金实现
```

注意：黄金实现只能作为评测和结构摘要，不能在重写阶段直接复制答案，否则 benchmark 会失真。

## 9. Skill 拆分建议

不要做一个万能后台 skill。建议拆成以下可组合 skill：

| Skill | 适用范围 |
| --- | --- |
| crud-list-page-skill | 列表页、查询、分页、表格、批量操作 |
| detail-page-skill | 详情页、字段分组、状态展示 |
| report-page-skill | 报表、统计卡片、图表、导出 |
| form-page-skill | 表单、新增、编辑、校验 |
| permission-skill | 路由权限、按钮权限、菜单权限 |
| api-adapter-skill | API 封装、请求参数、响应映射 |
| sql-mapper-skill | Mapper、SQL、查询条件 |
| i18n-skill | 多语言字段补齐 |

每个 skill 应固定输出检查清单，例如详情页：

```text
1. 页面路由
2. 查询接口
3. 字段映射
4. 详情布局
5. 权限点
6. loading / error 状态
7. i18n
8. 构建验证
```

## 10. 指标体系

### 10.1 结果指标

| 指标 | 计算方式 | 用途 |
| --- | --- | --- |
| successRate | 成功任务数 / 总任务数 | 判断 workflow 是否可用 |
| fullPassRate | 全部检查通过任务数 / 总任务数 | 排除半成功 |
| manualFixRate | 需要人工修复任务数 / 总任务数 | 衡量可交付程度 |
| regressionRate | 破坏已有行为任务数 / 总任务数 | 控制风险 |

### 10.2 效率指标

| 指标 | 计算方式 | 用途 |
| --- | --- | --- |
| avgSteps | 总步骤数 / 成功任务数 | 评估 workflow 绕路程度 |
| avgDuration |
... (truncated)
```
