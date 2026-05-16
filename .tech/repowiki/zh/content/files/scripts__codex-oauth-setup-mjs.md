# scripts/codex-oauth-setup.mjs

> 模块：`scripts` · 语言：`javascript` · 行数：295

## 文件职责

配置Codex OAuth认证，建立API配置文件，支持profile管理和JWT凭证存储

## 关键符号

- `parseArgs@0 - 解析命令行参数，支持--key=value和--key value两种格式`
- `getDefaultConfigPath@0 - 根据平台返回tech-cc-hub配置文件路径，遵循XDG规范`
- `buildCodexProfile@0 - 构建Codex profile对象，整合JWT凭证、模型列表和API配置`
- `loadCodexCredential@0 - 从.codex/auth.json加载JWT凭证并解码exp字段`
- `runCodexLogin@0 - 启动交互式OAuth登录流程，获取并保存凭证`
- `jwtExpiresAt@0 - 从JWT payload中提取过期时间戳`

## 依赖输入

- `node:crypto`
- `node:fs`
- `node:os`
- `node:path`
- `node:child_process`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const BASE_URL = "https://chatgpt.com";
const AUTH_CLAIM = "https://api.openai.com/auth";
const COMPACT_MODEL_SUFFIX = "-openai-compact";
const DEFAULT_MODEL = "gpt-5.5";
const SMALL_MODEL = "gpt-5.3-codex-spark";
const BASE_MODELS = [
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gpt-5.2",
  "gpt-5",
  "gpt-5-codex",
  "gpt-5-codex-mini",
  "gpt-5.1",
  "gpt-5.1-codex",
  "gpt-5.1-codex-max",
  "gpt-5.1-codex-mini",
  "gpt-5.2-codex",
];
const MODELS = Array.from(new Set([
  ...BASE_MODELS,
  ...BASE_MODELS.map((model) => `${model}${COMPACT_MODEL_SUFFIX}`),
]));

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const [rawKey, inlineValue] = item.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function getDefaultConfigPath() {
  if (process.env.TECH_CC_HUB_API_CONFIG) return process.env.TECH_CC_HUB_API_CONFIG;
  if (platform() === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "tech-cc-hub", "api-config.json");
  }
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", "tech-cc-hub", "api-config.json");
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "tech-cc-hub", "api-config.json");
}

function getDefaultCodexAuthPath() {
  const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
  return join(codexHome, "auth.json");
}

function readSettings(configPath) {
  if (!existsSync(configPath)) return { profiles: [] };
  const parsed = JSON.parse(readFileSync(configPath, "utf8"));
  return Array.isArray(parsed.profiles) ? parsed : { profiles: [parsed] };
}

function writeSettings(configPath, settings) {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(settings, null, 2), "utf8");
}

function buildCodexProfile(previous, credential, args) {
  const profileName = String(args.profileName || previous?.name || "Codex OAuth").trim() || "Codex OAuth";
  const previousModels = Array.isArray(previous?.models) ? previous.models : [];
  const model = typeof previous?.model === "string" && previous.model.trim() ? previous.model.trim() : DEFAULT_MODEL;
  const expertModel = typeof previous?.expertModel === "string" && previous.expertModel.trim()
    ? previous.expertModel.trim()
    : DEFAULT_MODEL;
  const smallModel = typeof previous?.smallModel === "string" && previous.smallModel.trim()
    ? previous.smallModel.trim()
    : SMALL_MODEL;
  const analysisModel = typeof previous?.analysisModel === "string" && previous.analysisModel.trim()
    ? previous.analysisModel.trim()
    : SMALL_MODEL;

  return {
    id: String(args.profileId || previous?.id || randomUUID()).trim(),
    name: profileName,
    apiKey: JSON.stringify(removeUndefined(credential), null, 2),
    baseURL: BASE_URL,
    model,
    expertModel,
    smallModel,
    imageModel: previous?.imageModel || undefined,
    analysisModel,
    models: MODELS.map((name) => ({
      name,
      contextWindow: previousModels.find?.((item) => item?.name === name)?.contextWindow ?? 200000,
      compressionThresholdPercent: previousModels.find?.((item) => item?.name === name)?.compressionThresholdPercent ?? 70,
    })),
    enabled: true,
    provider: "codex",
    apiType: "anthropic",
  };
}

function saveCodexProfile(configPath, credential, args) {
  const settings = readSettings(configPath);
  const profiles = Array.isArray(settings.profiles) ? [...sett
... (truncated)
```
