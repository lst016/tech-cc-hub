# Photoshop PSD 网页切图 MCP 设计

日期：2026-05-12
状态：待用户审阅
范围：在 tech-cc-hub 中新增独立内置 Photoshop MCP，用于网页 PSD 读取、Photoshop 控制、资产导出、页面结构 manifest 生成，并为后续 PSD 到网页代码闭环预留接口

## 目标

为 tech-cc-hub 增加一个一等的内部 Photoshop/PSD 能力：`tech-cc-hub-photoshop`。

第一版聚焦工作流 A：

- 用户提供网页设计 PSD 或 PSB。
- Agent 检查本机 Photoshop 和 PSD 解析能力。
- Agent 读取文档、图层、文字、基础样式和页面结构。
- Agent 可在安全策略下控制 Photoshop 做导出和受控修改。
- Agent 导出前端可引用的图片资产。
- Agent 生成页面结构型 manifest，作为后续代码生成和视觉校验的稳定输入。

设计文档同时明确后续演进到完整工作流 D：

- PSD/PSB 读取。
- Photoshop 控制和切图。
- 页面结构 manifest。
- 原生 HTML/CSS/JS 代码生成。
- React/Tailwind 代码生成。
- BrowserView 预览。
- 与 `tech-cc-hub-design` 结合做截图 diff 和修复闭环。
- 多页面和组件库级别生成。

## 第一版不做什么

- 不在 MVP 直接生成完整生产级页面代码。
- 不把 Photoshop 能力塞进现有 `tech-cc-hub-design`。
- 不把 PSD 解析结果伪装成 Photoshop 精确结果。
- 不默认覆盖原 PSD。
- 不执行任意用户传入的 Photoshop 脚本。
- 不把大图、完整 PSD 二进制或超大图层 JSON 直接塞进模型上下文。
- 不一次性实现多页面项目、组件库生成、响应式补全和视觉自动修复。

## 当前上下文

tech-cc-hub 目前已经有：

- 内置 MCP 注册表：`src/shared/builtin-mcp-registry.ts`。
- 内置 MCP 工厂：`src/electron/libs/builtin-mcp-servers.ts`。
- 视觉还原工具：`tech-cc-hub-design`，负责图片摘要、BrowserView 截图、图片 diff、comparison report 和产物列表。
- Figma REST 工具：`tech-cc-hub-figma`，负责 Figma PAT 读取、设计摘要、token 提取、UX 审查和 Tailwind 初稿。
- 外部 MCP 解析和 runner 工具门禁，已经支持内置 MCP 与配置型外部 MCP。
- MCP 设置页和插件设置页，可展示内置/外部能力。

这次能力应与现有设计工具互补：

- `tech-cc-hub-photoshop` 负责 PSD/Photoshop 侧的读取、导出和 manifest。
- `tech-cc-hub-design` 负责网页实现后的视觉校验。
- `tech-cc-hub-figma` 继续负责 Figma 侧设计输入。

## 已确认的产品选择

- 第一版选工作流 A：可读 PSD、可导出资产、可生成页面结构 manifest。
- 规划中保留完整 D：后续继续到代码生成、浏览器预览、视觉 diff 和修复闭环。
- 代码目标必须包含原生 HTML/CSS/JS，并与 React/Tailwind 并列作为后续生成目标。
- manifest 采用页面结构型，不只是资产清单。
- Photoshop 接入采用双通道：Photoshop 自动化优先，PSD/PSB 文件解析降级。
- 平台目标是 Windows 和 macOS。
- MVP 允许受控修改 PSD，但必须有备份、dry-run、显式确认、变更日志和回滚提示。
- 工具设计采用两层：底层 Photoshop 控制工具 + 上层网页切图工作流工具。
- 页面结构识别采用混合策略：命名约定优先，几何和视觉推断补充。
- 技能内化采用两层：MCP 内置结构化知识 + skill/workflow 方法论。

## 推荐方案

采用“独立内置 Photoshop MCP + 后续流水线接口”的方案。

新增内置 MCP server：

```txt
tech-cc-hub-photoshop
```

它与现有内置 MCP 并列，而不是扩展 `tech-cc-hub-design`。

这样做的理由：

- Photoshop 控制、PSD 解析和受控修改是高风险能力，需要独立安全边界。
- `tech-cc-hub-design` 已经承担图片分析和视觉 diff，继续扩张会让模块职责变混。
- 独立 MCP 更容易在设置页、工具门禁、日志、测试和后续插件化治理中单独管理。
- MVP 可以先稳定 PSD 到 manifest 的地基，再把 manifest 接给原生网页生成、React/Tailwind 生成和视觉闭环。

