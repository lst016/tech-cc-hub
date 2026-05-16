# test/electron/model-context-settings.test.ts

> 模块：`test` · 语言：`typescript` · 行数：296

## 文件职责

验证模型上下文压缩字段在各配置源中的存在性，包括API profiles设置、UI类型定义、配置存储、Claude设置、设置模态框等，并测试模型搜索评分和分组选项构建

## 关键符号

- `getModelSearchScore@0 - 计算模型搜索关键词匹配得分`
- `buildGroupedModelOptions@0 - 将模型列表按分组构建为选项数组`
- `normalizeProfile@0 - 规范化API profile配置`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `node:fs`
- `../../src/ui/components/settings/settings-utils.js`
- `../../src/ui/components/settings/model-routing-utils.js`
- `../../src/ui/components/ModelSelect.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createDeepSeekOfficialProfile,
  getAvailableModelsForProfiles,
  getEnabledProfiles,
  normalizeProfile,
} from "../../src/ui/components/settings/settings-utils.js";
import {
  applySharedModelRoutingPatch,
  buildSharedModelRoutingState,
} from "../../src/ui/components/settings/model-routing-utils.js";
import {
  buildGroupedModelOptions,
  getModelSearchScore,
} from "../../src/ui/components/ModelSelect.js";

const MODEL_SEARCH_FIXTURE = [
  "gpt-5.4",
  "gpt-5.5",
  "gpt-5.3-codex-spark",
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "GLM-5.1-FP8",
];

function getModelSearchValues(query: string): string[] {
  return buildGroupedModelOptions(MODEL_SEARCH_FIXTURE, query).flatMap((group) =>
    group.options.map((option) => option.value),
  );
}

test("settings modal and shared types expose per-model context compression fields", () => {
  const apiProfilesSettingsSource = readFileSync("src/ui/components/settings/ApiProfilesSettingsPage.tsx", "utf8");
  const uiTypesSource = readFileSync("src/ui/types.ts", "utf8");
  const configStoreSource = readFileSync("src/electron/libs/config-store.ts", "utf8");
  const claudeSettingsSource = readFileSync("src/electron/libs/claude-settings.ts", "utf8");
  const settingsModalSource = readFileSync("src/ui/components/SettingsModal.tsx", "utf8");
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const preloadSource = readFileSync("src/electron/preload.cts", "utf8");
  const devShimSource = readFileSync("src/ui/dev-electron-shim.ts", "utf8");
  const globalTypesSource = readFileSync("types.d.ts", "utf8");

  assert.match(apiProfilesSettingsSource, /contextWindow/);
  assert.match(apiProfilesSettingsSource, /compressionThresholdPercent/);
  assert.match(uiTypesSource, /contextWindow/);
  assert.match(uiTypesSource, /compressionThresholdPercent/);
  assert.match(configStoreSource, /contextWindow/);
  assert.match(configStoreSource, /compressionThresholdPercent/);
  assert.match(uiTypesSource, /analysisModel/);
  assert.match(configStoreSource, /analysisModel/);
  assert.match(claudeSettingsSource, /CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC/);
  assert.match(claudeSettingsSource, /DISABLE_TELEMETRY/);
  assert.match(claudeSettingsSource, /getApiConfigForModel/);
  assert.match(claudeSettingsSource, /getEnabledUsableApiConfigs/);
  assert.match(apiProfilesSettingsSource, /Prompt 分析模型/);
  assert.match(apiProfilesSettingsSource, /测试连接/);
  assert.match(apiProfilesSettingsSource, /onChange\(\(current\) => \[create\(\), \.\.\.current\]\)/);
  assert.doesNotMatch(apiProfilesSettingsSource, /enabled:\s*item\.id === profile\.id/);
  assert.doesNotMatch(settingsModalSource, /enabled:\s*index === enabledIndex/);
  assert.doesNotMatch(configStoreSource, /profile\.enabled && !hasEnabled/);
  assert.match(apiProfilesSettingsSource, /createMenuOpen/);
  assert.doesNotMatch(apiProfilesSettingsSource, /DropdownMenu\.Portal/);
  assert.match(settingsModalSource, /toast\.success\("设置已保存。"\)/);
  assert.doesNotMatch(settingsModalSource, /setStatus\(\{\s*tone:\s*"success"/);
  assert.match(mainSource, /testApiConfig/);
  assert.match(preloadSource, /test-api-config/);
  assert.match(devShimSource, /testApiConfig/);
  assert.match(globalTypesSource, /test-api-config/);
});

test("shared model routing model slots use grouped searchable comboboxes", () => {
  const modelRoutingSource = readFileSync("src/ui/components/settings/ModelRoutingSettingsPage.tsx", "utf8");
  const modelSelectSource = readFileSync("src/ui/components/ModelSelect.tsx", "utf8");

  assert.match(modelRoutingSource, /<ModelSelect/);
  assert.match(modelSelectSource, /MODEL_GROUP_DEFINITIONS/);
  assert.match(modelSelectSource, /role="combobox"/);
  assert.match(modelSelectSource, /buildGroupedModelOptions/);
  assert.match(modelSelectSource, /getModelSearchScore/);
  assert.match(modelSelectSource, /isFuzzySubsequence/);
  assert.doesNotMatch(modelRoutingSource, /<select/);
});

test("model select search keeps short numeric tokens precise", () => {
  assert.deepEqual(getModelSearchValues("55"), ["gpt-5.5"]
... (truncated)
```
