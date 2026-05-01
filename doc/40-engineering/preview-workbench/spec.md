---
doc_id: "DOC-SPEC-PREVIEW-WORKBENCH"
title: "Preview / Browser Workbench 模块 Spec"
doc_type: "spec"
layer: "L4"
status: "active"
version: "1.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "frontend"
  - "electron"
source_of_truth: true
supersedes: []
superseded_by: null
tags:
  - "tech-cc-hub"
  - "engineering"
  - "preview"
  - "browser-workbench"
  - "spec"
---

# Preview / Browser Workbench 模块 Spec

## Purpose

定义内置浏览器预览工作台的实现结构。Preview 是 Agent 执行结果的可视化展示区，支持文件预览和 Web 页面预览两种模式。

## Scope

- 文件预览：PreviewPanel（代码、图片、文本、Markdown）
- 浏览器预览：BrowserView 嵌入（Web 页面实时渲染、开发者工具）
- 设计对齐工具：design MCP 工具（截图、diff、inspector）
- AionUI 工作区预览：AionWorkspacePreviewPane
- 不在本文档范围：Agent 执行任务的可观测面板（ActivityRail）

## Active Entry Points

| 入口 | 文件 | 说明 |
|------|------|------|
| PreviewPanel | `src/ui/components/PreviewPanel.tsx` | 文件预览面板 |
| AionWorkspacePreviewPane | `src/ui/components/AionWorkspacePreviewPane.tsx` | Web 工作区预览 |
| BrowserView 集成 | `src/electron/main.ts` | BrowserView 创建/管理 |
| Browser MCP Tools | `src/electron/libs/mcp-tools/browser.ts` | 浏览器控制 MCP |
| Design MCP Tools | `src/electron/libs/mcp-tools/design.ts` | 设计对对齐工具 |

## Key Components

### PreviewPanel

文件预览组件。Props：

```typescript
interface PreviewPanelProps {
  files: PreviewFile[];          // 预览文件列表
  activeFileId: string | null;  // 当前选中文件
  onClose: () => void;          // 关闭预览
  onSelectFile: (id: string) => void; // 切换文件
}
```

支持的文件类型：

| 类型 | 渲染方式 |
|------|---------|
| 图片 (.png/.jpg/.gif/.webp/.svg) | `<img>` 标签，缩放适配 |
| 代码 (.ts/.tsx/.js/.json/.css/.html) | 语法高亮代码块（highlight.js） |
| Markdown (.md) | Markdown → HTML 渲染 |
| 其他文本 | 等宽字体原样展示 |

### BrowserView（Electron 主进程）

- 使用 Electron `BrowserView` API 嵌入 Web 内容
- 通过 `browser-workbench-session.ts` 管理 BrowserView 生命周期
- 独立 session（partition），与主应用 cookie/storage 隔离
- 支持前进/后退/刷新导航

### Browser MCP Tools

浏览器控制工具集：

| 工具 | 功能 |
|------|------|
| `browser_open_page` | 打开/切换 URL |
| `browser_navigate` | 前进/后退 |
| `browser_reload` | 刷新页面 |
| `browser_get_state` | 获取当前 URL/标题 |
| `browser_extract_page` | 提取页面正文、链接、图片 |
| `browser_capture_visible` | 截取可见区域 |
| `browser_console_logs` | 读取控制台日志 |
| `browser_query_nodes` | CSS/XPath 查询 DOM 节点 |
| `browser_inspect_styles` | 读取计算样式 |
| `browser_set_annotation_mode` | 开启/关闭元素标注 |
| `browser_get_dom_stats` | 统计 DOM 规模 |

### Design MCP Tools

设计对对齐工具集：

| 工具 | 功能 |
|------|------|
| `design_capture_current_view` | 截图保存为 PNG |
| `design_compare_current_view` | 与 Figma 参考图比照，生成 diff 图 |
| `design_compare_images` | 两张本地截图的比照 |
| `design_inspect_image` | 读取图片的视觉语义摘要 |

### AionWorkspacePreviewPane

- Web 工作区实时预览（iframe/BrowserView 模式）
- 接收 `PREVIEW_OPEN_FILE_EVENT` 事件打开文件
- 接收 `OPEN_BROWSER_WORKBENCH_URL_EVENT` 事件导航 URL

## Data Flow

```
Agent 输出 → stream.message
  → UI 层提取文件路径/URL
    → PreviewPanel (文件模式) 或 BrowserView (Web 模式)

Browser MCP Tool 调用:
  Agent → SDK tool_use → MCP handler → BrowserView 操作 → tool_result

Design 对齐:
  design_capture_current_view → PNG 截图
  design_compare_current_view → diff 图 + comparison 图 + 差异比例
```

## Key Files

```
src/ui/components/
├── PreviewPanel.tsx              # 文件预览面板
├── AionWorkspacePreviewPane.tsx  # Web 工作区预览
└── PreviewToolbar.tsx            # 预览工具栏

src/electron/
├── main.ts                       # BrowserView 创建和生命周期
└── libs/
    ├── browser-workbench-session.ts # BrowserView 会话管理
    └── mcp-tools/
        ├── browser.ts             # 浏览器控制 MCP 工具
        └── design.ts              # 设计对齐 MCP 工具
```

## Security / Permission Boundary

- BrowserView 使用独立 session partition，与主应用隔离
- 浏览器工具通过 MCP 协议调用，受 Agent 权限模式约束
- 设计工具截图仅保存到本地文件系统，不上传

## Compatibility

- 新增浏览器工具时，需同步更新 MCP tool schema 和本文档
- PreviewPanel 新增文件类型支持时，确保 highlight.js 有对应 language 包
- BrowserView 的 webPreferences 变更需评估安全影响

## Acceptance Criteria

- [ ] 图片文件预览支持缩放和拖拽
- [ ] 代码文件预览支持语法高亮
- [ ] BrowserView URL 导航和前进/后退正常
- [ ] 浏览器工具在 Agent 权限模式下正确拦截
- [ ] 设计比照工具生成的 diff 图可读
- [ ] BrowserView session 与应用 session 完全隔离
