export const IMAGE_GENERATION_PLUGIN_TOKEN = "[[image_generation]]";

export type ImageGenerationConfig = {
  aspectRatio: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9";
  resolution: "2K" | "4K";
  width: number;
  height: number;
  count: number;
};

export const DEFAULT_IMAGE_GENERATION_CONFIG: ImageGenerationConfig = {
  aspectRatio: "16:9",
  resolution: "2K",
  width: 2848,
  height: 1600,
  count: 1,
};

export function hasImageGenerationPlugin(prompt: string): boolean {
  return prompt.includes(IMAGE_GENERATION_PLUGIN_TOKEN);
}

export function getImageGenerationDisplayPrompt(prompt: string): string {
  return prompt.replaceAll(IMAGE_GENERATION_PLUGIN_TOKEN, "").trim();
}

export function mergePromptWithImageGenerationConfig(
  prompt: string,
  config: ImageGenerationConfig,
): string {
  if (!hasImageGenerationPlugin(prompt)) return prompt;

  const payload = {
    type: "image_generation",
    version: 1,
    enabled: true,
    parameters: config,
  };

  return [
    getImageGenerationDisplayPrompt(prompt),
    "<image_generation>",
    "This message enables image generation. Use these parameters whenever generating images for this request.",
    JSON.stringify(payload, null, 2),
    "</image_generation>",
  ].filter(Boolean).join("\n\n");
}

function isImageGenerationConfig(value: unknown): value is ImageGenerationConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  return ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"].includes(String(config.aspectRatio))
    && (config.resolution === "2K" || config.resolution === "4K")
    && Number.isInteger(config.width) && Number(config.width) > 0
    && Number.isInteger(config.height) && Number(config.height) > 0
    && Number.isInteger(config.count) && Number(config.count) >= 1 && Number(config.count) <= 4;
}

export function restoreImageGenerationPluginFromPrompt(
  prompt: string,
): { prompt: string; config: ImageGenerationConfig } | null {
  const block = /<image_generation>[\s\S]*?(\{\s*"type"\s*:\s*"image_generation"[\s\S]*\})\s*<\/image_generation>/u.exec(prompt);
  if (!block?.[0] || !block[1]) return null;

  try {
    const payload = JSON.parse(block[1]) as { parameters?: unknown };
    if (!isImageGenerationConfig(payload.parameters)) return null;
    const editablePrompt = prompt.replace(block[0], "").trim();
    return {
      prompt: editablePrompt
        ? `${editablePrompt} ${IMAGE_GENERATION_PLUGIN_TOKEN}`
        : IMAGE_GENERATION_PLUGIN_TOKEN,
      config: payload.parameters,
    };
  } catch {
    return null;
  }
}

export function getImageGenerationDisplayPromptFromSerialized(prompt: string): string {
  const legacyTitleMarker = prompt.indexOf("<image_ge");
  if (legacyTitleMarker >= 0) return prompt.slice(0, legacyTitleMarker).trim();
  const restored = restoreImageGenerationPluginFromPrompt(prompt);
  return restored ? getImageGenerationDisplayPrompt(restored.prompt) : prompt;
}
