---
workflow_id: "visual-multitask-ui-fix"
name: "视觉标注多任务 UI 修复流程"
version: "1.0.0"
scope: "project"
mode: "single-thread"
entry: "manual"
owner: "tech-cc-hub"
description: "把 Browser Workbench 的页面标注、DOM 线索、并行 agent 和变更 recap 串成一个前端 UI 批量修复流程。"
auto_advance: false
auto_bind: true
priority: 96
tags:
  - "visual"
  - "browser"
  - "annotation"
  - "frontend"
  - "multitask"
  - "qa"
triggers:
  - "<browser_annotations>"
  - "browser annotations"
  - "页面标注"
  - "浏览器标注"
  - "视觉标注"
  - "批量 UI 修改"
  - "多处 UI 修改"
  - "多个组件"
  - "multitask design"
  - "visual multitask"
  - "Design Mode"
  - "标注批量修"
applies_to_paths:
  - "src/ui/**"
  - "src/electron/browser-manager.ts"
  - "src/electron/libs/browser-workbench/**"
  - "src/electron/libs/mcp-tools/browser.ts"
  - "src/electron/libs/runtime-efficiency.ts"
  - "test/electron/browser-*.test.ts"
  - "scripts/qa/browser-workbench-smoke.mjs"
---

# 视觉标注多任务 UI 修复流程

## 目标
把用户在 Browser Workbench 中点选、截图或页面标注的多个 UI 问题，转换成可并行或可串行执行的修复任务，复用现有 browser/design MCP、Agent Teams、workflow transcript 和 QA 产物，最终交付一份清晰的变更 recap。

## 适用范围
适用于用户通过浏览器标注、截图标注、DOM 线索、页面视觉反馈或“多处 UI 修改”描述前端问题，需要同时修多个相对独立的组件、样式、布局、交互文案或视觉细节的任务。

## 使用规则
- 不新建第二套浏览器、标注或截图系统，优先复用 Browser Workbench、`<browser_annotations>`、browser MCP 和 design MCP。
- 先把标注归一成任务清单，再判断并行性；只有文件归属、组件边界和验收标准足够清楚时才并行。
- 并行时必须给每个 agent 明确文件/组件 ownership，避免多个 agent 同时改同一组件、同一样式文件或同一设计 token。
- 若多个标注落在同一组件、同一路由或共享样式 token 上，保持串行修复并一次性验证，不为追求并行制造冲突。
- 临时 `browser_apply_styles` 只能用于预览，最终必须落到源码、样式文件或设计 token。
- 交付时必须包含每个标注的处理状态、涉及文件、验证结果和未处理原因，不能只说“已修复”。

## 输入上下文
- Prompt 中的 `<browser_annotations>` 块、截图附件、当前 BrowserView URL 和 DOM hint
- `browser_query_nodes`、`browser_inspect_styles`、`browser_capture_visible`、`browser_fetch_logs` 或 design diff report
- 当前会话、工作区路径、相关组件源码、样式文件和测试
- 用户对并行、多组件、批量 UI polish 或 recap 的要求

## 输出产物
- 标注归一清单：问题、期望、DOM/组件线索、候选文件、是否可并行
- 执行计划：串行步骤或 Agent Teams / Task executor 的拆分和 ownership
- 源码修改和必要测试
- 自动化 QA 结果：目标单测、编译、browser smoke、截图/DOM/style 检查或 design comparison
- 变更 recap：每个标注的 before/after、涉及文件、验证状态、剩余风险和人工测试步骤

## 步骤

### STEP-1
```yaml
id: "STEP-1"
title: "收集标注和当前页面证据"
executor: "primary-agent"
intent: "inspect"
user_actions: ["run", "retry", "edit"]
done_when: "拿到每条标注的页面、坐标、DOM 目标、用户期望和可复核的当前状态"
tools_hint: ["browser_get_state", "browser_query_nodes", "browser_inspect_styles", "browser_capture_visible", "rg"]
```
读取 `<browser_annotations>`，按页面和组件分组。对不稳定 selector 用 `browser_inspect_at_point`、xpath/path 或附近文本复核。需要视觉对比时先截当前 BrowserView，不要只凭历史截图或旧会话上下文判断。

### STEP-2
```yaml
id: "STEP-2"
title: "拆分任务和判断并行边界"
executor: "primary-agent"
intent: "inspect"
user_actions: ["run", "edit"]
done_when: "每个修复项都有 owner 文件、验收标准和并行/串行决策"
depends_on: ["STEP-1"]
tools_hint: ["rg", "git"]
```
把标注拆成独立修复项。若修复项触碰不同组件、路由或测试面，可用 Agent Teams / Task executor 并行；若共享文件或设计 token，合并成一个串行批次。输出清单时注明冲突风险和不并行的理由。

### STEP-3
```yaml
id: "STEP-3"
title: "执行 UI 修复"
executor: "primary-agent"
intent: "implement"
user_actions: ["run", "retry", "edit"]
done_when: "所有可处理标注都已落到源码或明确标记为跳过"
depends_on: ["STEP-2"]
tools_hint: ["apply_patch", "browser_apply_styles", "browser_inspect_styles", "npm"]
```
按 ownership 修改源码。需要试验样式时先用 `browser_apply_styles` 预览，再把有效差异落到源文件。并行 agent 返回后由主 agent 做合并审查，确认没有互相覆盖、重复修复或引入不一致 UI 语言。

### STEP-4
```yaml
id: "STEP-4"
title: "自动化和视觉验证"
executor: "primary-agent"
intent: "verify"
user_actions: ["run", "retry", "skip"]
done_when: "关键 UI 行为和视觉差异都有可复核验证结果"
depends_on: ["STEP-3"]
tools_hint: ["npm", "browser_capture_visible", "browser_query_nodes", "browser_inspect_styles", "design_compare_current_view"]
```
按风险运行目标单测、编译、browser smoke 或 design comparison。至少复核被标注元素的 DOM/style 状态；涉及交互或数据请求时检查 console/fetch logs。无法自动验证的项目要写进人工测试步骤。

### STEP-5
```yaml
id: "STEP-5"
title: "生成变更 recap 和人工测试清单"
executor: "primary-agent"
intent: "deliver"
user_actions: ["run", "edit"]
done_when: "用户能直接看懂每条标注是否完成、改了哪里、怎么验收"
depends_on: ["STEP-4"]
tools_hint: ["git", "browser_capture_visible"]
```
输出按标注编号组织的 recap：问题、期望、处理结果、文件、验证命令、截图/DOM 证据和剩余风险。若未来存在可发布 artifact 或 shared canvas 能力，优先把 recap 写成可分享产物；当前没有该能力时，用会话回复和 workflow transcript 承载。
