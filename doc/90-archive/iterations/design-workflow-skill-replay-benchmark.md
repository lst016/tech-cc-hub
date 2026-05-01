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
| avgDuration | 总耗时 / 成功任务数 | 评估生成速度 |
| avgInputTokens | 输入 token / 成功任务数 | 评估上下文成本 |
| avgOutputTokens | 输出 token / 成功任务数 | 评估生成成本 |
| avgToolCalls | 工具调用次数 / 成功任务数 | 评估工具效率 |

### 10.3 覆盖率指标

| 指标 | 说明 |
| --- | --- |
| fieldCoverage | 黄金实现字段在生成结果中的覆盖率 |
| apiCoverage | API 路径、方法、参数、响应字段覆盖率 |
| permissionCoverage | 路由权限、按钮权限、菜单权限覆盖率 |
| i18nCoverage | 多语言 key 覆盖率 |
| behaviorCoverage | 查询、分页、导出、状态处理等行为覆盖率 |

### 10.4 稳定性指标

| 指标 | 说明 |
| --- | --- |
| repeatedSuccessRate | 同一任务多次运行成功率 |
| consecutiveSuccess | 连续成功次数 |
| varianceSteps | 步骤数波动 |
| varianceDuration | 耗时波动 |
| varianceScore | 分数波动 |

## 11. 评分模型

单次运行建议输出 0-100 分。

```text
score =
  buildScore * 0.20 +
  testScore * 0.20 +
  goldenCoverageScore * 0.30 +
  behaviorScore * 0.15 +
  efficiencyScore * 0.10 +
  stabilityScore * 0.05
```

建议规则：

- 构建失败时最高 40 分。
- 核心 API 不一致时最高 60 分。
- 核心字段遗漏超过 20% 时最高 70 分。
- 需要人工修复时扣 10-30 分。
- 出现未授权删除、跨任务污染、误改无关文件时直接标记高风险失败。

## 12. 失败原因分类

| 类型 | 说明 | 示例 |
| --- | --- | --- |
| requirement_parse_error | 需求解析错误 | 把报表页识别成列表页 |
| schema_extract_error | 结构化任务抽取错误 | 漏掉导出、权限、字段 |
| tool_error | 工具调用失败 | 文件不存在、命令不可用、schema 未加载 |
| workflow_design_error | workflow 设计问题 | 过早写代码、没有先抽 API |
| context_overflow | 上下文膨胀 | 工具输出过大、重复读取 |
| code_generation_error | 代码生成错误 | 类型错误、接口路径错 |
| golden_compare_error | 黄金对比失败 | 对比规则误判 |
| validation_error | 构建或测试失败 | npm build 失败 |
| sandbox_error | 隔离环境失败 | 删除范围错误、临时目录污染 |

失败分类必须结构化记录，不能只写「失败」。

## 13. Run Record Schema

```json
{
  "runId": "run-20260429-001",
  "suiteId": "backend-crud-suite",
  "taskId": "player-detail-page-001",
  "workflowVersion": "workflow-schema-first-v2",
  "skillVersions": {
    "detail-page-skill": "v3",
    "api-adapter-skill": "v2",
    "permission-skill": "v1"
  },
  "model": "GLM-5.1-FP8",
  "success": true,
  "score": 86,
  "steps": 12,
  "toolCalls": 31,
  "durationSeconds": 180,
  "inputTokens": 32000,
  "outputTokens": 9000,
  "buildPassed": true,
  "testPassed": true,
  "fieldCoverage": 0.95,
  "apiCoverage": 0.9,
  "permissionCoverage": 0.85,
  "manualFixRequired": false,
  "failureReason": null,
  "artifacts": {
    "sandboxPath": ".benchmark/runs/run-20260429-001/workspace",
    "diffPath": ".benchmark/runs/run-20260429-001/diff.patch",
    "logPath": ".benchmark/runs/run-20260429-001/run.log",
    "scorePath": ".benchmark/runs/run-20260429-001/score.json"
  }
}
```

