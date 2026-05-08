export function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : "";
}

export function normalizeMonacoLanguage(language?: string, fileName?: string): string {
  const raw = (language || getFileExtension(fileName || "") || "plaintext").toLowerCase();
  const map: Record<string, string> = {
    bash: "shell",
    cjs: "javascript",
    conf: "ini",
    env: "ini",
    htm: "html",
    js: "javascript",
    jsx: "javascript",
    md: "markdown",
    mjs: "javascript",
    py: "python",
    rb: "ruby",
    sh: "shell",
    ts: "typescript",
    tsx: "typescript",
    yml: "yaml",
    zsh: "shell",
  };
  return map[raw] || raw || "plaintext";
}

function encodeModelPathSegment(segment: string, index: number): string {
  if (index === 1 && /^[a-z]:$/i.test(segment)) return segment;
  return encodeURIComponent(segment);
}

export function buildPreviewMonacoModelPath(filePath?: string, fileName?: string): string | undefined {
  const rawPath = (filePath || fileName || "").trim();
  if (!rawPath) return undefined;

  const normalizedPath = rawPath.replace(/\\/g, "/");
  const absoluteLikePath = /^[a-z]:\//i.test(normalizedPath)
    ? `/${normalizedPath}`
    : normalizedPath.startsWith("/")
      ? normalizedPath
      : `/${normalizedPath}`;
  const encodedPath = absoluteLikePath.split("/").map(encodeModelPathSegment).join("/");

  return `file://${encodedPath}`;
}
