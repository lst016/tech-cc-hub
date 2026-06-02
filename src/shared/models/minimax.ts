export const MINIMAX_OPENAI_BASE_URL = "https://api.minimax.io/v1";
export const MINIMAX_ANTHROPIC_BASE_URL = "https://api.minimax.io/anthropic";
export const MINIMAX_DEFAULT_MODEL = "MiniMax-M3";
export const MINIMAX_SMALL_MODEL = "MiniMax-M2.7-highspeed";
export const MINIMAX_M3_CONTEXT_WINDOW = 1_000_000;
export const MINIMAX_M2_CONTEXT_WINDOW = 204_800;

export const MINIMAX_MODEL_CONFIGS = [
  { name: "MiniMax-M3", contextWindow: MINIMAX_M3_CONTEXT_WINDOW },
  { name: "MiniMax-M2.7", contextWindow: MINIMAX_M2_CONTEXT_WINDOW },
  { name: "MiniMax-M2.7-highspeed", contextWindow: MINIMAX_M2_CONTEXT_WINDOW },
  { name: "MiniMax-M2.5", contextWindow: MINIMAX_M2_CONTEXT_WINDOW },
  { name: "MiniMax-M2.5-highspeed", contextWindow: MINIMAX_M2_CONTEXT_WINDOW },
  { name: "MiniMax-M2.1", contextWindow: MINIMAX_M2_CONTEXT_WINDOW },
  { name: "MiniMax-M2.1-highspeed", contextWindow: MINIMAX_M2_CONTEXT_WINDOW },
  { name: "MiniMax-M2", contextWindow: MINIMAX_M2_CONTEXT_WINDOW },
] as const;

export const MINIMAX_MODELS = MINIMAX_MODEL_CONFIGS.map((model) => model.name);