## 14. 产物目录建议

```text
.benchmark/
  suites/
    backend-crud-suite.json
  tasks/
    player-detail-page-001.json
    report-page-001.json
  runs/
    run-20260429-001/
      workspace/
      before/
      after/
      diff.patch
      run.log
      score.json
      review.md
  reports/
    backend-crud-suite-20260429.md
```

如果要接入当前 `tech-cc-hub` UI，建议把 `.benchmark/runs/*/score.json` 作为右侧 Usage / 执行轨迹 / Benchmark 面板的数据源。

## 15. UI 设计建议

右侧栏可以增加 `Benchmark` tab，但不要替代现有浏览器、执行轨迹、Usage。

核心视图：

- Suite 总览：成功率、平均分、平均耗时、平均步骤、平均 token。
- Workflow 对比：V1 / V2 / V3 / V4 的横向评分。
- Skill 版本趋势：同一 skill 多版本成功率和成本走势。
- 失败分布：按 failure taxonomy 聚合。
- 单次运行详情：任务、sandbox、diff、构建日志、工具失败、评分解释。
- 黄金对比详情：字段、API、权限、i18n、行为覆盖率。

## 16. 最小可行版本

MVP 只做一条闭环：

```text
手工登记任务 JSON
  ↓
创建 sandbox
  ↓
删除目标文件
  ↓
执行指定 prompt / skill
  ↓
运行构建命令
  ↓
生成 diff
  ↓
规则评分
  ↓
输出 score.json + review.md
```

MVP 不需要一开始就做复杂 UI，可以先让报告落到 Markdown。

## 17. 分阶段实施

### S1：离线回放骨架

- 定义 suite/task/run schema。
- 实现 sandbox 创建与清理。
- 支持手工配置 goldenFiles。
- 输出 run artifact。

### S2：规则评分

- 构建和测试评分。
- 字段/API/权限覆盖率评分。
- diff 摘要。
- 失败原因分类。

### S3：Workflow A/B

- 支持多 workflow variant。
- 同一 suite 批量跑不同 workflow。
- 生成横向对比报告。

### S4：Skill 版本管理

- 记录 skill 版本。
- 对比 skill 变更前后分数。
- 输出优化建议。

### S5：接入 tech-cc-hub UI

- 右侧 Benchmark tab。
- 单次运行详情。
- 趋势图和失败分布。
- 从会话执行轨迹跳转到 benchmark run。

## 18. 风险与约束

| 风险 | 处理方式 |
| --- | --- |
| AI 复制黄金答案导致评测失真 | 黄金实现只用于评测和摘要，不直接暴露完整源码 |
| 删除范围错误 | task manifest 必须列出允许删除范围 |
| 评分过度依赖文本 diff | 引入 AST、路由、API、字段级对比 |
| 多 agent 成本过高 | 把 token、步骤、工具调用作为核心指标 |
| 任务样本太少 | 至少每类页面 10 条以上再判断 skill 优劣 |
| 需求文档质量不稳定 | 先抽结构化任务 JSON，再执行代码生成 |

## 19. 推荐判断标准

一套 workflow / skill 只有满足以下条件，才算值得默认启用：

- 同类任务成功率 >= 85%
- 平均分 >= 80
- 构建通过率 >= 90%
- 人工修复率 <= 20%
- 平均步骤数低于基线 20% 以上
- 平均 token 低于基线 15% 以上
- 连续 5 次回放没有 sandbox 污染或无关文件误改

## 20. 结论

这个方案本质是「历史需求回放 + 黄金代码对比 + skill 版本评分」。它比单纯更换模型更适合用户当前的后台业务场景，因为真正的瓶颈不是模型会不会写代码，而是 workflow 是否稳定、skill 是否能复用、工具调用是否少走弯路。

最终目标是把高频后台需求压缩成稳定生产线：

```text
成功率更高
步骤更少
token 更低
生成更快
失败更可解释
skill 可持续进化
```