## 架构

### 顶层边界

```txt
PSD / PSB
  -> tech-cc-hub-photoshop
    -> Photoshop Control Adapter
    -> PSD Parser Fallback
    -> Safety Layer
    -> Web PSD Analyzer
    -> Export Planner
  -> Assets + Web Manifest
  -> later: Code Generator
    -> html-css-js
    -> react-tailwind
  -> later: BrowserView Preview
  -> later: tech-cc-hub-design visual diff
```

### 模块 1：Photoshop Control Adapter

职责：

- 发现本机 Photoshop 环境。
- 连接或启动 Photoshop。
- 打开 PSD/PSB。
- 读取文档信息、artboard、图层树、图层 bounds、文字和基础样式。
- 临时选择、显隐、测量和导出图层。
- 执行 allowlist 内的受控修改。

平台策略：

- macOS 不把 AppleScript 作为唯一方案。AppleScript 可以用于启动、聚焦或桥接，实际 Photoshop 操作优先走 Photoshop 脚本/UXP 能力。
- Windows 优先评估 Photoshop 脚本、UXP、COM 或命令桥接能力。
- 两个平台都收敛到统一 TypeScript adapter 接口，避免工具层感知平台细节。
- 实施计划必须先做平台自动化 spike，并为 macOS 与 Windows 各自记录首选通道、降级通道和不可用诊断。
- Photoshop 控制能力按 capability matrix 暴露；某平台暂不支持的操作必须显示为 unavailable，而不是静默失败。

接口形状：

```ts
type PhotoshopControlAdapter = {
  checkEnvironment(): Promise<PhotoshopEnvironment>;
  openDocument(input: OpenDocumentInput): Promise<PhotoshopDocumentRef>;
  listLayers(input: DocumentRefInput): Promise<LayerTreeResult>;
  measureLayer(input: LayerRefInput): Promise<LayerMeasurement>;
  exportLayer(input: ExportLayerInput): Promise<ExportedAsset>;
  exportDocumentPreview(input: ExportPreviewInput): Promise<ExportedPreview>;
  applyControlledChange(input: ControlledChangeInput): Promise<ControlledChangeResult>;
};
```

### 模块 2：PSD Parser Fallback

职责：

- 在 Photoshop 不可用、未安装、未启动或自动化通道失败时，直接读取 PSD/PSB 文件结构。
- 提供图层树、bounds、文本、基础样式和可见性等降级信息。
- 给 manifest 标记哪些字段来自解析器而非 Photoshop。

限制：

- 不保证智能对象、复杂混合模式、滤镜、效果和部分文字渲染信息完全准确。
- 不做受控修改。
- 不把 fallback 信息当作高置信度事实。

输出必须包含：

```json
{
  "fallbackUsed": true,
  "capabilities": ["layer-tree", "bounds", "basic-text"],
  "limitations": ["smart-object-rendering", "complex-effects"]
}
```

### 模块 3：Safety Layer

职责：

- 管理 PSD 修改前的 dry-run。
- 生成 `changePlan`。
- 创建备份。
- 执行用户确认后的修改。
- 写入 `changeLog`。
- 在失败时返回可恢复状态。

安全规则：

- 默认不覆盖原 PSD。
- 默认导出到项目内目录，例如 `design-assets/<psd-name>/`。
- 修改 PSD 前必须支持 `dryRun: true`。
- 真正修改前必须有显式确认字段，例如 `confirmed: true`。
- 修改前创建备份，例如 `.tech-cc-hub/photoshop-backups/<timestamp>-<file>.psd`。
- 只允许内置模板或 allowlist 操作，不允许任意脚本。
- 文件路径限制在工作区、PSD 所在目录或用户明确允许的目录。
- 大文件操作要有超时、分步进度和取消点。

`changeLog` 示例：

```json
{
  "tool": "photoshop_apply_controlled_change",
  "operation": "rename-layer",
  "targetLayerId": "layer-123",
  "backupPath": ".tech-cc-hub/photoshop-backups/2026-05-12-home.psd",
  "confirmed": true,
  "performedAt": "2026-05-12T10:20:00.000Z"
}
```

### 模块 4：Web PSD Analyzer

职责：

- 将 PSD 图层树转换成网页页面结构。
- 识别 section、组件候选、资产候选、文字内容和设计 token。
- 对推断结果给出 `confidence`、`source` 和 `needsReview`。

识别策略：

