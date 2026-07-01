import type { SdkBeta } from "@anthropic-ai/claude-agent-sdk";

const ONE_MILLION_CONTEXT_BETA: SdkBeta = "context-1m-2025-08-07";

function normalizeModelId(model: string | undefined): string {
  return (model ?? "").trim().toLowerCase();
}

function isClaudeSonnet4Family(model: string): boolean {
  return /(?:^|[.:/@-])claude[-_]?sonnet[-_]?4(?:\b|[-_./:@])/.test(model) ||
    /(?:^|[.:/@-])sonnet[-_]?4(?:\b|[-_./:@])/.test(model);
}

export function buildBetasForModel(model: string | undefined): SdkBeta[] {
  const normalizedModel = normalizeModelId(model);
  if (!normalizedModel) return [];

  const betas = new Set<SdkBeta>();
  if (isClaudeSonnet4Family(normalizedModel)) {
    betas.add(ONE_MILLION_CONTEXT_BETA);
  }

  return [...betas];
}
