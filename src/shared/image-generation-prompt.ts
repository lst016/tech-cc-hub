type ImageGenerationPromptParameters = {
  width: number;
  height: number;
  count: number;
};

const IMAGE_GENERATION_TOOL_NAME = "image_generate";

function isImageGenerationToolName(toolName: string): boolean {
  return (
    toolName === IMAGE_GENERATION_TOOL_NAME
    || toolName.endsWith(`__${IMAGE_GENERATION_TOOL_NAME}`)
    || toolName.endsWith(`:${IMAGE_GENERATION_TOOL_NAME}`)
    || toolName.endsWith(`/${IMAGE_GENERATION_TOOL_NAME}`)
  );
}

function parseImageGenerationPromptParameters(prompt: string): ImageGenerationPromptParameters | null {
  const match = /<image_generation>\s*[\s\S]*?\{\s*[\s\S]*?"parameters"\s*:\s*(\{[\s\S]*?\})\s*\}\s*\s*<\/image_generation>/u.exec(prompt);
  if (!match?.[1]) return null;

  try {
    const parameters = JSON.parse(match[1]) as Record<string, unknown>;
    const width = typeof parameters.width === "number" ? parameters.width : NaN;
    const height = typeof parameters.height === "number" ? parameters.height : NaN;
    const count = typeof parameters.count === "number" ? parameters.count : NaN;
    if (!Number.isInteger(width) || !Number.isInteger(height) || !Number.isInteger(count)) return null;
    if (width <= 0 || height <= 0 || count < 1 || count > 4) return null;
    return { width, height, count };
  } catch {
    return null;
  }
}

export function resolveImageGenerationToolDefaults(
  toolName: string,
  input: Record<string, unknown>,
  prompt: string,
): Record<string, unknown> | null {
  if (!isImageGenerationToolName(toolName)) return null;
  const parameters = parseImageGenerationPromptParameters(prompt);
  if (!parameters) return null;

  const defaults: Record<string, unknown> = {};
  if (typeof input.size !== "string" || !input.size.trim()) {
    defaults.size = `${parameters.width}x${parameters.height}`;
  }
  if (!Number.isInteger(input.count)) {
    defaults.count = parameters.count;
  }
  return Object.keys(defaults).length > 0 ? { ...defaults, ...input } : null;
}
