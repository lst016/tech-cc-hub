# src/electron/libs/plugin-updates.ts

> 模块：`electron` · 语言：`typescript` · 行数：77

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `normalizePluginVersion@13`
- `comparePluginVersions@22`
- `summarizePluginUpdate@37`
- `SEMVER_PATTERN@11`
- `raw@15`
- `version@17`
- `normalized@19`
- `leftParts@24`
- `rightParts@25`
- `length@26`
- `leftPart@29`
- `rightPart@30`
- `currentVersion@44`
- `latestVersion@45`
- `updateAvailable@67`
- `PluginUpdateStatus@1`
- `PluginUpdateSummary@2`

## 对外暴露

- `PluginUpdateStatus`
- `PluginUpdateSummary`
- `normalizePluginVersion`
- `comparePluginVersions`
- `summarizePluginUpdate`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type PluginUpdateStatus = "unknown" | "up-to-date" | "update-available" | "error";

export type PluginUpdateSummary = {
  currentVersion?: string;
  latestVersion?: string;
  updateAvailable: boolean;
  updateStatus: PluginUpdateStatus;
  updateError?: string;
  updateCheckedAt?: number;
};

const SEMVER_PATTERN = /v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;

export function normalizePluginVersion(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;

  const version = raw.match(SEMVER_PATTERN)?.[1] ?? raw.replace(/^v/i, "");
  const normalized = version.trim().split(/[+-]/)[0];
  return normalized || undefined;
}

export function comparePluginVersions(left: string | null | undefined, right: string | null | undefined): number {
  const leftParts = normalizePluginVersion(left)?.split(".").map((part) => Number.parseInt(part, 10)) ?? [];
  const rightParts = normalizePluginVersion(right)?.split(".").map((part) => Number.parseInt(part, 10)) ?? [];
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightPart = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

export function summarizePluginUpdate(input: {
  currentVersion?: string | null;
  latestVersion?: string | null;
  updateError?: string;
  updateCheckedAt?: number;
}): PluginUpdateSummary {
  const currentVersion = normalizePluginVersion(input.currentVersion);
  const latestVersion = normalizePluginVersion(input.latestVersion);

  if (input.updateError) {
    return {
      currentVersion,
      latestVersion,
      updateAvailable: false,
      updateStatus: "error",
      updateError: input.updateError,
      updateCheckedAt: input.updateCheckedAt,
    };
  }

  if (!currentVersion || !latestVersion) {
    return {
      currentVersion,
      latestVersion,
      updateAvailable: false,
      updateStatus: "unknown",
      updateCheckedAt: input.updateCheckedAt,
    };
  }

  const updateAvailable = comparePluginVersions(latestVersion, currentVersion) > 0;
  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    updateStatus: updateAvailable ? "update-available" : "up-to-date",
    updateCheckedAt: input.updateCheckedAt,
  };
}

```
