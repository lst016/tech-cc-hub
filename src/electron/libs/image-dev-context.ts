import { mkdir, writeFile } from "fs/promises";
import { basename, join } from "path";

import type { PromptAttachment } from "../types.js";

export type ImageDevContextRole = "ui_mock" | "screenshot" | "error_capture" | "mixed" | "unknown";

export type ImageDevContextRegion = {
  name: string;
  description: string;
  elements: string[];
};

export type ImageDevContextComponent = {
  type: string;
  label?: string;
  text?: string;
  locationHint?: string;
  importance?: "high" | "medium" | "low";
};

export type ImageDevContextText = {
  value: string;
  kind: string;
};

export type ImageDevContextSpecFragment = {
  role?: ImageDevContextRole;
  summary: string;
  layout?: {
    pageType?: string;
    regions?: ImageDevContextRegion[];
  };
  components?: ImageDevContextComponent[];
  texts?: ImageDevContextText[];
  visualConstraints?: {
    styleHints?: string[];
    issues?: string[];
  };
  devHints?: {
    probableTargets?: string[];
    suggestedFocus?: string[];
  };
  confidence?: number;
};

export type ImageDevContextAnalysis = {
  markdown: string;
  spec: ImageDevContextSpecFragment;
};

export type ImageDevContextImageArtifact = {
  imageId: string;
  fileName: string;
  summaryPath: string;
  specPath: string;
  sourceMetaPath: string;
  sourceStoragePath?: string;
};

export type ImageDevContextArtifactResult = {
  rootPath: string;
  manifestPath: string;
  groupSummaryPath: string;
  groupSpecPath: string;
  imageCount: number;
  images: ImageDevContextImageArtifact[];
  fallbackUsed: boolean;
};

export type ImageDevContextArtifactOptions = {
  rootDir: string;
  sessionId: string;
  batchId: string;
  prompt: string;
  taskKind: string;
  attachments: PromptAttachment[];
  fallbackUsed?: boolean;
  analyzeImage: (input: {
    attachment: PromptAttachment;
    index: number;
    prompt: string;
    taskKind: string;
  }) => Promise<ImageDevContextAnalysis>;
};

const DEVELOPMENT_TASK_KINDS = new Set(["development", "code", "frontend", "visual", "electron"]);

export function shouldCreateImageDevContext(options: {
  taskKind: string;
  attachments?: PromptAttachment[];
}): boolean {
  return DEVELOPMENT_TASK_KINDS.has(options.taskKind) && Boolean(options.attachments?.some((attachment) => attachment.kind === "image"));
}

export function buildImageDevContextAnalysisFromSummary(options: {
  attachment: PromptAttachment;
  prompt: string;
  taskKind: string;
  summaryText?: string | null;
}): ImageDevContextAnalysis {
  const normalizedSummary = options.summaryText?.trim() || [
    `No image model summary was available for ${options.attachment.name || options.attachment.id}.`,
    "Use the source image metadata and user prompt as low-confidence context.",
  ].join(" ");
  const probableTargets = inferProbableTargets(normalizedSummary);
  const suggestedFocus = inferSuggestedFocus(normalizedSummary, options.taskKind);

  return {
    markdown: [
      `# ${options.attachment.name || "Image"}`,
      "",
      "## Task Context",
      "",
      `Prompt: ${options.prompt}`,
      `Task kind: ${options.taskKind}`,
      "",
      "## Extracted Image Notes",
      "",
      normalizedSummary,
      "",
      "## Development Hints",
      "",
      `Probable targets: ${probableTargets.length > 0 ? probableTargets.join(", ") : "unknown"}`,
      `Suggested focus: ${suggestedFocus.join(", ")}`,
    ].join("\n"),
    spec: {
      role: inferImageRole(normalizedSummary, options.taskKind),
      summary: normalizedSummary,
      layout: {
        pageType: inferPageType(normalizedSummary),
        regions: [],
      },
      components: [],
      texts: extractQuotedTexts(normalizedSummary).map((value) => ({
        value,
        kind: "visible_text",
      })),
      visualConstraints: {
        styleHints: inferStyleHints(normalizedSummary),
        issues: inferIssues(normalizedSummary),
      },
      devHints: {
        probableTargets,
        suggestedFocus,
      },
      confidence: options.summaryText?.trim() ? 0.72 : 0.35,
    },
  };
}