- 命名约定优先：`header`、`nav`、`hero`、`section/*`、`component/*`、`asset/*`、`state/hover`。
- 几何推断补充：y 轴分区、重复元素、对齐关系、容器嵌套、按钮形态、卡片列表。
- 文本和样式辅助：字体大小、颜色层级、按钮文本、链接文本、标题层级。
- 冲突时不强行定论，写入 warnings 和低置信度字段。

### 模块 5：Export Planner

职责：

- 从页面结构和图层信息生成资产导出计划。
- 决定资产格式、倍率、命名、路径和用途。
- 检查导出冲突、缺失项和不可导出图层。

默认策略：

- 图标和简单形状优先 SVG；无法保真时 PNG。
- 照片和大背景优先 WebP，后续可扩展 AVIF。
- 透明资产保留 alpha。
- 默认导出 1x 和 2x，manifest 记录 scale。
- 命名优先使用图层命名约定，不安全字符规范化。
- 背景图、logo、icon、装饰图和内容图分别标记 `usage`。

## MCP 工具设计

### 底层 Photoshop 控制工具

`photoshop_check_environment`

- 检测 OS、Photoshop 安装状态、运行状态、版本、可用自动化通道、PSD parser 可用性。

`photoshop_open_document`

- 打开 PSD/PSB。
- 返回 `documentId`、尺寸、DPI、颜色模式、artboard 信息、打开方式和 fallback 状态。

`photoshop_list_layers`

- 返回图层树、组、可见性、bounds、文本、基础样式、智能对象标记和命名问题。

`photoshop_select_layer`

- 选择目标图层，用于后续测量、截图、导出或人工检查。

`photoshop_set_layer_visibility`

- 临时显隐图层。
- 默认不保存 PSD，除非通过受控修改工具确认。

`photoshop_measure_layer`

- 读取图层尺寸、位置、字体、颜色、效果、opacity 和可测量信息。

`photoshop_export_layer`

- 导出单图层或组。
- 支持格式、倍率、背景透明、裁剪边界和目标目录。

`photoshop_export_document_preview`

- 导出整页、artboard 或当前可见状态预览图，用于后续视觉校验。

`photoshop_apply_controlled_change`

- 统一受控修改入口。
- 支持 allowlist 操作，例如重命名图层、生成切片标记、写入 metadata、整理导出命名。
- 必须支持 dry-run、确认、备份和 changeLog。

### 上层网页切图工作流工具

`psd_analyze_web_page`

- 分析网页 PSD。
- 输出页面结构、section、组件候选、token 候选、命名问题、低置信度推断。

`psd_plan_asset_exports`

- 根据页面结构规划导出资产。
- 输出导出计划、路径、格式、倍率、命名冲突和不可导出项。

`psd_export_web_assets`

- 执行批量导出。
- 返回导出报告、成功/失败资产、warning、耗时和导出目录。

`psd_generate_web_manifest`

- 生成页面结构型 manifest。
- manifest 是后续代码生成、视觉校验和人工审阅的主产物。

`psd_validate_web_manifest`

- 检查缺失资产、命名冲突、低置信度 section、无法导出图层、token 不完整和代码生成前置条件。

`psd_read_workflow_guidance`

- 返回内化的网页 PSD 切图规则、命名规范、导出策略、安全编辑策略和后续代码生成前置检查。

## Manifest 结构

第一版 manifest 是页面结构型。

```json
{
  "schemaVersion": "1.0",
  "source": {
    "filePath": "/workspace/design/home.psd",
    "documentId": "doc-123",
    "platform": "macos",
    "photoshopVersion": "25.0",
    "automationChannel": "uxp|script|com|applescript-bridge|parser",
    "fallbackUsed": false,
    "createdAt": "2026-05-12T10:20:00.000Z"
  },
  "page": {
    "name": "Home",
    "width": 1440,
    "height": 3200,
    "artboards": [],
    "sections": [
      {
        "id": "hero",
        "name": "Hero",
        "sourceLayerId": "group-hero",
        "bounds": { "x": 0, "y": 0, "width": 1440, "height": 720 },
        "confidence": 0.86,
        "source": ["layer-name", "geometry"],
        "needsReview": false,
        "components": [
          {
            "id": "primary-cta",
            "type": "button",
            "sourceLayerId": "layer-cta",
            "text": "Get started",
            "bounds": { "x": 160, "y": 520, "width": 180, "height": 48 },
            "confidence": 0.82,
            "source": ["text", "geometry", "style"],
            "needsReview": false
          }
        ]
      }
    ]
  },
  "tokens": {
    "colors": [],
    "typography": [],
    "spacing": [],
    "radii": [],
    "effects": []
  },
  "assets": [
    {
      "id": "logo",
      "sourceLayerId": "layer-logo",
      "path": "design-assets/home/logo.webp",
      "format": "webp",
      "bounds": { "x": 80, "y": 32, "width": 120, "height": 36 },
      "usage": "img",
      "scale": [1, 2],
      "confidence": 0.95
    }
  ],
  "codeTargets": ["html-css-js", "react-tailwind"],
  "warnings": [],
  "changeLog": []
}
```

