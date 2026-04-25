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
browser_wait_for_text(text)
```

任务：

- 在 Agent runtime 工具层注册 browser tools
- 工具调用通过 IPC 进入 browser manager
- 工具结果进入执行轨迹
- Activity Rail 展示浏览器工具输入/输出

验收：

- Agent 能打开页面并截图
- Agent 能读取 console 错误
- Agent 能点击一个明确 selector
- 工具调用能在右侧执行轨迹里复盘

### Phase 5：回放和稳定性

目标：让浏览器工作台成为可复盘的 QA 系统。

任务：

- 浏览器操作写入 session event
- 支持按会话回看截图和评论
- 支持导出浏览器诊断报告
- 支持 URL 白名单和本地优先策略
- 对外部网站增加确认机制

验收：

- 一次 UI 修改的截图、评论、日志、Agent 操作可回放
- 崩溃或刷新后不丢关键评论
- 外部 URL 导航有明确安全边界

## 文件改动预估

第一阶段可能涉及：

- `src/ui/App.tsx`
- `src/ui/components/BrowserWorkbenchPage.tsx`
- `src/ui/components/BrowserToolbar.tsx`
- `src/ui/store/useAppStore.ts`

第二阶段开始涉及：

- `src/electron/browser-manager.ts`
- `src/electron/ipc-handlers.ts`
- `src/electron/main.ts`
- `src/electron/types.ts`
- `src/ui/types.ts`

后续 Agent 工具阶段可能涉及：

- `src/electron/runtime/*`
- `src/shared/*`
- `src/ui/components/ActivityRail.tsx`

## 风险点

- `BrowserView` / `WebContentsView` 的 bounds 必须和 React 布局同步，否则会遮挡 UI
- Electron 真窗口和浏览器预览态行为不同，验收必须以 Electron 为准
- DOM inspect 脚本要隔离，不能破坏目标页面
- 截图文件要有生命周期管理，避免无限堆积
- 外部网站操作要有安全确认，优先服务 localhost 开发场景

## 推荐执行顺序

1. 先做 Phase 0：把入口和页面骨架搭出来
2. 再做 Phase 1：只支持打开、刷新、返回、前进
3. 然后做 Phase 2：截图和日志，这是最有用的调试闭环
4. 再做 Phase 3：评论标注，贴近 Codex 当前体验
5. 最后做 Phase 4：Agent 自动浏览器工具

## 下一步

建议下一步先实现 Phase 0。

最小改动目标：

- Header 增加浏览器工作台入口 icon
- App 增加 `activeWorkspaceView: "chat" | "browser"`
- 新建 `BrowserWorkbenchPage`
- 页面显示地址栏、刷新按钮、截图按钮占位、空状态
- 不接 Electron browser manager

这样可以先把产品形态对齐，再进入真正的 Electron view 接入。

## 当前进度

### 2026-04-25

Phase 0 到 Phase 3 已形成第一版可运行骨架：

- 已新增 `BrowserWorkbenchPage`
- 已在全局 Header 增加浏览器工作台入口
- 已支持中间主区在聊天和浏览器工作台之间切换
- 已保留底部输入区，方便在浏览器工作台里继续给 Agent 发指令
- 已新增 Electron `BrowserWorkbenchManager`
- 已接入 `BrowserView` 作为真实浏览器承载层
- 已新增浏览器 IPC：打开、关闭、bounds 同步、刷新、后退、前进、状态读取
- 已新增截图 IPC：捕获当前可见页面并回传 data URL
- 已新增 Console 日志捕获，并在工作台右侧诊断区展示
- 已新增标注模式：通过页面注入脚本捕获点击坐标和 DOM hint
- 已新增“发送诊断到输入框”：把 URL、标注、Console 错误整理成 Agent 可执行上下文
- 已为 Codex 内置浏览器预览态补充降级 shim，避免普通网页环境直接崩掉

当前边界：

- Phase 4 已有手动桥接版：浏览器诊断可以写入输入框交给 Agent。自动工具注册尚未真正接入 Claude Agent SDK runner；现有 SDK 接入点当前主要是权限拦截和内置工具放行，未看到项目里已有自定义工具注册模式。
- Phase 5 的持久化回放尚未写入数据库；当前标注、截图和日志是页面运行态数据。
- 真实浏览器承载必须在 Electron 窗口里验收；Codex 内置浏览器里只能看到降级 UI。

验证：

- `npm run transpile:electron` 通过
- `npm run build` 通过