export async function createImageDevContextArtifacts(
  options: ImageDevContextArtifactOptions,
): Promise<ImageDevContextArtifactResult> {
  const imageAttachments = options.attachments.filter((attachment) => attachment.kind === "image");
  const sessionId = sanitizePathSegment(options.sessionId || "session");
  const batchId = sanitizePathSegment(options.batchId || `batch-${Date.now()}`);
  const rootPath = join(options.rootDir, "session-artifacts", sessionId, "image-dev-context", batchId);
  const imagesRoot = join(rootPath, "images");
  await mkdir(imagesRoot, { recursive: true });

  const imageArtifacts: ImageDevContextImageArtifact[] = [];
  const groupSpecImages: Array<{
    imageId: string;
    fileName: string;
    role: ImageDevContextRole;
    summary: string;
    confidence: number;
  }> = [];

  for (const [index, attachment] of imageAttachments.entries()) {
    const imageId = sanitizePathSegment(attachment.id || `img_${String(index + 1).padStart(3, "0")}`);
    const imageDir = join(imagesRoot, imageId);
    await mkdir(imageDir, { recursive: true });

    const analysis = await options.analyzeImage({
      attachment,
      index,
      prompt: options.prompt,
      taskKind: options.taskKind,
    });

    const spec = buildImageSpec({
      attachment,
      imageId,
      prompt: options.prompt,
      taskKind: options.taskKind,
      fragment: analysis.spec,
    });

    const summaryPath = join(imageDir, "summary.md");
    const specPath = join(imageDir, "spec.json");
    const sourceMetaPath = join(imageDir, "source-meta.json");

    await writeFile(summaryPath, buildImageSummaryMarkdown(attachment, analysis.markdown), "utf8");
    await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
    await writeFile(sourceMetaPath, `${JSON.stringify(buildSourceMeta(attachment), null, 2)}\n`, "utf8");

    imageArtifacts.push({
      imageId,
      fileName: attachment.name || basename(attachment.storagePath || attachment.storageUri || imageId),
      summaryPath,
      specPath,
      sourceMetaPath,
      sourceStoragePath: attachment.storagePath,
    });
    groupSpecImages.push({
      imageId,
      fileName: attachment.name || imageId,
      role: spec.role,
      summary: spec.summary,
      confidence: spec.confidence,
    });
  }

  const groupSummaryPath = join(rootPath, "group-summary.md");
  const groupSpecPath = join(rootPath, "group-spec.json");
  const manifestPath = join(rootPath, "manifest.json");
  const createdAt = new Date().toISOString();

  await writeFile(groupSummaryPath, buildGroupSummaryMarkdown({
    prompt: options.prompt,
    taskKind: options.taskKind,
    images: groupSpecImages,
  }), "utf8");
  await writeFile(groupSpecPath, `${JSON.stringify(buildGroupSpec({
    batchId,
    images: groupSpecImages,
  }), null, 2)}\n`, "utf8");
  await writeFile(manifestPath, `${JSON.stringify({
    version: 1,
    sessionId: options.sessionId,
    batchId: options.batchId,
    createdAt,
    triggerReason: "development_with_images",
    imageCount: imageArtifacts.length,
    groupSummaryPath,
    groupSpecPath,
    images: imageArtifacts,
    fallbackUsed: Boolean(options.fallbackUsed),
  }, null, 2)}\n`, "utf8");

  return {
    rootPath,
    manifestPath,
    groupSummaryPath,
    groupSpecPath,
    imageCount: imageArtifacts.length,
    images: imageArtifacts,
    fallbackUsed: Boolean(options.fallbackUsed),
  };
}

export function buildImageDevContextPromptNote(result: ImageDevContextArtifactResult): string {
  return [
    "## Image Dev Context",
    "",
    `${result.imageCount} image(s) were converted into session-scoped development documents before this run.`,
    "Use these generated documents as the primary image context. Do not request raw image payloads by default unless the task explicitly requires visual comparison, UI reconstruction, or pixel-level review.",
    "",
    `Manifest: ${result.manifestPath}`,
    `Group summary: ${result.groupSummaryPath}`,
    `Group spec: ${result.groupSpecPath}`,
    "",
    "Per-image documents:",
    ...result.images.map((image) => [
      `- ${image.fileName} (${image.imageId})`,
      `  summary: ${image.summaryPath}`,
      `  spec: ${image.specPath}`,
    ].join("\n")),
    "",
  ].join("\n");
}

function buildImageSpec(options: {
  attachment: PromptAttachment;
  imageId: string;
  prompt: string;
  taskKind: string;
  fragment: ImageDevContextSpecFragment;
}) {
  const { attachment, imageId, prompt, taskKind, fragment } = options;
  return {
    version: 1,
    imageId,
    role: fragment.role ?? "unknown",
    source: {
      fileName: attachment.name || imageId,
      storagePath: attachment.storagePath ?? attachment.storageUri ?? attachment.data,
      mimeType: attachment.mimeType,
    },
    taskContext: {
      prompt,
      intent: taskKind,
    },
    summary: fragment.summary,
    layout: {
      pageType: fragment.layout?.pageType ?? "unknown",
      regions: fragment.layout?.regions ?? [],
    },
    components: fragment.components ?? [],
    texts: fragment.texts ?? [],
    visualConstraints: {
      styleHints: fragment.visualConstraints?.styleHints ?? [],
      issues: fragment.visualConstraints?.issues ?? [],
    },
    devHints: {
      probableTargets: fragment.devHints?.probableTargets ?? [],
      suggestedFocus: fragment.devHints?.suggestedFocus ?? [],
    },
    confidence: normalizeConfidence(fragment.confidence),
  };
}

function buildImageSummaryMarkdown(attachment: PromptAttachment, markdown: string): string {
  return [
    `# ${attachment.name || "Image"}`,
    "",
    markdown.trim(),
    "",
  ].join("\n");
}

