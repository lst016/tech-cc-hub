# doc/40-product/1.0.0/70-browser-workbench-dev-plan.md

> 模块：`doc` · 语言：`markdown` · 行数：374

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-70"
title: "内置浏览器工作台开发计划"
doc_type: "delivery"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-20"
owners:
  - "Product"
  - "Engineering"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "delivery"
  - "browser"
  - "workbench"
---

# 内置浏览器工作台开发计划

## 目标

在 `tech-cc-hub` 里做一个类似 Codex 内置浏览器的前端验收工作台，用来承接本地页面调试、截图标注、Console 诊断、DOM 定位和后续 Agent 自动操作。

这个能力不追求复制 Codex 私有 `Browser Use` 插件，而是基于 Electron 自己实现一套可控、可扩展、可审计的浏览器工作台。

核心目标：

- 在应用内打开本地页面，例如 `http://localhost:4173/`、`http://localhost:3000/`
- 支持刷新、前进、后退、地址栏跳转
- 支持截图、Console 日志、页面错误收集
- 支持用户在页面上点选区域并留下修改意见
- 支持把截图、坐标、DOM 线索和评论转成 Agent 可执行上下文
- 后续支持 Agent 调用浏览器工具完成验证和简单交互

## 产品形态

第一版建议做成主工作区里的一个 `Browser Workbench`，不是单纯嵌在右栏的小组件。

推荐布局：

- 顶部全局 Header 保持现有 40px 工具栏
- 左侧仍是 workspace/session sidebar
- 中间主区可以在 `聊天` 和 `浏览器工作台` 之间切换
- 右侧 Activity Rail 继续显示执行轨迹和浏览器诊断结果
- 底部输入区在浏览器工作台里仍可用，用于直接描述修改意见

浏览器工作台内部结构：

- 顶部浏览器工具条：地址栏、返回、前进、刷新、截图、打开 Dev Logs
- 中间页面容器：Electron `WebContentsView` / `BrowserView`
- 透明标注层：用于点击元素、框选区域、添加评论
- 右侧/浮层评论列表：展示截图标记、评论、DOM 信息

## 技术路线

### Electron 浏览器承载

优先使用 Electron 新版本推荐的 `WebContentsView`。如果当前 Electron 39 在项目约束下接入成本高，可以先用 `BrowserView` 做 MVP。

主进程负责：

- 创建、销毁浏览器 view
- 导航 URL
- 管理 view bounds
- 截图
- 读取 console 日志和 page error
- 注入 preload / isolated script 用于 DOM 选择

渲染进程负责：

- 浏览器工具条 UI
- 标注层 UI
- 评论数据展示
- 与主进程 IPC 通信
- 把浏览器上下文发送给当前 Agent 会话

### IPC 草案

浏览器控制：

```ts
browser.open({ url: string })
browser.reload()
browser.goBack()
browser.goForward()
browser.setBounds({ x: number; y: number; width: number; height: number })
browser.captureVisible()
browser.getInfo()
browser.close()
```

诊断读取：

```ts
browser.getConsoleLogs({ limit?: number })
browser.getPageErrors({ limit?: number })
browser.getDomSnapshot()
browser.inspectAtPoint({ x: number; y: number })
```

标注与 Agent 上下文：

```ts
browser.createAnnotation({
  url: string;
  screenshotPath?: string;
  point?: { x: number; y: number };
  rect?: { x: number; y: number; width: number; height: number };
  domHint?: BrowserDomHint;
  comment: string;
})
```

## 数据结构草案

```ts
type BrowserTabState = {
  id: string;
  url: string;
  title?: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  lastScreenshotPath?: string;
};

type BrowserConsoleLog = {
  level: "log" | "info" | "warn" | "error";
  message: string;
  timestamp: number;
  url?: string;
  line?: number;
  column?: number;
};

type BrowserDomHint = {
  tagName: string;
  role?: string;
  text?: string;
  ariaLabel?: string;
  selectorCandidates: string[];
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type BrowserAnnotation = {
  id: string;
  sessionId?: string;
  url: string;
  comment: string;
  createdAt: number;
  screenshotPath?: string;
  point?: { x: number; y: number };
  rect?: { x: number; y: number; width: number; height: number };
  domHint?: BrowserDomHint;
};
```

## 分阶段实现

### Phase 0：设计骨架和入口

目标：先把产品入口摆出来，但不接真实浏览器。

任务：

- 新增 `BrowserWorkbenchPage`
- Header 加一个浏览器工作台入口按钮
- 中间主区支持 `chat` / `browser` 模式切换
- 页面内先放工具条和空状态
- 不影响现有聊天和 Activity Rail

验收：

- 点击入口可以切到浏览器工作台
- 切回聊天不丢当前会话
- 页面布局在左右侧栏拖拽时仍稳定

### Phase 1：内置浏览器 MVP

目标：能在 Electron 真窗口内打开本地 URL。

任务：

- 主进程新增 browser manager
- 新增 IPC：open、reload、back、forward、close、setBounds
- 渲染进程根据容器尺寸同步 bounds
- 支持地址栏输入 URL 并打开
- 默认打开当前 Vite URL 或用户输入 URL

验收：

- Electron 真窗口里能打开 `http://localhost:4173/`
- 返回、前进、刷新可用
- 左右侧栏拖拽后浏览器区域尺寸正确
- 切换页面后浏览器 view 不遮挡其他 UI

### Phase 2：截图和日志

目标：浏览器不只是能看，还能给 Agent 提供诊断材料。

任务：

- 新增可见区域截图
- 新增 console log 捕获
- 新增 page error 捕获
- 右侧 Activity Rail 增加浏览器诊断小节
- 截图可以作为当前会话附件或上下文

验收：

- 点击截图按钮能生成当前页面截图
- Console error 能在 UI 中看到
- 页面白屏时能看到错误来源
- Agent 能收到截图和日志摘要

### Phase 3：点选元素和评论标注

目标：做到类似 Codex diff comment 的体验。

任务：

- 增加标注模式按钮
- 用户点击页面坐标后生成蓝色 marker
- 注入脚本读取坐标下 DOM 信息
- 支持输入评论
- 评论记录包含：URL、截图、坐标、DOM hint、comment

验收：

- 用户能在页面上点一个按钮/区域并写评论
- 评论列表能展示 marker 编号和文字
- 点击评论能高亮对应位置
- 评论可发送给 Agent，形成明确修改任务

### Phase 4：Agent 浏览器工具

目标：让 Agent 能主动验证页面，而不是只靠用户截图。

工具草案：

```ts
browser_navigate(url)
browser_reload()
browser_screenshot()
browser_console_logs()
browser_dom_snapshot()
browser_click(selectorOrPoint)
browser_type(selectorOrPoint, text)
b
... (truncated)
```
