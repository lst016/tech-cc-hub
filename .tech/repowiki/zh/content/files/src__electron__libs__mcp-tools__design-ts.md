# src/electron/libs/mcp-tools/design.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：1340

## 文件职责

源码文件。运行信号：mcp tool: design_capture_current_view、mcp tool: design_capture_current_region、mcp tool: design_inspect_image、mcp tool: design_compare_current_view、mcp tool: design_compare_images；依赖：@anthropic-ai/claude-agent-sdk、electron、fs、path、zod

## 运行信号

- `mcp tool: design_capture_current_view`
- `mcp tool: design_capture_current_region`
- `mcp tool: design_inspect_image`
- `mcp tool: design_compare_current_view`
- `mcp tool: design_compare_images`
- `mcp tool: design_compare_current_view_batch`
- `mcp tool: design_compare_images_batch`
- `mcp tool: design_read_comparison_report`
- `mcp tool: design_list_artifacts`

## 关键符号

- `setDesignToolHost@112 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `getHost@115 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `getDesignArtifactDir@124 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `sanitizeLabel@129 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `createArtifactPath@134 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `writePngArtifact@139 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `writeJsonArtifact@145 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `isJsonRecord@154 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `resolveDesignArtifactPath@158 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `inferDesignArtifactKind@170 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `listDesignArtifacts@186 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `summarizeComparisonReport@215 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `dataUrlToBuffer@250 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `createImageFromBuffer@258 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `createImageFromPath@268 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`
- `assertReasonableSize@281 - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `electron`
- `fs`
- `path`
- `zod`
- `../../browser-manager.js`
- `../claude-settings.js`
- `../design-inspection-dsl.js`
- `../design-image-path.js`
- `../image-preprocessor.js`
- `./tool-result.js`

## 对外暴露

- `DESIGN_TOOL_NAMES`
- `DesignToolHost`
- `setDesignToolHost`
- `getDesignMcpServer`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// 设计还原 MCP 工具：把“当前页面截图”和“参考设计图”变成可审阅的差异图。
// 目标是让 Agent 修 UI 时有量化依据，而不是只凭主观描述猜测。
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { app, nativeImage } from "electron";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "fs";
import { basename, join, sep } from "path";
import { z } from "zod";

import type { BrowserWorkbenchState } from "../../browser-manager.js";
import { resolveImagePreprocessApiConfig } from "../claude-settings.js";
import { buildDesignInspectionPrompt, parseDesignInspectionDsl } from "../design-inspection-dsl.js";
import { resolveDesignImagePath } from "../design-image-path.js";
import { summarizeLocalImageFile } from "../image-preprocessor.js";
import { toTextToolResult } from "./tool-result.js";

export const DESIGN_TOOL_NAMES = [
  "design_capture_current_view",
  "design_capture_current_region",
  "design_inspect_image",
  "design_compare_current_view",
  "design_compare_current_view_batch",
  "design_compare_images",
  "design_compare_images_batch",
  "design_read_comparison_report",
  "design_list_artifacts",
] as const;

export type DesignToolHost = {
  captureVisible: (sessionId: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  getState: (sessionId: string) => BrowserWorkbenchState;
};

type ImageSize = {
  width: number;
  height: number;
};

type CapturedImage = {
  path: string;
  size: ImageSize;
};

type IgnoreRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  reason?: string;
};

type NormalizedRegion = IgnoreRegion & {
  x2: number;
  y2: number;
};

type DiffColorMode = "highlight" | "directional" | "heatmap";
type ComparisonSensitivity = "strict" | "balanced" | "relaxed";

type DiffTileStats = {
  x: number;
  y: number;
  width: number;
  height: number;
  differentPixels: number;
  comparedPixels: number;
  differenceRatio: number;
  averageDelta: number;
};

type DesignArtifactKind = "current" | "diff" | "comparison" | "comparison-report" | "unknown";

const DESIGN_TOOLS_SERVER_NAME = "tech-cc-hub-design";
const DESIGN_MCP_SERVER_VERSION = "1.1.0";
const MAX_DIMENSION = 4096;
const DEFAULT_THRESHOLD = 24;
const DEFAULT_LABEL = "capture";
const DEFAULT_DIFF_COLOR_MODE: DiffColorMode = "highlight";
const DEFAULT_SENSITIVITY: ComparisonSensitivity = "balanced";
const MAX_IGNORE_REGIONS = 32;
const MAX_HOTSPOT_REGIONS = 8;
const HOTSPOT_TARGET_TILE_SIZE = 160;
const MAX_AUTO_RESIZE_ASPECT_DELTA = 0.03;
const MAX_AUTO_RESIZE_SCALE_DELTA = 0.03;
const MIN_AUTO_RESIZE_SCALE = 0.5;
const MAX_AUTO_RESIZE_SCALE = 2;
const DESIGN_ARTIFACT_KINDS = ["current", "diff", "comparison", "comparison-report", "unknown"] as const satisfies readonly DesignArtifactKind[];

const ignoreRegionToolSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  reason: z.string().trim().max(120).optional(),
});

const comparisonTuningToolSchema = {
  sensitivity: z.enum(["strict", "balanced", "relaxed"]).optional(),
  diffColorMode: z.enum(["highlight", "directional", "heatmap"]).optional(),
  ignoreAntialiasing: z.boolean().optional(),
  ignoreRegions: z.array(ignoreRegionToolSchema).max(MAX_IGNORE_REGIONS).optional(),
  maxDifferenceRatio: z.number().min(0).max(1).optional(),
};

let designHost: DesignToolHost | null = null;
const designMcpServersBySessionId = new Map<string, McpSdkServerConfigWithInstance>();

// 设计工具复用 BrowserView 截图能力，但独立存储图片文件和 diff，避免把大图塞进模型上下文。
export function setDesignToolHost(host: DesignToolHost | null): void {
  designHost = host;
}

function getHost(): DesignToolHost {
  if (!designHost) {
    throw new Error("设计还原工具尚未初始化，无法截图。");
  }
  return designHost;
}

// 所有视觉产物放到 userData/design-parity，方便用户和 Agent 一起审阅历史截图/diff。
function getDesignArtifactDir(): string {
  const dir = join(app.getPath("userData"), "design-parity");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function sanitizeLabel(label: string | undefined): string {
  const normalized = label?.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  retu
... (truncated)
```
