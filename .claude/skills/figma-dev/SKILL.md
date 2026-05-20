---
name: "figma-dev"
description: "通用前端页面开发 skill。收到 Figma URL + 开发需求时自动加载。按阶段推进：Figma 读取→API 文档检查→已有代码审计→实现（含特征清单 + i18n + 权限）→浏览器验证→报告。不限定死流程，根据需求类型灵活裁剪阶段。不限于 CRUD，也适用单组件、布局调整、纯视觉等场景。"
---

# Figma 通用开发 Skill

## 触发条件

用户给出 **Figma URL** 并要求「写 xx 管理页面」「实现 xx CRUD」「做 xx 增删改查」「把 xx 页面写完」时，自动加载本 skill。

如果用户只给 Figma URL 但需求非 CRUD（仅视觉调整、单个组件、纯布局），不强制使用本 skill。

## 快速上手

```bash
# 开发服务（如果未启动）
npm run dev
```

## 核心原则

1. **Figma 优先** — 拿到 Figma URL 后，先 `get_design_context` 读取设计，再写代码。不要先猜测布局再改。
2. **接口驱动** — 用户提过「接口」「API」「接口文档」时，先找并读接口文档。接口字段名原样使用，不自创映射。
3. **复用优先** — 写新页面前，搜索项目已有同类页面（`src/pages/main/setting/**`、`src/components/custom/**`），理解项目模式后复用。
4. **全部特征一次做完** — CRUD 首轮必须包含全部特征清单（见下文），不等用户逐轮发现缺失。
5. **写后立刻验证** — 每个写入密集轮次，验证工具调用 ≥ 写入数的 50%。

## 灵活阶段（按需裁剪，不强制全走）

```
Phase 0: 需求理解（必做）
  明确哪些字段、哪些操作、是否带树/弹窗/抽屉/权限

Phase 1: Figma 读取（有 Figma URL 时必做）
  get_design_context(nodeId, fileKey) — 读目标节点
  必要时同时读多个节点（列表态、新增态、编辑态）

Phase 2: API 文档确认（条件触发）
  用户提过接口/API/文档→先找接口文件夹
  Glob api-doc / docs 目录
  读后端 Java 类或 Postman 集合

Phase 3: 已有代码审计（必做）
  Glob src/pages/main/setting/**  — 找同类页面
  Grep "useFetchAPI|CommonPermissionWrapper|useTranslation"  — 确认项目模式
  确认列配置在 config.tsx 而非内联

Phase 4: 实现（必做，但输入来自前 3 阶段）
  按 CRUD 特征清单逐项实现
  6 个 locale 文件同步更新

Phase 5: 验证（必做）
  浏览器检查关键节点渲染
  截图比对 Figma（如有 Figma）
  修正差异

Phase 6: 报告（必做）
  列出修改文件 + 已验证项 + 待确认项
```

## CRUD 特征清单

首轮实现必须包含全部 9 项，一条不落：

| # | 特征 | 检查点 |
|---|------|--------|
| 1 | **列表展示** | 表格/列表，展示全部接口字段，加载态/空态/错误态 |
| 2 | **新增** | 表单弹窗/页面，全部表单字段 + 校验规则 |
| 3 | **编辑** | 复用新增表单，带数据回填 |
| 4 | **删除** | 删除确认框，主条目 + 子条目（如有层级） |
| 5 | **国际化** | 同步更新全部 6 个 locale（zh-CN, zh-TW, en-US, th-TH, vi-VN, id-ID） |
| 6 | **权限控制** | 用 `CommonPermissionWrapper` 和 `checkPathPermission` |
| 7 | **加载状态** | loading / empty / error 三种状态覆盖 |
| 8 | **后端交互** | `useFetchAPI` 调真实接口，不用 Mock |
| 9 | **列配置** | 写在 `config.tsx`，不内联 |

## i18n 批量更新模板

新加 CRUD 页面时，以下 key 结构应覆盖：

```
{page}.{列字段名}        — 表格列头
{page}.add              — 新增按钮/标题
{page}.edit             — 编辑按钮/标题
{page}.delete           — 删除按钮/确认
{page}.deleteConfirm    — 删除确认文案
{page}.placeholder.{字段} — 输入框占位
{page}.validate.{字段}   — 校验错误提示
{page}.success.{操作}    — 成功提示
{page}.error.{操作}      — 失败提示
```

## 代码模式速查

| 模式 | 用法 |
|------|------|
| 权限包裹 | `<CommonPermissionWrapper path="xxx"><ElButton>...</ElButton></CommonPermissionWrapper>` |
| 列配置 | `src/pages/xxx/config.tsx` 导出 `getXxxColumns` |
| 接口调用 | `const { data, loading, execute } = useFetchAPI(url, { immediate: false })` |
| 国际化 | `const { useTranslation } = useI18n()` |
| 翻译 key | `useTranslation('pageName.add')` |
| 弹窗 | `<ElDialog><ElForm><ElFormItem>...</ElFormItem></ElForm></ElDialog>` |
| 表格 | `<CustomBaseTable columns={columns} data={data} loading={loading} />` |

## 验证工具选择

| 验证类型 | 工具 | 时机 |
|----------|------|------|
| 渲染检查 | `browser_query_nodes` | 每次样式/文本/结构修改后 |
| 样式检查 | `browser_inspect_styles` | CSS 修改后 |
| 错误检查 | `browser_console_logs` | 接口对接/路由切换后 |
| 视觉比对 | `design_compare_current_view(referenceImagePath)` | 有 Figma 截图时 |
| 截图保存 | `design_capture_current_view(label)` | 中间态存档 |

## 常见错误

- 先猜布局再改，而不是先读 Figma → **违反原则 1**
- 接口字段名自创映射 → **违反原则 2**，用接口原名
- 不搜同类直接开始写 → **违反原则 3**
- 只改中文 locale → **漏 5 种语言**
- 只写功能不装权限 → **上线后 403**
- 不验证就交 → **用户发现 Bug**
