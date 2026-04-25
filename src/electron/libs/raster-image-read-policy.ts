import { basename, extname } from "path";

const RASTER_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);

export function isRasterImagePath(filePath: string): boolean {
  return RASTER_IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export function shouldBlockRawRasterImageRead(filePath: string): boolean {
  return isRasterImagePath(filePath);
}

export function buildRasterImageReadBlockedMessage(options: {
  filePath: string;
  imageModel?: string;
}): string {
  const imageName = basename(options.filePath) || options.filePath;
  const imageModel = options.imageModel?.trim();
  return [
    `图片文件不能通过 Read 直接读取：${imageName}`,
    "直接 Read 会把原始图片/base64 放进 Claude Code 上下文，容易触发模型窗口溢出。",
    imageModel
      ? `当前已配置图片预处理模型 ${imageModel}；系统会优先注入图片摘要，请基于摘要继续。`
      : "请改用用户上传附件、图片摘要、截图比对工具，或让用户指定最关键的一张图。",
  ].join("\n");
}

export function buildRasterImageReadSummaryContext(options: {
  filePath: string;
  imageModel?: string;
  summary: string;
}): string {
  return [
    buildRasterImageReadBlockedMessage({
      filePath: options.filePath,
      imageModel: options.imageModel,
    }),
    "",
    "已阻止直接 Read 图片原文，并改为注入以下图片摘要：",
    options.summary.trim(),
  ].join("\n");
}

export async function buildRasterImageReadPreToolUseDecision(options: {
  filePath: string;
  imageModel?: string;
  shouldSummarize: boolean;
  summarizeLocalImageFile: () => Promise<string | null>;
  createDevContextFromSummary?: (summary: string) => Promise<string | null>;
  didMutate?: boolean;
  normalizedInput?: Record<string, unknown>;
}): Promise<{
  continue: true;
  hookSpecificOutput: {
    hookEventName: "PreToolUse";
    permissionDecision: "deny";
    permissionDecisionReason: string;
    additionalContext: string;
    updatedInput?: Record<string, unknown>;
  };
}> {
  const blockedMessage = buildRasterImageReadBlockedMessage({
    filePath: options.filePath,
    imageModel: options.imageModel,
  });
  let additionalContext = blockedMessage;

  if (options.shouldSummarize) {
    try {
      const summary = await options.summarizeLocalImageFile();
      if (summary) {
        const devContext = await options.createDevContextFromSummary?.(summary);
        additionalContext = devContext?.trim() || buildRasterImageReadSummaryContext({
          filePath: options.filePath,
          imageModel: options.imageModel,
          summary,
        });
      } else {
        additionalContext = blockedMessage;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      additionalContext = `${blockedMessage}\n\nImage summary failed: ${message}`;
    }
  }

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: blockedMessage,
      additionalContext,
      ...(options.didMutate ? { updatedInput: options.normalizedInput } : {}),
    },
  };
}
