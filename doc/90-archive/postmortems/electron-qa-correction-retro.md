---
doc_id: "PRD-100-62"
title: "62-操作复盘-Electron客户端验收面偏航"
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
  - "delivery"
  - "retrospective"
  - "qa"
---

# 62-操作复盘-Electron客户端验收面偏航

## 场景
- 功能：右侧执行侧栏默认只显示执行指标，详细 prompt 和执行明细按按钮展开
- 日期：2026-04-19
- 负责人：Codex

## 当时走错的路径
- 错误动作：
  - 先打开 `localhost:5173` 页面，尝试通过浏览器页面判断 Electron 客户端右侧侧栏是否符合预期。
- 为什么会走到这条路径：
  - 浏览器路径更容易接自动化点击，且一开始把“前端页面可见性”误当成“客户端真实验收面”。

## 错误信号
- 观察到的异常：
  - 页面空白。
  - Chrome 翻译气泡和扩展弹层遮挡页面。
  - 浏览器页与 Electron 真窗口显示状态不一致。
- 为什么这些信号说明当前路径不可信：
  - 当前项目是 `Electron` 客户端，`localhost` 只是渲染层开发入口，不等于桌面壳层真实结论。
  - 浏览器环境会引入客户端不存在的干扰项，导致“功能有问题”和“验证路径错误”混在一起。

## 正确路径
- 真实验收面：
  - `Electron` 客户端真窗口。
- 正确的定位方式：
  - 先列出当前桌面窗口，锁定 `Electron / Agent Cowork` 的 `window id`，再按 `window id` 截图和操作。
- 正确的验证顺序：
  1. 启动 Electron 客户端。
  2. 列出窗口 ID。
  3. 锁定目标 `window id`。
  4. 按窗口 ID 截图确认默认态。
  5. 再对该窗口执行展开操作，并截取展开态。

## 标准命令 / 脚本
```bash
cd /Users/lst01/Desktop/学习/tech-cc-hub

# 列出当前 Electron / Chrome / Codex 窗口
npm run qa:window:list

# 按窗口 ID 截图
npm run qa:window:capture -- 19232 /tmp/agent-cowork-window.png
```

## 证据
- 窗口 ID：
  - `19232`
- session id：
  - `4c8b6c2e-d141-47c6-971d-5a897472b120`
- 截图路径：
  - 默认态：`/tmp/agent-cowork-window.png`
  - 展开态：`/tmp/agent-cowork-window-expanded.png`
- 日志路径：
  - 会话数据库：`~/Library/Application Support/agent-cowork/sessions.db`

## 抽取出的规则
- 以后只要功能的最终交付形态是 `Electron` 客户端，就直接把 Electron 真窗口定义为验收面。
- 以后只要桌面上同时存在多个 `Chrome / Electron / Codex` 窗口，就必须使用 `window id` 做截图和操作定位。
- 浏览器本地页只能用于辅助开发，不能替代客户端结论。

## 需要更新的文档 / 工具
- [x] 开发文档
- [x] QA 规范
- [x] README
- [x] 脚本
- [x] npm 命令

## 最终结论
- 这次偏航的根因：
  - 没有先定义“真实验收面”，导致把开发态本地页误用了为客户端验证路径。
- 以后如何避免复发：
  - 任何客户端类验证，先写清验收面，再定义精确定位方式；若是 Electron 客户端，默认走 `window id` 路径。