关键规则：

- `confidence`、`source`、`needsReview` 是页面结构推断字段的必要信息。
- `codeTargets` 第一版就写入，MVP 不生成代码，但 schema 为后续生成器服务。
- `warnings` 不只是错误消息，也承担人工审阅清单。
- 大型图层树应通过 artifact 文件落盘，工具返回摘要和路径。
- manifest 文件默认落在 `design-assets/<psd-name>/manifest.json` 或 `.tech-cc-hub/photoshop/<psd-name>/manifest.json`。

## 内化技能与工作流

MCP 内置知识模块负责“工具执行时需要的结构化判断”：

- 网页 PSD 命名约定。
- 资产格式和倍率策略。
- 页面结构推断规则。
- token 提取规则。
- 低置信度和风险标记规则。
- 原生 HTML/CSS/JS 与 React/Tailwind 的 manifest 前置条件。

Skill/workflow 负责“Agent 怎么工作”：

- `psd-to-web-slicing`：从 PSD 开始，检查环境、分析、规划导出、执行导出、生成 manifest、验证 manifest。
- `psd-to-native-web`：后续从 manifest 生成 `index.html`、`styles.css`、`main.js` 时使用。
- `psd-to-react-tailwind`：后续从 manifest 生成 React/Tailwind 时使用。
- `visual-repair-loop`：后续结合 BrowserView 和 `tech-cc-hub-design` diff report 修页面。
- `photoshop-safe-editing`：定义什么时候必须 dry-run、确认、备份和记录 changeLog。

这些 skill/workflow 可以先在文档和 prompt hints 中表达，后续再进入正式技能资产或插件贡献。

## 与现有系统的集成

### 内置 MCP 注册

需要新增：

- `BuiltinMcpServerName`：`tech-cc-hub-photoshop`。
- `BuiltinMcpIconKey`：新增 `layers`，用于表达 PSD 图层和网页结构分析。
- `BUILTIN_MCP_SERVERS` 中的 Photoshop 定义。
- `BUILTIN_MCP_SERVER_FACTORIES` 中的 Photoshop 工厂。
- `BUILTIN_MCP_TOOL_NAMES` 中的 Photoshop 工具名列表。

### MCP 设置页

MCP 设置页应展示：

- 名称：`tech-cc-hub-photoshop`。
- 类型：内置 MCP。
- 高亮：PSD、Photoshop、Web manifest。
- 工具分组：Environment、Document、Layers、Export、Web workflow、Safety。
- 风险提示：该 MCP 可受控修改 PSD，修改默认需要确认和备份。

### Runner 工具门禁

内置 MCP 工具名加入现有 allowlist 体系。

当会话 `allowedTools="*"` 时可用。

当会话使用显式 allowed tools 时，Photoshop 工具必须按现有内置 MCP 规则被识别，不要被误判为外部未配置工具。

### Artifact 和文件目录

建议目录：

```txt
design-assets/<psd-name>/
  manifest.json
  exports/
  previews/
  reports/

.tech-cc-hub/photoshop/
  backups/
  change-logs/
  large-layer-trees/
```

原则：

- 面向前端项目消费的资产放 `design-assets/`。
- 安全、备份、诊断和大型中间产物放 `.tech-cc-hub/photoshop/`。
- 工具返回路径和摘要，避免把大文件塞进模型上下文。

## 错误处理

Photoshop 未安装：

- 返回 `photoshopAvailable: false`。
- 提供 PSD parser 降级能力。
- 不提示用户 PSD 损坏。

Photoshop 未启动：

- 工具可尝试启动。
- 启动失败时降级到 parser。

自动化通道不可用：

- 返回可用诊断：平台、版本、权限、通道名、失败原因。
- 不把通道失败误判为文件失败。

PSD 解析失败：

- 如果 Photoshop 可用，尝试通过 Photoshop 打开。
- 两者都失败时返回文件级错误。

某图层无法导出：

- 记录 warning。
- 继续导出其他资产。
- `psd_validate_web_manifest` 把它列为需要人工处理的缺口。

