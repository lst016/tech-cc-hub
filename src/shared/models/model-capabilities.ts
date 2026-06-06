export function isLikelyImageUnderstandingModel(modelName: string | undefined | null): boolean {
  const normalized = modelName?.trim();
  if (!normalized) {
    return false;
  }

  return /(^|[-_.])(vl|vision|visual|ocr|omni)([-_.]|$)|qwen.*vl|glm.*v|gpt-4o|gpt-4\.1|gpt-5(?:\.|$|[-_])|gemini|grok-2-vision|grok.*vision|claude.*(?:sonnet|opus).*4/i.test(normalized)
    && !/image-?0?1|speech|music|embedding|coder/i.test(normalized);
}

export function canMainModelReadImages(modelName: string | undefined | null): boolean {
  return isLikelyImageUnderstandingModel(modelName);
}
