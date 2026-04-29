// 设计还原 MCP 工具：把“当前页面截图”和“参考设计图”变成可审阅的差异图。
// 目标是让 Agent 修 UI 时有量化依据，而不是只凭主观描述猜测。
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { app, nativeImage } from "electron";
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "fs";
import { join } from "path";
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
  "design_compare_images",
] as const;

export type DesignToolHost = {
  captureVisible: () => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  getState: () => BrowserWorkbenchState;
};

type ImageSize = {
  width: number;
  height: number;
};

type CapturedImage = {
  path: string;
  size: ImageSize;
};

const DESIGN_TOOLS_SERVER_NAME = "tech-cc-hub-design";
const DESIGN_MCP_SERVER_VERSION = "1.0.0";
const MAX_DIMENSION = 4096;
const DEFAULT_THRESHOLD = 24;
const DEFAULT_LABEL = "capture";

let designHost: DesignToolHost | null = null;
let designMcpServer: McpSdkServerConfigWithInstance | null = null;

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

function createArtifactPath(label: string | undefined, suffix: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(getDesignArtifactDir(), `${timestamp}-${sanitizeLabel(label)}-${suffix}.png`);
}

function writePngArtifact(image: Electron.NativeImage, label: string | undefined, suffix: string): string {
  const path = createArtifactPath(label, suffix);
  writeFileSync(path, image.toPNG());
  return path;
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
async function captureCurrentView(label?: string): Promise<CapturedImage & { state: BrowserWorkbenchState }> {
  const host = getHost();
  const capture = await host.captureVisible();
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
    state: host.getState(),
  };
}

function clampThreshold(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_THRESHOLD;
  }
  return Math.max(0, Math.min(255, Math.round(value ?? DEFAULT_THRESHOLD)));
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

// 轻量像素 diff：不同像素标红，相同区域保留半透明灰度，便于快速看出布局和色彩偏差。
function compareImages(input: {
  referenceImagePath: string;
  candidateImagePath: string;
  threshold?: number;
  resizeCandidateToReference?: boolean;
  label?: string;
}) {
  const threshold = clampThreshold(input.threshold);
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
  const diffBitmap = Buffer.alloc(width * height * 4);
  let differentPixels = 0;
  let totalDelta = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const outputIndex = (y * width + x) * 4;
      const referenceIndex = (y * referenceSize.width + x) * 4;
      const candidateIndex = (y * candidateSize.width + x) * 4;
      const delta0 = Math.abs(referenceBitmap[referenceIndex] - candidateBitmap[candidateIndex]);
      const delta1 = Math.abs(referenceBitmap[referenceIndex + 1] - candidateBitmap[candidateIndex + 1]);
      const delta2 = Math.abs(referenceBitmap[referenceIndex + 2] - candidateBitmap[candidateIndex + 2]);
      const delta = Math.max(delta0, delta1, delta2);
      totalDelta += delta;

      if (delta > threshold) {
        differentPixels += 1;
        diffBitmap[outputIndex] = 0;
        diffBitmap[outputIndex + 1] = 0;
        diffBitmap[outputIndex + 2] = 255;
        diffBitmap[outputIndex + 3] = 255;
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
  const diffImage = nativeImage.createFromBitmap(diffBitmap, { width, height });
  const diffPath = writePngArtifact(diffImage, input.label, "diff");
  const comparisonPath = createComparisonSheet({
    referenceBitmap,
    candidateBitmap,
    diffBitmap,
    panelSize: { width, height },
    label: input.label,
  });

  return {
    referenceImagePath,
    candidateImagePath,
    diffImagePath: diffPath,
    comparisonImagePath: comparisonPath,
    threshold,
    resizedCandidateToReference: shouldResize,
    comparedSize: { width, height },
    referenceSize,
    candidateSize: candidateOriginalSize,
    differentPixels,
    totalPixels,
    differenceRatio: totalPixels > 0 ? differentPixels / totalPixels : 0,
    averageChannelDelta: totalPixels > 0 ? totalDelta / totalPixels : 0,
  };
}

export function getDesignMcpServer(): McpSdkServerConfigWithInstance {
  if (designMcpServer) {
    return designMcpServer;
  }

  const captureTool = tool(
    "design_capture_current_view",
    "截取当前内置浏览器 BrowserView 可见区域并保存为 PNG 文件，返回文件路径和页面状态。用于设计还原、视觉 QA、和 Figma 对齐前的候选图采集。",
    {
      label: z.string().trim().min(1).max(80).optional(),
    },
    async (input, _extra) => {
      try {
        const capture = await captureCurrentView(input.label);
        return toTextToolResult({
          action: "design_capture_current_view",
          success: true,
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
    async (input, _extra) => {
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
    "将当前内置浏览器 BrowserView 截图与参考设计图进行截图比照，保存当前截图、diff 图、三栏 comparison 图，并返回差异比例。referenceImagePath 应传 Figma 导出的 PNG/JPG/WebP 文件路径。若只是读取单张参考图，请用 design_inspect_image。",
    {
      referenceImagePath: z.string().trim().min(1),
      label: z.string().trim().min(1).max(80).optional(),
      threshold: z.number().min(0).max(255).optional(),
      resizeCandidateToReference: z.boolean().optional(),
    },
    async (input, _extra) => {
      try {
        const capture = await captureCurrentView(input.label);
        const comparison = compareImages({
          referenceImagePath: input.referenceImagePath,
          candidateImagePath: capture.path,
          threshold: input.threshold,
          resizeCandidateToReference: input.resizeCandidateToReference,
          label: input.label,
        });
        return toTextToolResult({
          action: "design_compare_current_view",
          success: true,
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
    "对两张不同的本地截图做截图比照，保存 diff 图和三栏 comparison 图。适合比较 Figma 导出图、页面截图、回归截图等，不依赖当前 BrowserView。不要把同一张图同时作为 reference 和 candidate；单图理解请用 design_inspect_image。",
    {
      referenceImagePath: z.string().trim().min(1),
      candidateImagePath: z.string().trim().min(1),
      label: z.string().trim().min(1).max(80).optional(),
      threshold: z.number().min(0).max(255).optional(),
      resizeCandidateToReference: z.boolean().optional(),
    },
    async (input, _extra) => {
      try {
        const comparison = compareImages({
          referenceImagePath: input.referenceImagePath,
          candidateImagePath: input.candidateImagePath,
          threshold: input.threshold,
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

  designMcpServer = createSdkMcpServer({
    name: DESIGN_TOOLS_SERVER_NAME,
    version: DESIGN_MCP_SERVER_VERSION,
    tools: [captureTool, inspectImageTool, compareTool, compareImagesTool],
  });

  return designMcpServer;
}