修改失败：

- 停止后续批量修改。
- 返回已完成操作、失败操作、备份路径和恢复建议。

Photoshop 结果与 parser 结果冲突：

- Photoshop 结果优先。
- manifest 写入 conflict warning。

## 测试策略

单元测试：

- Photoshop manifest schema。
- 命名约定解析。
- 资产导出计划。
- low confidence / needsReview 标记。
- changePlan 和 changeLog 生成。
- 路径安全检查。
- runner 内置 MCP 工具名 allowlist。

集成测试：

- 无 Photoshop 环境下 parser fallback。
- Photoshop 环境检查返回稳定结构。
- 只读 PSD 分析流程。
- dry-run 受控修改流程。
- 导出计划到 manifest 的完整链路。

手动 QA：

- macOS：真实 Photoshop 打开 PSD、列图层、导出预览、导出资产。
- Windows：真实 Photoshop 打开 PSD、列图层、导出预览、导出资产。
- Photoshop 未安装：确认降级能力和提示准确。
- 大 PSD：确认超时、分步返回和 artifact 落盘。
- 受控修改：确认备份、确认字段、changeLog 和默认不覆盖原文件。

验收标准：

- `tech-cc-hub-photoshop` 出现在内置 MCP 列表。
- Agent 能调用环境检查并区分 Photoshop 不可用、通道不可用和 PSD 文件错误。
- Agent 能读取 PSD 图层结构或明确进入 parser fallback。
- Agent 能生成页面结构型 manifest。
- Agent 能规划并导出网页资产。
- manifest 包含 `codeTargets: ["html-css-js", "react-tailwind"]`。
- 所有 PSD 修改都经过 dry-run、确认、备份和 changeLog。
- 工具输出不会把大图或超大 JSON 直接返回给模型。

## 路线图

Phase 1：Photoshop MCP + manifest

- 新增独立内置 MCP。
- 实现 PS/PSD 双通道。
- 读取网页 PSD。
- 规划并导出资产。
- 生成页面结构型 manifest。
- 支持受控修改、安全日志和降级提示。

Phase 2：代码生成输入稳定化

- 固化 manifest schema。
- 加原生 HTML/CSS/JS 生成前置检查。
- 加 React/Tailwind 生成前置检查。
- 增加 PSD-to-web skill/workflow。

Phase 3：原生网页生成

- 从 manifest 生成 `index.html`、`styles.css`、`main.js`。
- 使用 CSS variables 表达 tokens。
- 生成资源引用和简单交互占位。
- 支持 BrowserView 预览。

Phase 4：React/Tailwind 生成

- 从 manifest 生成 React 组件。
- 映射 Tailwind token。
- 补齐页面状态和响应式策略。

Phase 5：视觉闭环

- 用 PSD 或导出预览作为参考图。
- 用 BrowserView 截图当前页面。
- 调 `tech-cc-hub-design` 生成 diff report。
- Agent 按 report 修 CSS、布局和资源引用。

Phase 6：多页面和组件库

- 支持多 artboard、多 PSD 和多页面。
- 识别组件复用。
- 汇总设计系统 token。
- 批量生成并做回归 diff。

## 实施顺序建议

1. 增加内置 MCP registry 条目和空 server 工厂。
2. 定义 Photoshop 工具名、输入输出类型和 manifest schema。
3. 实现 `photoshop_check_environment`。
4. 实现 parser fallback 的最小读取能力。
5. 实现 `psd_analyze_web_page` 和 `psd_generate_web_manifest` 的纯数据路径。
6. 接入 Photoshop 控制 adapter 的 macOS/Windows 探测。
7. 实现导出计划和导出报告。
8. 实现受控修改 dry-run、备份和 changeLog。
9. 补 MCP 设置页展示。
10. 增加测试和手动 QA 脚本。

## 实施前决策项

- 第一批真实 PSD 样本需要覆盖哪些网页类型：landing page、dashboard、mobile page、marketing site、admin tool。
- Photoshop 自动化最终优先选择 UXP、ExtendScript、COM 还是混合桥接，由 Phase 1 的平台 spike 产出 capability matrix 和 ADR 后执行。
- PSD parser 依赖库需要评估许可证、PSB 支持、文字层准确度和大型文件性能。
- 资产默认格式是否立刻支持 AVIF，还是先用 WebP/PNG/SVG。
- 后续原生 HTML/CSS/JS 生成器是否作为单独 MCP、skill，还是作为 `tech-cc-hub-photoshop` 的后续工作流工具。
