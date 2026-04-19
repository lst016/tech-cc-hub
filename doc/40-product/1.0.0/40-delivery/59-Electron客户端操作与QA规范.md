---
doc_id: "PRD-100-59"
title: "59-Electron客户端操作与QA规范"
doc_type: "delivery"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "Product"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "electron"
  - "qa"
  - "operations"
---

# 59-Electron客户端操作与QA规范

## Purpose
固定当前桌面客户端的操作模式，避免后续把 `localhost` 页面误当成 Electron 客户端结果。

## Scope
本文件只约束 Electron 客户端的日常操作、截图和 QA 验证方式，不定义业务功能本身。

## Behavior / Flow
### 默认操作模式

1. 启动客户端后，优先操作 `Electron` 真窗口。
2. 当需要截图、验证布局或记录缺陷时，优先使用 `window id` 精确定位窗口。
3. 不以 `localhost:5173` 页面替代 Electron 客户端结论。

### 标准步骤

1. 列出当前窗口：
   - `cd upstream/open-claude-cowork && npm run qa:window:list`
2. 确认目标 `Electron` 窗口 ID。
3. 按窗口 ID 截图：
   - `cd upstream/open-claude-cowork && npm run qa:window:capture -- <window_id> /tmp/agent-cowork.png`
4. 需要进一步交互时，以该窗口 ID 作为后续操作和证据基线。

## Interfaces / Types
- 脚本：`upstream/open-claude-cowork/scripts/qa/window-id-tools.sh`
- 命令：
  - `npm run qa:window:list`
  - `npm run qa:window:capture -- <window_id> [output_path]`

## Failure Modes
- 如果把 `localhost` 页面当成客户端结果，可能出现“网页空白但 Electron 正常”或“浏览器扩展遮挡导致误判”的问题。
- 如果不锁定 `window id`，多窗口情况下截图和点击很容易落到错误窗口。

## Observability
- QA 证据优先保存为按窗口 ID 截取的图片。
- 提交问题时应记录：
  - `window id`
  - 截图路径
  - 触发步骤

## Open Questions / ADR Links
- 如后续需要自动化点击链，也应沿用本规范，以 `window id` 作为窗口定位基线。
- 更通用的沉淀方法见 [60-开发流操作沉淀规范.md](./60-%E5%BC%80%E5%8F%91%E6%B5%81%E6%93%8D%E4%BD%9C%E6%B2%89%E6%B7%80%E8%A7%84%E8%8C%83.md)
