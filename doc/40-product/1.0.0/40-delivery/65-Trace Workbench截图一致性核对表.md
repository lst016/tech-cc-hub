---
doc_id: "PRD-100-65"
title: "65-Trace Workbench截图一致性核对表"
doc_type: "delivery"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-21"
owners:
  - "Product"
  - "Frontend"
  - "QA"
tags:
  - "delivery"
  - "trace"
  - "screenshot"
  - "qa"
sources:
  - "../10-requirements/18-PRD-Trace Workbench参考图拆解与页面重构.md"
  - "https://langfuse.com/images/docs/tracing-overview.png"
  - "https://mlflow.org/docs/latest/assets/images/genai-trace-debug-405f9c8b61d5f89fb1d3891242fcd265.png"
---

# 65-Trace Workbench截图一致性核对表

## Purpose
把 `Trace Viewer` 的验收从“主观感觉”改成“截图对照”。  
本表只服务一件事：判断当前代码截图是否真的已经向目标参考图靠拢。

## Usage
1. 在 Electron 真窗口打开 `Trace Viewer`
2. 固定窗口尺寸截图
3. 与参考图并排查看
4. 按本表逐项填写 `通过 / 不通过 / 备注`

## Target Reference
- [Langfuse Trace Detail](https://langfuse.com/images/docs/tracing-overview.png)
- [MLflow Trace Debugging](https://mlflow.org/docs/latest/assets/images/genai-trace-debug-405f9c8b61d5f89fb1d3891242fcd265.png)
- [18-PRD-Trace Workbench参考图拆解与页面重构.md](../10-requirements/18-PRD-Trace%20Workbench%E5%8F%82%E8%80%83%E5%9B%BE%E6%8B%86%E8%A7%A3%E4%B8%8E%E9%A1%B5%E9%9D%A2%E9%87%8D%E6%9E%84.md)

## Review Matrix

| ID | 检查项 | 通过标准 | 结果 | 备注 |
|---|---|---|---|---|
| `SC-01` | 顶部信息组织 | 顶部是紧凑标题栏和指标条，不是大卡片墙 | `待验证` |  |
| `SC-02` | 左栏视觉语义 | 左栏像目录导航，不像多个独立卡片 | `待验证` |  |
| `SC-03` | 中间主体第一印象 | 一眼看上去像 trace table，而不是内容页 | `待验证` |  |
| `SC-04` | Row 密度 | 行高明显收紧，信息密度高 | `待验证` |  |
| `SC-05` | Waterfall 主导性 | 时序条是主体阅读对象之一，不是装饰条 | `待验证` |  |
| `SC-06` | 摘要可读性 | 不出现摘要挤压、近似竖排的观感 | `待验证` |  |
| `SC-07` | Inspector 形态 | 更像调试面板，不像统计卡区 | `待验证` |  |
| `SC-08` | Tabs 结构 | `概览 / 输入 / 输出 / 原文` 清楚稳定 | `待验证` |  |
| `SC-09` | 原文可读性 | 原文区背景和文字对比明确，可直接阅读 | `待验证` |  |
| `SC-10` | 视觉气质 | 更接近 Langfuse / MLflow，而不是原有大圆角页面 | `待验证` |  |

## Hard Fail Conditions
只要出现以下任一情况，就直接判定“不一致”：

1. 顶部仍然是大卡片统计区
2. 左栏仍然是明显的卡片堆叠
3. 中间主体仍然不像表格 / waterfall
4. 右侧 inspector 仍然被统计卡主导
5. 截图整体仍然带有强烈“旧页面味道”

## Exit Criteria
只有当：

1. `SC-01 ~ SC-10` 全部通过
2. 没有命中 `Hard Fail Conditions`
3. Electron 真窗口截图确认

才能说“本轮 Trace Workbench 与参考图基本对齐”。
