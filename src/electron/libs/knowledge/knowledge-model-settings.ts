import { loadApiConfigSettings } from "../config-store.js";
import type { EmbeddingModelSettings, KnowledgeModelSettings } from "./knowledge-types.js";
import { resolveKnowledgeModelSettingsFromProfiles } from "./knowledge-model-settings-core.js";

export { resolveKnowledgeModelSettingsFromProfiles } from "./knowledge-model-settings-core.js";

export function resolveKnowledgeModelSettings(): KnowledgeModelSettings {
  return resolveKnowledgeModelSettingsFromProfiles(loadApiConfigSettings().profiles);
}

export function assertEmbeddingConfigured(settings = resolveKnowledgeModelSettings()): EmbeddingModelSettings {
  if (!settings.embedding) {
    throw new Error("Knowledge Engine is not enabled: configure embeddingModel first.");
  }
  return settings.embedding;
}
