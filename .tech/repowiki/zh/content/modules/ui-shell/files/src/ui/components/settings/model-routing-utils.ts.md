# src/ui/components/settings/model-routing-utils.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：104

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildSharedModelRoutingState@24`
- `applySharedModelRoutingPatch@46`
- `pickAvailableModel@71`
- `mergeModelConfigs@76`
- `DEFAULT_CONTEXT_WINDOW@6`
- `enabledCount@26`
- `routedProfiles@27`
- `availableModels@28`
- `primaryProfile@29`
- `mainModel@30`
- `state@48`
- `routedIds@49`
- `routedProfiles@50`
- `mergedModels@51`
- `hasImageModelPatch@52`
- `hasEmbeddingModelPatch@53`
- `hasWikiModelPatch@54`
- `normalized@73`
- `byName@78`
- `name@82`
- `previous@86`
- `model@96`
- `ModelSlotPatch@8`
- `SharedModelRoutingState@10`

## 依赖输入

- `../../types.js`
- `./settings-utils.js`

## 对外暴露

- `ModelSlotPatch`
- `SharedModelRoutingState`
- `buildSharedModelRoutingState`
- `applySharedModelRoutingPatch`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { ApiConfigProfile, ApiModelConfigProfile } from "../../types.js";
import {
  getAvailableModelsForProfiles,
  getEnabledProfiles,
} from "./settings-utils.js";

const DEFAULT_CONTEXT_WINDOW = 200_000;

export type ModelSlotPatch = Partial<Pick<ApiConfigProfile, "model" | "expertModel" | "smallModel" | "analysisModel" | "imageModel" | "embeddingModel" | "wikiModel">>;

export type SharedModelRoutingState = {
  routedProfileIds: string[];
  routedProfileNames: string[];
  enabledCount: number;
  availableModels: string[];
  mainModel: string;
  expertModel: string;
  smallModel: string;
  analysisModel: string;
  imageModel: string;
  embeddingModel: string;
  wikiModel: string;
};

export function buildSharedModelRoutingState(profiles: ApiConfigProfile[]): SharedModelRoutingState {
  const enabledCount = profiles.filter((profile) => profile.enabled).length;
  const routedProfiles = getEnabledProfiles(profiles);
  const availableModels = getAvailableModelsForProfiles(routedProfiles);
  const primaryProfile = routedProfiles[0];
  const mainModel = pickAvailableModel(primaryProfile?.model, availableModels) || availableModels[0] || "";

  return {
    routedProfileIds: routedProfiles.map((profile) => profile.id),
    routedProfileNames: routedProfiles.map((profile) => profile.name || "未命名配置"),
    enabledCount,
    availableModels,
    mainModel,
    expertModel: pickAvailableModel(primaryProfile?.expertModel, availableModels) || mainModel,
    smallModel: pickAvailableModel(primaryProfile?.smallModel, availableModels) || mainModel,
    analysisModel: pickAvailableModel(primaryProfile?.analysisModel, availableModels) || mainModel,
    imageModel: pickAvailableModel(primaryProfile?.imageModel, availableModels),
    embeddingModel: pickAvailableModel(primaryProfile?.embeddingModel, availableModels),
    wikiModel: pickAvailableModel(primaryProfile?.wikiModel, availableModels),
  };
}

export function applySharedModelRoutingPatch(profiles: ApiConfigProfile[], patch: ModelSlotPatch): ApiConfigProfile[] {
  const state = buildSharedModelRoutingState(profiles);
  const routedIds = new Set(state.routedProfileIds);
  const routedProfiles = profiles.filter((profile) => routedIds.has(profile.id));
  const mergedModels = mergeModelConfigs(routedProfiles, state.availableModels);
  const hasImageModelPatch = Object.prototype.hasOwnProperty.call(patch, "imageModel");
  const hasEmbeddingModelPatch = Object.prototype.hasOwnProperty.call(patch, "embeddingModel");
  const hasWikiModelPatch = Object.prototype.hasOwnProperty.call(patch, "wikiModel");

  return profiles.map((profile) => {
    if (!routedIds.has(profile.id)) {
      return profile;
    }

    return {
      ...profile,
      ...patch,
      imageModel: hasImageModelPatch ? patch.imageModel || undefined : profile.imageModel,
      embeddingModel: hasEmbeddingModelPatch ? patch.embeddingModel || undefined : profile.embeddingModel,
      wikiModel: hasWikiModelPatch ? patch.wikiModel || undefined : profile.wikiModel,
      models: mergedModels,
    };
  });
}

function pickAvailableModel(model: string | undefined, availableModels: string[]): string {
  const normalized = model?.trim();
  return normalized && availableModels.includes(normalized) ? normalized : "";
}

function mergeModelConfigs(profiles: ApiConfigProfile[], availableModels: string[]): ApiModelConfigProfile[] {
  const byName = new Map<string, ApiModelConfigProfile>();

  for (const profile of profiles) {
    for (const model of profile.models ?? []) {
      const name = model.name.trim();
      if (!name) {
        continue;
      }
      const previous = byName.get(name);
      byName.set(name, {
        name,
        contextWindow: model.contextWindow ?? previous?.contextWindow,
        compressionThresholdPercent: model.compressionThresholdPercent ?? previous?.compressionThresholdPercent,
      });
    }
  }

  return availableModels.map((name) => {
    const model = byName.get(name);
    return {
      name,
      contextWindow: model?.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
      compressionThresholdPercent: model?.compressionThresholdPercent ?? 70,
    };
  });
}

```
