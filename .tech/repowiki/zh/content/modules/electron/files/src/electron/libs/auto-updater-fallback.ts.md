# src/electron/libs/auto-updater-fallback.ts

> 模块：`electron` · 语言：`typescript` · 行数：147

## 文件职责

GitHub Releases更新元数据解析和版本比较的备用逻辑

## 关键符号

- `compareAppVersions@0 - 语义化版本比较，支持v前缀和构建后缀`
- `getPlatformUpdateMetadataCandidates@0 - 根据平台和架构返回可能的更新元数据文件名列表`
- `summarizeGitHubReleaseForUpdates@0 - 从GitHub Release提取更新信息，查找对应的平台元数据文件`
- `createReleaseUpdatePlan@0 - 构建更新计划，选择最佳候选版本`

## 对外暴露

- `GitHubReleaseAssetLike`
- `GitHubReleaseLike`
- `ReleaseFallbackInfo`
- `ReleaseUpdatePlan`
- `isMissingPlatformUpdateMetadataError`
- `normalizeAppVersion`
- `compareAppVersions`
- `getPlatformUpdateMetadataCandidates`
- `summarizeGitHubReleaseForUpdates`
- `selectBestReleaseForUpdate`
- `buildGitHubReleaseDownloadFeedUrl`
- `createReleaseUpdatePlan`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type GitHubReleaseAssetLike = {
  name?: unknown;
};

export type GitHubReleaseLike = {
  tag_name?: unknown;
  name?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  body?: unknown;
  assets?: unknown;
};

export type ReleaseFallbackInfo = {
  tagName?: string;
  version?: string;
  releaseName?: string;
  releaseDate?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  metadataFile?: string;
  hasCompatibleUpdateMetadata: boolean;
};

export type ReleaseUpdatePlan = {
  selectedRelease: ReleaseFallbackInfo | null;
  currentRelease: ReleaseFallbackInfo | null;
  isMultiReleaseUpdate: boolean;
  previousBlockmapBaseUrl?: string;
};

export function isMissingPlatformUpdateMetadataError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:404|not\s*found|cannot\s+find|no\s+published\s+versions)/i.test(message) &&
    /(?:latest(?:-[\w]+)?\.ya?ml|update\s+info|release\s+artifacts?)/i.test(message);
}

export function normalizeAppVersion(value: string | undefined): string {
  return (value ?? '').trim().replace(/^v/i, '').split(/[+-]/)[0] ?? '';
}

export function compareAppVersions(left: string | undefined, right: string | undefined): number {
  const leftParts = normalizeAppVersion(left).split('.').map((part) => Number.parseInt(part, 10));
  const rightParts = normalizeAppVersion(right).split('.').map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightPart = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

export function getPlatformUpdateMetadataCandidates(platform: NodeJS.Platform, arch: string): string[] {
  if (platform === 'darwin') return ['latest-mac.yml'];
  if (platform === 'linux') return ['latest-linux.yml'];
  if (platform === 'win32') {
    return arch === 'arm64' ? ['latest-win-arm64.yml', 'latest.yml'] : ['latest.yml'];
  }
  return [];
}

export function summarizeGitHubReleaseForUpdates(
  release: GitHubReleaseLike,
  platform: NodeJS.Platform,
  arch: string,
): ReleaseFallbackInfo {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const assetNames = new Set(
    assets
      .map((asset: unknown) => {
        if (typeof asset !== 'object' || asset === null || Array.isArray(asset)) return '';
        const name = (asset as GitHubReleaseAssetLike).name;
        return typeof name === 'string' ? name : '';
      })
      .filter(Boolean),
  );
  const metadataCandidates = getPlatformUpdateMetadataCandidates(platform, arch);
  const metadataFile = metadataCandidates.find((candidate) => assetNames.has(candidate));

  return {
    tagName: typeof release.tag_name === 'string' ? release.tag_name : undefined,
    version: typeof release.tag_name === 'string' ? normalizeAppVersion(release.tag_name) : undefined,
    releaseName: typeof release.name === 'string' ? release.name : undefined,
    releaseDate: typeof release.published_at === 'string' ? release.published_at : undefined,
    releaseNotes: typeof release.body === 'string' ? release.body : undefined,
    releaseUrl: typeof release.html_url === 'string' ? release.html_url : undefined,
    metadataFile,
    hasCompatibleUpdateMetadata: Boolean(metadataFile),
  };
}

export function selectBestReleaseForUpdate(
  releases: GitHubReleaseLike[],
  currentVersion: string | undefined,
  platform: NodeJS.Platform,
  arch: string,
): ReleaseFallbackInfo | null {
  const newerReleases = releases
    .map((release) => summarizeGitHubReleaseForUpdates(release, platform, arch))
    .filter((release) => release.version && compareAppVersions(release.version, currentVersion) > 0)
    .sort((left, right) => compareAppVersions(right.version, left.version));

  return newerReleases.find((release) => release.hasCompatibleUpdateMetadata) ?? newerReleases[0] ?? null;
}

export function buildGitHubReleaseDownloadFeedUrl(owner: string, repo: string, tagName: string): s
... (truncated)
```
