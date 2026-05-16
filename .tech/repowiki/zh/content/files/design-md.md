# DESIGN.md

> 模块：`root` · 语言：`markdown` · 行数：181

## 文件职责

设计系统文档，定义产品配色方案（warm gray + clay accent）和 VS Code 风格工作台层

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Design System - tech-cc-hub

## Product Context

- **What this is:** `tech-cc-hub` is a desktop Agent collaboration workbench built with Electron, React, and a Claude-compatible Agent SDK.
- **Who it is for:** power users and builders who run local coding agents, inspect execution traces, manage workspaces, and need a calm operating surface for long-running AI work.
- **Project type:** local-first desktop productivity app, with chat, workspace management, execution observability, browser annotation, and code preview surfaces.
- **Design priority:** make complex agent behavior readable without making the app feel like a generic admin dashboard.

## Design Direction

- **Aesthetic:** warm utilitarian workbench.
- **Mood:** quiet, precise, local, technical, and slightly tactile. The product should feel like a serious desktop instrument rather than a SaaS landing page.
- **Decoration level:** intentional but restrained. Use translucent panels, soft borders, subtle shadows, and a few warm highlights. Avoid heavy gradients, saturated purple/blue decoration, and decorative icon clutter.
- **Layout:** grid-disciplined app shell with focused work zones: left workspace sidebar, center conversation, right execution/preview rail.

## Color System

The product color system has two layers:

- **Product layer:** warm gray + clay accent. This is the default for chat, settings, sidebars, cards, controls, and execution views.
- **Workbench layer:** VS Code light neutral + blue. This is allowed only inside code/file preview surfaces where users expect editor semantics.

### Product Layer Tokens

Use these tokens from `src/ui/index.css` for normal product UI.

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| App background | `bg-100` | `#F8F9FB` | main page backdrop, large empty areas |
| Surface | `surface` | `#FFFFFF` | primary cards, panels, popovers |
| Surface secondary | `surface-secondary` | `#F3F4F6` | inactive controls, subtle rows |
| Surface tertiary | `surface-tertiary` | `#E9EBF0` | code chips, embedded snippets, low emphasis fills |
| Border subtle | `black/6` or `ink-900/8` | derived | default panel borders |
| Text strongest | `ink-900` | `#16181D` | page titles, primary body |
| Text primary | `ink-800` | `#252932` | normal labels and readable content |
| Text secondary | `ink-600` | `#596272` | metadata, secondary copy |
| Text muted | `muted` | `#697384` | hints, low-emphasis labels |
| Accent | `accent` | `#D26A3D` | selected state, primary action, active indicator |
| Accent hover | `accent-hover` | `#BE5D34` | hover/pressed primary action |
| Accent subtle | `accent-subtle` | `#F9EEE9` | selected card background, soft highlight |
| Accent light | `accent-light` | `#F2C2AD` | divider highlights and warm decorative accents |

### Semantic Tokens

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Success | `success` | `#16A34A` | completed runs, healthy connection |
| Success surface | `success-light` | `#DCFCE7` | success badge backgrounds |
| Error | `error` | `#DC2626` | failed run, destructive warning |
| Error surface | `error-light` | `#FEE2E2` | error badge backgrounds |
| Info | `info` | `#2563EB` | informational status, not brand accent |
| Info surface | `info-light` | `#DBEAFE` | informational badge backgrounds |
| Warning | `warning` | `#D97706` | risky operation, degraded state |
| Warning surface | `warning-light` | `#FEF3C7` | warning badge backgrounds |

### Workbench Layer Tokens

Use this layer only for code/file preview, Monaco, Explorer, file-tree selection, and line annotations.

| Role | Hex | Usage |
|------|-----|-------|
| Workbench background | `#FFFFFF` | editor and preview background |
| Workbench sidebar | `#F3F3F3` | Explorer background |
| Workbench line | `#D8DEE4` | editor/file-tree borders |
| Workbench text | `#24292F` | file names, code toolbar text |
| Workbench muted | `#6E7781` | paths and metadata |
| Workbench blue | `#0969DA` | editor selection metadata, referenced line glyph |
| Workbench blue soft | `#DDF4FF` | selected reference badge |
| Workbench comment | `#BF3989` | code comment glyph only |
| Workbench error | `#CF222E` | preview error state |
... (truncated)
```
