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
  version?: string;
  releaseName?: string;
  releaseDate?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  hasCompatibleUpdateMetadata: boolean;
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

  return {
    version: typeof release.tag_name === 'string' ? normalizeAppVersion(release.tag_name) : undefined,
    releaseName: typeof release.name === 'string' ? release.name : undefined,
    releaseDate: typeof release.published_at === 'string' ? release.published_at : undefined,
    releaseNotes: typeof release.body === 'string' ? release.body : undefined,
    releaseUrl: typeof release.html_url === 'string' ? release.html_url : undefined,
    hasCompatibleUpdateMetadata: metadataCandidates.some((candidate) => assetNames.has(candidate)),
  };
}
