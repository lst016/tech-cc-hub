// 设计还原 MCP 工具：把“当前页面截图”和“参考设计图”变成可审阅的差异图。
// 目标是让 Agent 修 UI 时有量化依据，而不是只凭主观描述猜测。
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { app, nativeImage } from "electron";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "fs";
import { basename, join, sep } from "path";
import { z } from "zod";

import type { BrowserWorkbenchState } from "../../browser-manager.js";
import { getCurrentApiConfig } from "../claude-settings.js";
import { buildDesignInspectionPrompt, parseDesignInspectionDsl } from "../design-inspection-dsl.js";
import { resolveDesignImagePath } from "../design-image-path.js";
import { summarizeLocalImageFile } from "../image-preprocessor.js";

export const DESIGN_TOOL_NAMES = [
  "design_capture_current_view",
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

function toTextToolResult(payload: unknown, isError = false): CallToolResult {
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

// 所有视觉产物放到 userData/design-parity，方便用户和 Agent 一起审阅历史截图/diff。
function getDesignArtifactDir(): string {
  const dir = join(app.getPath("userData"), "design-parity");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function sanitizeLabel(label: string | undefined): string {
  const normalized = label?.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return normalized || DEFAULT_LABEL;
}

function createArtifactPath(label: string | undefined, suffix: string, extension = "png"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(getDesignArtifactDir(), `${timestamp}-${sanitizeLabel(label)}-${suffix}.${extension}`);
}

function writePngArtifact(image: Electron.NativeImage, label: string | undefined, suffix: string): string {
  const path = createArtifactPath(label, suffix);
  writeFileSync(path, image.toPNG());
  return path;
}

function writeJsonArtifact(payload: unknown, label: string | undefined, suffix: string): string {
  const path = createArtifactPath(label, suffix, "json");
  const payloadWithPath = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? { ...payload, reportPath: path }
    : payload;
  writeFileSync(path, JSON.stringify(payloadWithPath, null, 2), "utf8");
  return path;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveDesignArtifactPath(path: string, label: string): string {
  const root = realpathSync(getDesignArtifactDir());
  const artifactPath = realpathSync(path);
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`;
  const rootKey = normalizedRoot.toLowerCase();
  const artifactKey = artifactPath.toLowerCase();
  if (artifactPath.toLowerCase() !== root.toLowerCase() && !artifactKey.startsWith(rootKey)) {
    throw new Error(`${label} 必须位于设计还原产物目录内：${root}`);
  }
  return artifactPath;
}

function inferDesignArtifactKind(fileName: string): DesignArtifactKind {
  if (fileName.endsWith("-comparison-report.json")) {
    return "comparison-report";
  }
  if (fileName.endsWith("-comparison.png")) {
    return "comparison";
  }
  if (fileName.endsWith("-diff.png")) {
    return "diff";
  }
  if (fileName.endsWith("-current.png")) {
    return "current";
  }
  return "unknown";
}

function listDesignArtifacts(limit: number, kind?: DesignArtifactKind) {
  const artifactDir = getDesignArtifactDir();
  return readdirSync(artifactDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(artifactDir, entry.name);
      const stats = statSync(path);
      const artifactKind = inferDesignArtifactKind(entry.name);
      return {
        name: entry.name,
        path,
        kind: artifactKind,
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        modifiedAtMs: stats.mtimeMs,
      };
    })
    .filter((artifact) => kind === undefined || artifact.kind === kind)
    .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)
    .slice(0, limit)
    .map((artifact) => ({
      name: artifact.name,
      path: artifact.path,
      kind: artifact.kind,
      sizeBytes: artifact.sizeBytes,
      modifiedAt: artifact.modifiedAt,
    }));
}

function summarizeComparisonReport(report: Record<string, unknown>, reportPath: string) {
  const topDiffRegions = Array.isArray(report.topDiffRegions)
    ? report.topDiffRegions.slice(0, MAX_HOTSPOT_REGIONS)
    : [];

  return {
    referenceImagePath: report.referenceImagePath,
    candidateImagePath: report.candidateImagePath,
    diffImagePath: report.diffImagePath,
    comparisonImagePath: report.comparisonImagePath,
    reportPath: typeof report.reportPath === "string" ? report.reportPath : reportPath,
    threshold: report.threshold,
    sensitivity: report.sensitivity,
    diffColorMode: report.diffColorMode,
    differenceRatio: report.differenceRatio,
    averageChannelDelta: report.averageChannelDelta,
    maxChannelDelta: report.maxChannelDelta,
    comparedSize: report.comparedSize,
    ignoredPixels: report.ignoredPixels,
    antialiasingPixels: report.antialiasingPixels,
    diffBoundingBox: report.diffBoundingBox,
    topDiffRegions,
    ignoredRegions: report.ignoredRegions,
    verdict: report.verdict,
    advice: report.advice,
  };
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match?.[1]) {
    throw new Error("截图结果不是可识别的图片 data URL。");
  }
  return Buffer.from(match[1], "base64");
}

function createImageFromBuffer(buffer: Buffer, label: string) {
  const image = nativeImage.createFromBuffer(buffer);
  if (image.isEmpty()) {
    throw new Error(`${label} 图片无法读取。`);
  }
  const size = image.getSize();
  assertReasonableSize(size, label);
  return image;
}

function createImageFromPath(path: string, label: string) {
  if (!existsSync(path)) {
    throw new Error(`${label} 文件不存在：${path}`);
  }
  const image = nativeImage.createFromPath(path);
  if (image.isEmpty()) {
    throw new Error(`${label} 图片无法读取：${path}`);
  }
  const size = image.getSize();
  assertReasonableSize(size, label);
  return image;
}

function assertReasonableSize(size: ImageSize, label: string): void {
  if (size.width <= 0 || size.height <= 0) {
    throw new Error(`${label} 图片尺寸无效。`);
  }
  if (size.width > MAX_DIMENSION || size.height > MAX_DIMENSION) {
    throw new Error(`${label} 图片过大（${size.width}x${size.height}），请先裁剪到页面主体区域。`);
  }
}

// 当前版本先支持“本地参考图路径”；后续接 Figma API 时，只需要把参考图导出到同一目录再复用 compareImages。
async function captureCurrentView(sessionId: string, label?: string): Promise<CapturedImage & { state: BrowserWorkbenchState }> {
  const host = getHost();
  const capture = await host.captureVisible(sessionId);
  if (!capture.success || !capture.dataUrl) {
    throw new Error(capture.error || "当前 BrowserView 截图失败。");
  }

  const buffer = dataUrlToBuffer(capture.dataUrl);
  const image = createImageFromBuffer(buffer, "当前页面截图");
  const path = createArtifactPath(label, "current");
  writeFileSync(path, buffer);

  return {
    path,
    size: image.getSize(),
    state: host.getState(sessionId),
  };
}

function clampThreshold(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_THRESHOLD;
  }
  return Math.max(0, Math.min(255, Math.round(value ?? DEFAULT_THRESHOLD)));
}

function resolveThreshold(value: number | undefined, sensitivity: ComparisonSensitivity | undefined): number {
  if (value !== undefined) {
    return clampThreshold(value);
  }
  switch (sensitivity ?? DEFAULT_SENSITIVITY) {
    case "strict":
      return 12;
    case "relaxed":
      return 48;
    case "balanced":
    default:
      return DEFAULT_THRESHOLD;
  }
}

function clampDiffColorMode(value: DiffColorMode | undefined): DiffColorMode {
  return value ?? DEFAULT_DIFF_COLOR_MODE;
}

function normalizeImagePath(path: string, label: string): string {
  return resolveDesignImagePath(path, label);
}

function isSameImagePath(leftPath: string, rightPath: string): boolean {
  try {
    return realpathSync(leftPath) === realpathSync(rightPath);
  } catch {
    return leftPath === rightPath;
  }
}

function copyBitmapRegion(input: {
  source: Buffer;
  sourceWidth: number;
  target: Buffer;
  targetWidth: number;
  targetX: number;
  targetY: number;
  width: number;
  height: number;
}): void {
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const sourceIndex = (y * input.sourceWidth + x) * 4;
      const targetIndex = ((input.targetY + y) * input.targetWidth + input.targetX + x) * 4;
      input.target[targetIndex] = input.source[sourceIndex];
      input.target[targetIndex + 1] = input.source[sourceIndex + 1];
      input.target[targetIndex + 2] = input.source[sourceIndex + 2];
      input.target[targetIndex + 3] = input.source[sourceIndex + 3];
    }
  }
}

function createComparisonSheet(input: {
  referenceBitmap: Buffer;
  candidateBitmap: Buffer;
  diffBitmap: Buffer;
  panelSize: ImageSize;
  label?: string;
}): string {
  const gap = 24;
  const width = input.panelSize.width * 3 + gap * 4;
  const height = input.panelSize.height + gap * 2;
  const sheetBitmap = Buffer.alloc(width * height * 4);

  // nativeImage bitmap 使用 BGRA；这里铺浅色背景，三栏顺序固定为：参考图 / 当前图 / 差异图。
  for (let index = 0; index < sheetBitmap.length; index += 4) {
    sheetBitmap[index] = 245;
    sheetBitmap[index + 1] = 245;
    sheetBitmap[index + 2] = 245;
    sheetBitmap[index + 3] = 255;
  }

  const panelXs = [
    gap,
    gap * 2 + input.panelSize.width,
    gap * 3 + input.panelSize.width * 2,
  ];
  for (const [index, bitmap] of [input.referenceBitmap, input.candidateBitmap, input.diffBitmap].entries()) {
    copyBitmapRegion({
      source: bitmap,
      sourceWidth: input.panelSize.width,
      target: sheetBitmap,
      targetWidth: width,
      targetX: panelXs[index],
      targetY: gap,
      width: input.panelSize.width,
      height: input.panelSize.height,
    });
  }

  const sheetImage = nativeImage.createFromBitmap(sheetBitmap, { width, height });
  return writePngArtifact(sheetImage, input.label, "comparison");
}

function normalizeRegions(regions: IgnoreRegion[] | undefined, size: ImageSize): NormalizedRegion[] {
  return (regions ?? []).slice(0, MAX_IGNORE_REGIONS).map((region) => {
    const x = Math.max(0, Math.min(size.width, Math.floor(region.x)));
    const y = Math.max(0, Math.min(size.height, Math.floor(region.y)));
    const x2 = Math.max(x, Math.min(size.width, Math.ceil(region.x + region.width)));
    const y2 = Math.max(y, Math.min(size.height, Math.ceil(region.y + region.height)));
    return {
      x,
      y,
      x2,
      y2,
      width: x2 - x,
      height: y2 - y,
      reason: region.reason?.trim() || undefined,
    };
  }).filter((region) => region.width > 0 && region.height > 0);
}

function createIgnoreMask(regions: NormalizedRegion[], size: ImageSize): { mask: Uint8Array | null; ignoredPixels: number } {
  if (regions.length === 0) {
    return { mask: null, ignoredPixels: 0 };
  }

  const mask = new Uint8Array(size.width * size.height);
  for (const region of regions) {
    for (let y = region.y; y < region.y2; y += 1) {
      const rowStart = y * size.width;
      mask.fill(1, rowStart + region.x, rowStart + region.x2);
    }
  }

  let ignoredPixels = 0;
  for (const value of mask) {
    ignoredPixels += value;
  }
  return { mask, ignoredPixels };
}

function luminance(bitmap: Buffer, index: number): number {
  // nativeImage bitmap is BGRA.
  return bitmap[index + 2] * 0.299 + bitmap[index + 1] * 0.587 + bitmap[index] * 0.114;
}

function localLuminanceRange(bitmap: Buffer, size: ImageSize, x: number, y: number): number {
  let min = 255;
  let max = 0;
  for (let yy = Math.max(0, y - 1); yy <= Math.min(size.height - 1, y + 1); yy += 1) {
    for (let xx = Math.max(0, x - 1); xx <= Math.min(size.width - 1, x + 1); xx += 1) {
      const value = luminance(bitmap, (yy * size.width + xx) * 4);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  return max - min;
}

function isLikelyAntialiasingNoise(input: {
  referenceBitmap: Buffer;
  candidateBitmap: Buffer;
  size: ImageSize;
  x: number;
  y: number;
  delta: number;
  threshold: number;
}): boolean {
  if (input.delta > Math.max(64, input.threshold * 3)) {
    return false;
  }
  const referenceRange = localLuminanceRange(input.referenceBitmap, input.size, input.x, input.y);
  const candidateRange = localLuminanceRange(input.candidateBitmap, input.size, input.x, input.y);
  return referenceRange > 18 || candidateRange > 18;
}

function writeDiffPixel(input: {
  diffBitmap: Buffer;
  outputIndex: number;
  mode: DiffColorMode;
  referenceLuminance: number;
  candidateLuminance: number;
  delta: number;
}): void {
  if (input.mode === "heatmap") {
    const intensity = Math.max(96, Math.min(255, input.delta));
    input.diffBitmap[input.outputIndex] = 0;
    input.diffBitmap[input.outputIndex + 1] = 255 - Math.round(intensity * 0.7);
    input.diffBitmap[input.outputIndex + 2] = 255;
    input.diffBitmap[input.outputIndex + 3] = 255;
    return;
  }

  if (input.mode === "directional") {
    const candidateIsBrighter = input.candidateLuminance >= input.referenceLuminance;
    input.diffBitmap[input.outputIndex] = candidateIsBrighter ? 48 : 255;
    input.diffBitmap[input.outputIndex + 1] = 72;
    input.diffBitmap[input.outputIndex + 2] = candidateIsBrighter ? 255 : 48;
    input.diffBitmap[input.outputIndex + 3] = 255;
    return;
  }

  input.diffBitmap[input.outputIndex] = 0;
  input.diffBitmap[input.outputIndex + 1] = 0;
  input.diffBitmap[input.outputIndex + 2] = 255;
  input.diffBitmap[input.outputIndex + 3] = 255;
}

function writeIgnoredPixel(diffBitmap: Buffer, outputIndex: number): void {
  diffBitmap[outputIndex] = 210;
  diffBitmap[outputIndex + 1] = 214;
  diffBitmap[outputIndex + 2] = 120;
  diffBitmap[outputIndex + 3] = 72;
}

function createTileStats(size: ImageSize): { tiles: DiffTileStats[]; columns: number; rows: number } {
  const columns = Math.max(1, Math.min(12, Math.ceil(size.width / HOTSPOT_TARGET_TILE_SIZE)));
  const rows = Math.max(1, Math.min(12, Math.ceil(size.height / HOTSPOT_TARGET_TILE_SIZE)));
  const tiles: DiffTileStats[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = Math.floor((column * size.width) / columns);
      const y = Math.floor((row * size.height) / rows);
      const x2 = Math.floor(((column + 1) * size.width) / columns);
      const y2 = Math.floor(((row + 1) * size.height) / rows);
      tiles.push({
        x,
        y,
        width: x2 - x,
        height: y2 - y,
        differentPixels: 0,
        comparedPixels: 0,
        differenceRatio: 0,
        averageDelta: 0,
      });
    }
  }
  return { tiles, columns, rows };
}

function buildVisualAdvice(input: {
  differenceRatio: number;
  resizedCandidateToReference: boolean;
  ignoredPixels: number;
  comparedPixels: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  maxDifferenceRatio?: number;
}): string[] {
  const advice: string[] = [];
  if (input.resizedCandidateToReference) {
    advice.push("候选图尺寸已缩放到参考图尺寸，先确认 viewport / 导出尺寸是否一致，再解读像素差异。");
  }
  if (input.ignoredPixels > 0) {
    advice.push(`已忽略 ${input.ignoredPixels} 个像素对应的动态区域，差异比例只基于未忽略区域计算。`);
  }
  if (input.maxDifferenceRatio !== undefined) {
    advice.push(input.differenceRatio <= input.maxDifferenceRatio
      ? "差异比例低于验收阈值，可作为视觉回归通过依据。"
      : "差异比例超过验收阈值，请优先检查 topDiffRegions 和 diffBoundingBox。");
  }
  if (input.boundingBox) {
    advice.push(`主要差异边界：x=${input.boundingBox.x}, y=${input.boundingBox.y}, w=${input.boundingBox.width}, h=${input.boundingBox.height}。`);
  }
  if (input.comparedPixels === 0) {
    advice.push("没有可比较像素，请检查 ignoreRegions 是否覆盖了整张图。");
  }
  return advice;
}

// 轻量像素 diff：不同像素标红，相同区域保留半透明灰度，便于快速看出布局和色彩偏差。
function compareImages(input: {
  referenceImagePath: string;
  candidateImagePath: string;
  threshold?: number;
  sensitivity?: ComparisonSensitivity;
  diffColorMode?: DiffColorMode;
  ignoreAntialiasing?: boolean;
  ignoreRegions?: IgnoreRegion[];
  maxDifferenceRatio?: number;
  resizeCandidateToReference?: boolean;
  label?: string;
}) {
  const threshold = resolveThreshold(input.threshold, input.sensitivity);
  const diffColorMode = clampDiffColorMode(input.diffColorMode);
  const referenceImagePath = normalizeImagePath(input.referenceImagePath, "参考图路径");
  const candidateImagePath = normalizeImagePath(input.candidateImagePath, "当前截图路径");
  if (isSameImagePath(referenceImagePath, candidateImagePath)) {
    throw new Error("参考图和当前截图是同一个文件，截图比照没有意义。若只是想读取用户上传的参考图，请先调用 design_inspect_image；若要做还原对齐，请用 design_compare_current_view 将当前页面截图与参考图比较。");
  }
  const referenceImage = createImageFromPath(referenceImagePath, "参考图");
  const candidateImageOriginal = createImageFromPath(candidateImagePath, "当前页面截图");
  const referenceSize = referenceImage.getSize();
  const candidateOriginalSize = candidateImageOriginal.getSize();
  const shouldResize = input.resizeCandidateToReference !== false
    && (candidateOriginalSize.width !== referenceSize.width || candidateOriginalSize.height !== referenceSize.height);
  const candidateImage = shouldResize
    ? candidateImageOriginal.resize({ width: referenceSize.width, height: referenceSize.height, quality: "best" })
    : candidateImageOriginal;
  const candidateSize = candidateImage.getSize();
  const width = Math.min(referenceSize.width, candidateSize.width);
  const height = Math.min(referenceSize.height, candidateSize.height);
  const referenceBitmap = referenceImage.toBitmap();
  const candidateBitmap = candidateImage.toBitmap();
  const comparedSize = { width, height };
  const ignoreRegions = normalizeRegions(input.ignoreRegions, comparedSize);
  const { mask: ignoreMask, ignoredPixels } = createIgnoreMask(ignoreRegions, comparedSize);
  const tileLayout = createTileStats(comparedSize);
  const diffBitmap = Buffer.alloc(width * height * 4);
  let differentPixels = 0;
  let comparedPixels = 0;
  let antialiasingPixels = 0;
  let totalDelta = 0;
  let maxChannelDelta = 0;
  let minDiffX = width;
  let minDiffY = height;
  let maxDiffX = -1;
  let maxDiffY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const outputIndex = (y * width + x) * 4;
      const referenceIndex = (y * referenceSize.width + x) * 4;
      const candidateIndex = (y * candidateSize.width + x) * 4;
      if (ignoreMask?.[y * width + x]) {
        writeIgnoredPixel(diffBitmap, outputIndex);
        continue;
      }

      const delta0 = Math.abs(referenceBitmap[referenceIndex] - candidateBitmap[candidateIndex]);
      const delta1 = Math.abs(referenceBitmap[referenceIndex + 1] - candidateBitmap[candidateIndex + 1]);
      const delta2 = Math.abs(referenceBitmap[referenceIndex + 2] - candidateBitmap[candidateIndex + 2]);
      const delta = Math.max(delta0, delta1, delta2);
      const referenceLuminance = luminance(referenceBitmap, referenceIndex);
      const candidateLuminance = luminance(candidateBitmap, candidateIndex);
      const tileColumn = Math.min(tileLayout.columns - 1, Math.floor((x * tileLayout.columns) / width));
      const tileRow = Math.min(tileLayout.rows - 1, Math.floor((y * tileLayout.rows) / height));
      const tile = tileLayout.tiles[tileRow * tileLayout.columns + tileColumn];
      comparedPixels += 1;
      totalDelta += delta;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      tile.comparedPixels += 1;
      tile.averageDelta += delta;

      const isAntialiasingNoise = input.ignoreAntialiasing === true && delta > threshold && isLikelyAntialiasingNoise({
        referenceBitmap,
        candidateBitmap,
        size: comparedSize,
        x,
        y,
        delta,
        threshold,
      });

      if (isAntialiasingNoise) {
        antialiasingPixels += 1;
      }

      if (delta > threshold && !isAntialiasingNoise) {
        differentPixels += 1;
        tile.differentPixels += 1;
        minDiffX = Math.min(minDiffX, x);
        minDiffY = Math.min(minDiffY, y);
        maxDiffX = Math.max(maxDiffX, x);
        maxDiffY = Math.max(maxDiffY, y);
        writeDiffPixel({
          diffBitmap,
          outputIndex,
          mode: diffColorMode,
          referenceLuminance,
          candidateLuminance,
          delta,
        });
      } else {
        const gray = Math.round((candidateBitmap[candidateIndex] + candidateBitmap[candidateIndex + 1] + candidateBitmap[candidateIndex + 2]) / 3);
        diffBitmap[outputIndex] = gray;
        diffBitmap[outputIndex + 1] = gray;
        diffBitmap[outputIndex + 2] = gray;
        diffBitmap[outputIndex + 3] = 64;
      }
    }
  }

  const totalPixels = width * height;
  const differenceRatio = comparedPixels > 0 ? differentPixels / comparedPixels : 0;
  const averageChannelDelta = comparedPixels > 0 ? totalDelta / comparedPixels : 0;
  const diffBoundingBox = differentPixels > 0
    ? { x: minDiffX, y: minDiffY, width: maxDiffX - minDiffX + 1, height: maxDiffY - minDiffY + 1 }
    : null;
  const topDiffRegions = tileLayout.tiles.map((tile) => ({
    ...tile,
    differenceRatio: tile.comparedPixels > 0 ? tile.differentPixels / tile.comparedPixels : 0,
    averageDelta: tile.comparedPixels > 0 ? tile.averageDelta / tile.comparedPixels : 0,
  }))
    .filter((tile) => tile.differentPixels > 0)
    .sort((left, right) => {
      const rightScore = right.differenceRatio * Math.log10(right.differentPixels + 10);
      const leftScore = left.differenceRatio * Math.log10(left.differentPixels + 10);
      return rightScore - leftScore;
    })
    .slice(0, MAX_HOTSPOT_REGIONS);
  const passed = input.maxDifferenceRatio === undefined ? null : differenceRatio <= input.maxDifferenceRatio;
  const diffImage = nativeImage.createFromBitmap(diffBitmap, { width, height });
  const diffPath = writePngArtifact(diffImage, input.label, "diff");
  const comparisonPath = createComparisonSheet({
    referenceBitmap,
    candidateBitmap,
    diffBitmap,
    panelSize: { width, height },
    label: input.label,
  });
  const comparison = {
    referenceImagePath,
    candidateImagePath,
    diffImagePath: diffPath,
    comparisonImagePath: comparisonPath,
    reportPath: "",
    threshold,
    sensitivity: input.sensitivity ?? DEFAULT_SENSITIVITY,
    diffColorMode,
    ignoreAntialiasing: input.ignoreAntialiasing === true,
    maxDifferenceRatio: input.maxDifferenceRatio,
    resizedCandidateToReference: shouldResize,
    comparedSize: { width, height },
    referenceSize,
    candidateSize: candidateOriginalSize,
    normalizedCandidateSize: candidateSize,
    differentPixels,
    totalPixels,
    comparedPixels,
    ignoredPixels,
    antialiasingPixels,
    differenceRatio,
    averageChannelDelta,
    maxChannelDelta,
    diffBoundingBox,
    topDiffRegions,
    ignoredRegions: ignoreRegions.map((region) => ({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      reason: region.reason,
    })),
    verdict: {
      passed,
      maxDifferenceRatio: input.maxDifferenceRatio ?? null,
      message: passed === null
        ? "已完成视觉比对，未设置通过阈值。"
        : passed
          ? "视觉差异在阈值范围内。"
          : "视觉差异超过阈值。",
    },
    advice: buildVisualAdvice({
      differenceRatio,
      resizedCandidateToReference: shouldResize,
      ignoredPixels,
      comparedPixels,
      boundingBox: diffBoundingBox ?? undefined,
      maxDifferenceRatio: input.maxDifferenceRatio,
    }),
  };
  comparison.reportPath = writeJsonArtifact(comparison, input.label, "comparison-report");
  return comparison;
}

export function getDesignMcpServer(sessionId = "global"): McpSdkServerConfigWithInstance {
  const resolvedSessionId = sessionId.trim() || "global";
  const cachedServer = designMcpServersBySessionId.get(resolvedSessionId);
  if (cachedServer) {
    return cachedServer;
  }

  const captureTool = tool(
    "design_capture_current_view",
    "截取当前内置浏览器 BrowserView 可见区域并保存为 PNG 文件，返回文件路径和页面状态。用于设计还原、视觉 QA、和 Figma 对齐前的候选图采集。",
    {
      label: z.string().trim().min(1).max(80).optional(),
    },
    async (input) => {
      try {
        const capture = await captureCurrentView(resolvedSessionId, input.label);
        return toTextToolResult({
          action: "design_capture_current_view",
          success: true,
          sessionId: resolvedSessionId,
          capture,
        });
      } catch (error) {
        return toTextToolResult({
          action: "design_capture_current_view",
          success: false,
          error: error instanceof Error ? error.message : "截图失败。",
        }, true);
      }
    },
  );

  const inspectImageTool = tool(
    "design_inspect_image",
    "读取一张本地截图/设计图的视觉语义摘要。用于用户上传参考图后先理解页面结构、文字、颜色和布局。只返回文本摘要，不把图片 base64 注入主 Agent 上下文；不要用 Read 读取图片文件。",
    {
      imagePath: z.string().trim().min(1),
      prompt: z.string().trim().max(800).optional(),
    },
    async (input) => {
      try {
        const imagePath = normalizeImagePath(input.imagePath, "图片路径");
        const image = createImageFromPath(imagePath, "待分析图片");
        const imageSize = image.getSize();
        const inspectionText = await summarizeLocalImageFile({
          config: getCurrentApiConfig(),
          prompt: buildDesignInspectionPrompt(input.prompt),
          filePath: imagePath,
        });
        if (!inspectionText) {
          throw new Error("未配置可用的图片理解模型。请在设置里配置 imageModel / 视觉模型后再分析截图。");
        }
        const dsl = parseDesignInspectionDsl(inspectionText, imageSize);
        return toTextToolResult({
          action: "design_inspect_image",
          success: true,
          image: {
            path: imagePath,
            size: imageSize,
          },
          summary: dsl.summary,
          dsl,
          note: "图片只在工具内部交给视觉模型处理，主 Agent 收到的是文本摘要，不包含 base64。",
        });
      } catch (error) {
        return toTextToolResult({
          action: "design_inspect_image",
          success: false,
          error: error instanceof Error ? error.message : "图片分析失败。",
        }, true);
      }
    },
  );

  const compareTool = tool(
    "design_compare_current_view",
    "将当前内置浏览器 BrowserView 截图与参考设计图进行截图比照，保存当前截图、diff 图、三栏 comparison 图和 JSON report。返回差异比例、差异边界、热点区域、忽略区域和验收结论。referenceImagePath 应传 Figma 导出的 PNG/JPG/WebP 文件路径。若只是读取单张参考图，请用 design_inspect_image。",
    {
      referenceImagePath: z.string().trim().min(1),
      label: z.string().trim().min(1).max(80).optional(),
      threshold: z.number().min(0).max(255).optional(),
      ...comparisonTuningToolSchema,
      resizeCandidateToReference: z.boolean().optional(),
    },
    async (input) => {
      try {
        const capture = await captureCurrentView(resolvedSessionId, input.label);
        const comparison = compareImages({
          referenceImagePath: input.referenceImagePath,
          candidateImagePath: capture.path,
          threshold: input.threshold,
          sensitivity: input.sensitivity,
          diffColorMode: input.diffColorMode,
          ignoreAntialiasing: input.ignoreAntialiasing,
          ignoreRegions: input.ignoreRegions,
          maxDifferenceRatio: input.maxDifferenceRatio,
          resizeCandidateToReference: input.resizeCandidateToReference,
          label: input.label,
        });
        return toTextToolResult({
          action: "design_compare_current_view",
          success: true,
          sessionId: resolvedSessionId,
          state: capture.state,
          comparison,
        });
      } catch (error) {
        return toTextToolResult({
          action: "design_compare_current_view",
          success: false,
          error: error instanceof Error ? error.message : "设计对比失败。",
        }, true);
      }
    },
  );

  const compareImagesTool = tool(
    "design_compare_images",
    "对两张不同的本地截图做截图比照，保存 diff 图、三栏 comparison 图和 JSON report。适合比较 Figma 导出图、页面截图、回归截图等，不依赖当前 BrowserView。支持 ignoreRegions 忽略动态区域、maxDifferenceRatio 给出验收结论、diffColorMode 输出方向/热力差异。不要把同一张图同时作为 reference 和 candidate；单图理解请用 design_inspect_image。",
    {
      referenceImagePath: z.string().trim().min(1),
      candidateImagePath: z.string().trim().min(1),
      label: z.string().trim().min(1).max(80).optional(),
      threshold: z.number().min(0).max(255).optional(),
      ...comparisonTuningToolSchema,
      resizeCandidateToReference: z.boolean().optional(),
    },
    async (input) => {
      try {
        const comparison = compareImages({
          referenceImagePath: input.referenceImagePath,
          candidateImagePath: input.candidateImagePath,
          threshold: input.threshold,
          sensitivity: input.sensitivity,
          diffColorMode: input.diffColorMode,
          ignoreAntialiasing: input.ignoreAntialiasing,
          ignoreRegions: input.ignoreRegions,
          maxDifferenceRatio: input.maxDifferenceRatio,
          resizeCandidateToReference: input.resizeCandidateToReference,
          label: input.label,
        });
        return toTextToolResult({
          action: "design_compare_images",
          success: true,
          comparison,
        });
      } catch (error) {
        return toTextToolResult({
          action: "design_compare_images",
          success: false,
          error: error instanceof Error ? error.message : "截图比照失败。",
        }, true);
      }
    },
  );

  const compareCurrentViewBatchTool = tool(
    "design_compare_current_view_batch",
    "一次截图当前 BrowserView，再与多张本地参考图分别比对。每个结果都会生成 diff、comparison 和 JSON report，适合多断点/多状态视觉回归。",
    {
      referenceImagePaths: z.array(z.string().trim().min(1)).min(1).max(8),
      label: z.string().trim().min(1).max(80).optional(),
      threshold: z.number().min(0).max(255).optional(),
      ...comparisonTuningToolSchema,
      resizeCandidateToReference: z.boolean().optional(),
    },
    async (input) => {
      try {
        const capture = await captureCurrentView(resolvedSessionId, input.label);
        const results = await Promise.all(input.referenceImagePaths.map(async (referenceImagePath, index) => {
          try {
            const comparison = compareImages({
              referenceImagePath,
              candidateImagePath: capture.path,
              threshold: input.threshold,
              sensitivity: input.sensitivity,
              diffColorMode: input.diffColorMode,
              ignoreAntialiasing: input.ignoreAntialiasing,
              ignoreRegions: input.ignoreRegions,
              maxDifferenceRatio: input.maxDifferenceRatio,
              resizeCandidateToReference: input.resizeCandidateToReference,
              label: input.label ? `${input.label}-${index + 1}` : undefined,
            });
            return { success: true, referenceImagePath, comparison };
          } catch (error) {
            return {
              success: false,
              referenceImagePath,
              error: error instanceof Error ? error.message : "Design comparison failed.",
            };
          }
        }));
        const failed = results.filter((result) => !result.success).length;
        return toTextToolResult({
          action: "design_compare_current_view_batch",
          success: failed === 0,
          sessionId: resolvedSessionId,
          state: capture.state,
          capture,
          total: results.length,
          failed,
          results,
        }, failed === results.length);
      } catch (error) {
        return toTextToolResult({
          action: "design_compare_current_view_batch",
          success: false,
          error: error instanceof Error ? error.message : "Design comparison failed.",
        }, true);
      }
    },
  );

  const compareImagesBatchTool = tool(
    "design_compare_images_batch",
    "批量比较多组本地参考图和候选图。每组可独立设置阈值、忽略区域、diffColorMode 和 maxDifferenceRatio，适合回归测试或多页面截图验收。",
    {
      comparisons: z.array(z.object({
        referenceImagePath: z.string().trim().min(1),
        candidateImagePath: z.string().trim().min(1),
        label: z.string().trim().min(1).max(80).optional(),
        threshold: z.number().min(0).max(255).optional(),
        ...comparisonTuningToolSchema,
        resizeCandidateToReference: z.boolean().optional(),
      })).min(1).max(12),
    },
    async (input) => {
      const results = await Promise.all(input.comparisons.map(async (comparisonInput, index) => {
        try {
          const comparison = compareImages({
            referenceImagePath: comparisonInput.referenceImagePath,
            candidateImagePath: comparisonInput.candidateImagePath,
            threshold: comparisonInput.threshold,
            sensitivity: comparisonInput.sensitivity,
            diffColorMode: comparisonInput.diffColorMode,
            ignoreAntialiasing: comparisonInput.ignoreAntialiasing,
            ignoreRegions: comparisonInput.ignoreRegions,
            maxDifferenceRatio: comparisonInput.maxDifferenceRatio,
            resizeCandidateToReference: comparisonInput.resizeCandidateToReference,
            label: comparisonInput.label ?? `batch-${index + 1}`,
          });
          return { success: true, index, comparison };
        } catch (error) {
          return {
            success: false,
            index,
            referenceImagePath: comparisonInput.referenceImagePath,
            candidateImagePath: comparisonInput.candidateImagePath,
            error: error instanceof Error ? error.message : "Screenshot comparison failed.",
          };
        }
      }));
      const failed = results.filter((result) => !result.success).length;
      return toTextToolResult({
        action: "design_compare_images_batch",
        success: failed === 0,
        total: results.length,
        failed,
        results,
      }, failed === results.length);
    },
  );

  const readComparisonReportTool = tool(
    "design_read_comparison_report",
    "读取 design_compare_* 生成的 JSON report，快速恢复差异比例、差异边界、topDiffRegions、verdict、advice 和关联图片产物。用于继续修 UI、复查历史比对结果或向用户汇报视觉证据。",
    {
      reportPath: z.string().trim().min(1),
      includeFullReport: z.boolean().optional(),
    },
    async (input) => {
      try {
        const reportPath = resolveDesignArtifactPath(input.reportPath, "comparison report 路径");
        const report = JSON.parse(readFileSync(reportPath, "utf8")) as unknown;
        if (!isJsonRecord(report)) {
          throw new Error("comparison report 必须是 JSON 对象。");
        }
        return toTextToolResult({
          action: "design_read_comparison_report",
          success: true,
          name: basename(reportPath),
          reportPath,
          summary: summarizeComparisonReport(report, reportPath),
          report: input.includeFullReport === true ? report : undefined,
        });
      } catch (error) {
        return toTextToolResult({
          action: "design_read_comparison_report",
          success: false,
          error: error instanceof Error ? error.message : "读取 comparison report 失败。",
        }, true);
      }
    },
  );

  const listArtifactsTool = tool(
    "design_list_artifacts",
    "列出最近的设计还原产物，包括 BrowserView current 截图、diff 图、comparison 图和 JSON report。用于 Agent 在后续轮次快速找回可复查的视觉证据。",
    {
      limit: z.number().int().min(1).max(50).optional(),
      kind: z.enum(DESIGN_ARTIFACT_KINDS).optional(),
    },
    async (input) => {
      try {
        const limit = input.limit ?? 20;
        const artifacts = listDesignArtifacts(limit, input.kind);
        return toTextToolResult({
          action: "design_list_artifacts",
          success: true,
          artifactDir: getDesignArtifactDir(),
          limit,
          kind: input.kind ?? "all",
          total: artifacts.length,
          artifacts,
        });
      } catch (error) {
        return toTextToolResult({
          action: "design_list_artifacts",
          success: false,
          error: error instanceof Error ? error.message : "列出设计还原产物失败。",
        }, true);
      }
    },
  );

  const designMcpServer = createSdkMcpServer({
    name: DESIGN_TOOLS_SERVER_NAME,
    version: DESIGN_MCP_SERVER_VERSION,
    tools: [
      captureTool,
      inspectImageTool,
      compareTool,
      compareCurrentViewBatchTool,
      compareImagesTool,
      compareImagesBatchTool,
      readComparisonReportTool,
      listArtifactsTool,
    ],
  });

  designMcpServersBySessionId.set(resolvedSessionId, designMcpServer);
  return designMcpServer;
}
