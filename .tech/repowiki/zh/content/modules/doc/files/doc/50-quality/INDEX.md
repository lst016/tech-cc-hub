# doc/50-quality/INDEX.md

> 模块：`doc` · 语言：`markdown` · 行数：64

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "DOC-INDEX-QUALITY"
title: "50-Quality QA 与验收索引"
doc_type: "index"
layer: "L5"
status: "active"
version: "1.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "qa"
  - "frontend"
  - "electron"
source_of_truth: true
tags:
  - "tech-cc-hub"
  - "index"
  - "quality"
  - "qa"
---

# 50-Quality / QA 与验收索引

## QA 规范

- [Electron 客户端操作与 QA 规范](../80-operations/electron-client-qa-runbook.md)
  - 固定桌面客户端操作模式、验收口径
  - 包含：启动、截图、窗口管理、调试入口

## 验收核对表

- [Trace Workbench 截图一致性核对表](trace-workbench-screenshot-checklist.md)
  - Activity Rail / 执行轨迹 UI 与参考截图的逐项对比

## QA 脚本

```bash
npm run qa:window:list      # 列出窗口
npm run qa:window:capture   # 窗口截图
npm run qa:smoke            # 最小 smoke 测试
npm run qa:continue         # 续聊回归测试
npm run qa:slash            # slash 命令回归测试
```

详见 `scripts/qa/` 目录。

## 发布验收

- [43-迭代计划与发布验收](../40-product/1.0.0/40-delivery/43-迭代计划与发布验收.md)（CLAW 旧版，部分适用）

## 测试

- Electron 主进程测试：`src/electron/*.test.ts`
- 运行：`npm run test:activity-rail-model`

## 关联目录

| 目录 | 说明 |
|------|------|
| `doc/80-operations/` | 发布、打包操作 runbook |
| `doc/60-decisions/` | 技术决策与 ADR |
| `doc/90-archive/postmortems/` | 操作复盘记录 |

```