function buildSourceMeta(attachment: PromptAttachment) {
  return {
    version: 1,
    imageId: attachment.id,
    fileName: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    storagePath: attachment.storagePath,
    storageUri: attachment.storageUri,
  };
}

function buildGroupSummaryMarkdown(options: {
  prompt: string;
  taskKind: string;
  images: Array<{ imageId: string; fileName: string; summary: string; confidence: number }>;
}): string {
  return [
    "# Image Development Context",
    "",
    `User prompt: ${options.prompt}`,
    `Task kind: ${options.taskKind}`,
    `Image count: ${options.images.length}`,
    "",
    "## Images",
    "",
    ...options.images.map((image, index) => [
      `### ${index + 1}. ${image.fileName}`,
      "",
      `Image ID: ${image.imageId}`,
      `Confidence: ${image.confidence}`,
      "",
      image.summary,
      "",
    ].join("\n")),
  ].join("\n");
}

function buildGroupSpec(options: {
  batchId: string;
  images: Array<{
    imageId: string;
    fileName: string;
    role: ImageDevContextRole;
    summary: string;
    confidence: number;
  }>;
}) {
  return {
    version: 1,
    batchId: options.batchId,
    imageIds: options.images.map((image) => image.imageId),
    groupRole: inferGroupRole(options.images.map((image) => image.role)),
    overallSummary: options.images.map((image) => `${image.fileName}: ${image.summary}`).join("\n"),
    relationships: [],
    sharedComponents: [],
    developmentFocus: ["layout", "visible text", "interaction state"],
    recommendedInputsForAgent: ["group-summary.md", "group-spec.json"],
    confidence: averageConfidence(options.images.map((image) => image.confidence)),
  };
}

function inferGroupRole(roles: ImageDevContextRole[]): "ui_flow" | "mixed" | "unknown" {
  if (roles.length === 0) {
    return "unknown";
  }

  if (roles.every((role) => role === "ui_mock" || role === "screenshot")) {
    return "ui_flow";
  }

  return "mixed";
}

function normalizeConfidence(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, value));
}

function averageConfidence(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const average = values.reduce((sum, value) => sum + normalizeConfidence(value), 0) / values.length;
  return Number(average.toFixed(2));
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function inferImageRole(summary: string, taskKind: string): ImageDevContextRole {
  const text = `${summary}\n${taskKind}`.toLowerCase();
  if (/error|exception|failed|timeout|报错|错误|失败/.test(text)) {
    return "error_capture";
  }
  if (/ui|layout|panel|button|form|table|页面|布局|按钮|面板|截图|视觉/.test(text)) {
    return "ui_mock";
  }
  if (/screenshot|截图/.test(text)) {
    return "screenshot";
  }
  return "unknown";
}

function inferPageType(summary: string): string {
  const text = summary.toLowerCase();
  if (/modal|dialog|弹窗/.test(text)) return "dialog";
  if (/table|列表|表格/.test(text)) return "table";
  if (/form|input|表单|输入/.test(text)) return "form";
  if (/dashboard|rail|panel|面板|仪表/.test(text)) return "dashboard";
  return "unknown";
}

function inferProbableTargets(summary: string): string[] {
  const targets = new Set<string>();
  const knownTargets = [
    "ActivityRail",
    "PromptLedger",
    "PromptInput",
    "Sidebar",
    "SettingsModal",
    "EventCard",
  ];

  for (const target of knownTargets) {
    if (summary.includes(target)) {
      targets.add(target);
    }
  }

  return Array.from(targets);
}

function inferSuggestedFocus(summary: string, taskKind: string): string[] {
  const text = `${summary}\n${taskKind}`.toLowerCase();
  const focus = new Set<string>();

  if (/layout|布局|遮挡|occlud|align|对齐/.test(text)) focus.add("layout");
  if (/overflow|scroll|滚动|溢出/.test(text)) focus.add("overflow");
  if (/color|颜色|style|样式/.test(text)) focus.add("style");
  if (/ui|visual|视觉|截图|figma/.test(text)) focus.add("visual fidelity");
  if (focus.size === 0) focus.add("implementation");

  return Array.from(focus);
}

function inferStyleHints(summary: string): string[] {
  const text = summary.toLowerCase();
  const hints = new Set<string>();
  if (/dense|紧凑|高密度/.test(text)) hints.add("dense");
  if (/sidebar|rail|侧边|右侧/.test(text)) hints.add("sidebar-layout");
  if (/table|表格/.test(text)) hints.add("table-heavy");
  return Array.from(hints);
}

function inferIssues(summary: string): string[] {
  const issues: string[] = [];
  if (/遮挡|occlud|blocked|挡住/.test(summary)) {
    issues.push("content is occluded");
  }
  if (/overflow|溢出/.test(summary)) {
    issues.push("overflow behavior needs review");
  }
  return issues;
}

function extractQuotedTexts(summary: string): string[] {
  const texts = new Set<string>();
  for (const match of summary.matchAll(/[“"']([^“"']{2,40})[”"']/g)) {
    const value = match[1]?.trim();
    if (value) {
      texts.add(value);
    }
  }
  return Array.from(texts).slice(0, 20);
}
