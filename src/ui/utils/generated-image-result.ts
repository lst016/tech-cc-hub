// 生图工具结果解析器：从 image_generate 的 JSON 结果中提取结构化字段。
// 详见 .omx/plans/2026-07-10-image-generation-integration.md §9.2。
// 解析必须失败安全：普通文本、截断 JSON、错误响应继续走原有 Tool Result 渲染。

export type GeneratedImageArtifactLite = {
  path: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  revisedPrompt?: string;
};

export type GeneratedImageResult =
  | {
      isImageGeneration: true;
      success: true;
      mode: "generate" | "edit";
      model?: string;
      profileName?: string;
      artifacts: GeneratedImageArtifactLite[];
      outputHint?: string;
    }
  | {
      isImageGeneration: true;
      success: false;
      code?: string;
      message?: string;
    }
  | {
      isImageGeneration: false;
    };

const IMAGE_GENERATION_ACTION = "image_generate";

/**
 * 从 tool_result 文本内容解析生图结果。
 * 工具结果只返回 JSON 文本（含 action: "image_generate"），不返回 base64。
 * 任何解析异常都返回 isImageGeneration: false，由调用方走原渲染。
 */
export function parseGeneratedImageResult(rawText: string | undefined | null): GeneratedImageResult {
  const trimmed = rawText?.trim();
  if (!trimmed) {
    return { isImageGeneration: false };
  }

  // 容错：tool_result 可能在外层包了 <tool_use_error> 或其它标签，尝试抽取首个 JSON 对象
  const jsonCandidate = extractFirstJsonObject(trimmed) ?? trimmed;
  let payload: unknown;
  try {
    payload = JSON.parse(jsonCandidate);
  } catch {
    return { isImageGeneration: false };
  }

  if (!payload || typeof payload !== "object") {
    return { isImageGeneration: false };
  }

  const record = payload as Record<string, unknown>;
  if (record.action !== IMAGE_GENERATION_ACTION) {
    return { isImageGeneration: false };
  }

  if (record.success !== true) {
    return {
      isImageGeneration: true,
      success: false,
      code: typeof record.code === "string" ? record.code : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
    };
  }

  const mode = record.mode === "edit" ? "edit" : "generate";
  const artifacts = extractArtifacts(record.artifacts);
  if (artifacts.length === 0) {
    return { isImageGeneration: false };
  }

  return {
    isImageGeneration: true,
    success: true,
    mode,
    model: typeof record.model === "string" ? record.model : undefined,
    profileName: typeof record.profileName === "string" ? record.profileName : undefined,
    artifacts,
    outputHint: typeof record.outputHint === "string" ? record.outputHint : undefined,
  };
}

function extractArtifacts(raw: unknown): GeneratedImageArtifactLite[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const artifacts: GeneratedImageArtifactLite[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const path = typeof record.path === "string" ? record.path.trim() : "";
    if (!path) continue;

    artifacts.push({
      path,
      mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined,
      sizeBytes: typeof record.sizeBytes === "number" ? record.sizeBytes : undefined,
      width: typeof record.width === "number" ? record.width : undefined,
      height: typeof record.height === "number" ? record.height : undefined,
      revisedPrompt: typeof record.revisedPrompt === "string" ? record.revisedPrompt : undefined,
    });
  }

  return artifacts;
}

/**
 * 从可能含前后噪声的文本中抽出第一个平衡的 JSON 对象。
 * 不引入第三方依赖，只做最小化的花括号配平。
 */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * 构造“继续编辑”输入框引用：至少包含生成图片绝对路径，供 Agent 再次传给 image_generate.referenceImagePaths。
 */
export function buildContinueEditingReference(artifacts: GeneratedImageArtifactLite[]): string {
  if (artifacts.length === 0) return "";
  const paths = artifacts.map((artifact) => artifact.path);
  return `基于以下生成图片继续编辑：\n${paths.map((path) => `- ${path}`).join("\n")}\n请在此基础上修改：`;
}
