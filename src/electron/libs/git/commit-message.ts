import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { GitChangedFile, GitCommitMessageSuggestion } from "./types.js";

const MAX_AI_DIFF_CHARS = 6_000;
const MAX_AI_CONTEXT_CHARS = 8_000;
const MAX_AI_FILE_LINES = 80;
const MAX_BODY_CHARS = 500;
const AI_COMMIT_MESSAGE_TIMEOUT_MS = 6_000;

export async function generateCommitMessageSuggestion(input: {
  files: GitChangedFile[];
  stat: string;
  nameStatus: string;
  diff: string;
  language?: string;
}): Promise<GitCommitMessageSuggestion> {
  const fallback = buildFallbackCommitSuggestion(input.files);
  const [
    { query },
    {
      buildClaudeCodeModelSettings,
      buildEnvForConfig,
      getClaudeCodeModelOption,
      getClaudeCodePath,
      getCurrentApiConfig,
    },
  ] = await Promise.all([
    import("@anthropic-ai/claude-agent-sdk"),
    import("../claude/claude-settings.js"),
  ]);
  const apiConfig = getCurrentApiConfig();
  if (!apiConfig?.model?.trim()) {
    return fallback;
  }

  const requestedModel = apiConfig.smallModel?.trim() || apiConfig.analysisModel?.trim() || apiConfig.model;
  const prompt = buildPrompt({
    ...input,
    language: input.language?.trim() || "zh-CN",
  });

  try {
    const claudeCodeModelOption = getClaudeCodeModelOption(apiConfig, requestedModel);
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), AI_COMMIT_MESSAGE_TIMEOUT_MS);
    const result = await runSinglePromptQuery(query, prompt, {
      ...(claudeCodeModelOption ? { model: claudeCodeModelOption } : {}),
      abortController,
      maxTurns: 1,
      tools: [],
      settingSources: [],
      settings: buildClaudeCodeModelSettings(apiConfig, requestedModel),
      env: {
        ...process.env,
        ...buildEnvForConfig(apiConfig, requestedModel),
      },
      pathToClaudeCodeExecutable: getClaudeCodePath(),
    }).finally(() => clearTimeout(timeout));

    if (result?.subtype !== "success") {
      return fallback;
    }

    return normalizeAiSuggestion(result.result, fallback, requestedModel);
  } catch (error) {
    console.warn("[git] failed to generate commit message, using fallback:", error);
    return fallback;
  }
}

async function runSinglePromptQuery(
  query: typeof import("@anthropic-ai/claude-agent-sdk").query,
  prompt: string,
  options: NonNullable<Parameters<typeof query>[0]["options"]>,
): Promise<SDKResultMessage | undefined> {
  const q = query({ prompt, options });
  let result: SDKResultMessage | undefined;
  for await (const message of q) {
    if (message.type === "result") {
      result = message;
    }
  }
  return result;
}

export function generateFallbackCommitMessageSuggestion(files: GitChangedFile[]): GitCommitMessageSuggestion {
  return buildFallbackCommitSuggestion(files);
}

function buildPrompt(input: {
  files: GitChangedFile[];
  stat: string;
  nameStatus: string;
  diff: string;
  language: string;
}) {
  const diff = truncateMiddle(input.diff, MAX_AI_DIFF_CHARS);
  const changedFiles = input.files
    .slice(0, MAX_AI_FILE_LINES)
    .map((file) => `- ${file.status}: ${file.path}`)
    .join("\n");
  const context = [
    "你是 Git 提交信息生成器。只根据暂存区生成提交信息。",
    `输出语言：${input.language === "zh-CN" ? "中文" : input.language}。`,
    "",
    "要求：",
    "- 严格输出 JSON，不要 Markdown。",
    "- message 使用 Conventional Commits：<type>(<scope>): <中文描述>。",
    "- type 从 feat/fix/perf/refactor/docs/test/build/chore/style/i18n 里选。",
    "- scope 用英文小写短词，优先从路径推断。",
    "- message 不超过 72 字符，末尾不要句号。",
    "- body 可省略；需要时最多 3 条，每条以 '- ' 开头，只写 diff 能证明的事实。",
    "",
    '输出格式：{"message":"fix(git): 修复暂存全部文件状态不同步","body":"- 同步暂存后的文件列表"}',
    "",
    "Changed files:",
    changedFiles,
    input.files.length > MAX_AI_FILE_LINES ? `... 还有 ${input.files.length - MAX_AI_FILE_LINES} 个文件` : "",
    "",
    "Name status:",
    input.nameStatus.trim() || "(empty)",
    "",
    "Stat:",
    input.stat.trim() || "(empty)",
    "",
    "Diff:",
    diff || "(empty)",
  ].join("\n");

  return truncateMiddle(context, MAX_AI_CONTEXT_CHARS);
}

function normalizeAiSuggestion(raw: string, fallback: GitCommitMessageSuggestion, model?: string): GitCommitMessageSuggestion {
  const parsed = parseJsonObject(raw);
  if (!parsed) return fallback;

  const message = sanitizeLine(parsed.message).slice(0, 72);
  if (!message) return fallback;

  const body = sanitizeBody(parsed.body);
  return {
    message,
    body,
    source: "ai",
    model,
  };
}

function parseJsonObject(raw: string): { message?: unknown; body?: unknown } | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < jsonStart) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as { message?: unknown; body?: unknown }
      : null;
  } catch {
    return null;
  }
}

function buildFallbackCommitSuggestion(files: GitChangedFile[]): GitCommitMessageSuggestion {
  const stagedFiles = files.filter((file) => file.staged);
  const targetFiles = stagedFiles.length > 0 ? stagedFiles : files;
  const firstFile = targetFiles[0];
  if (!firstFile) {
    return { message: "更新暂存区改动", source: "fallback" };
  }

  const action = summarizeAction(targetFiles);
  const subject = summarizeSubject(firstFile.path);
  const suffix = targetFiles.length > 1 ? ` 等 ${targetFiles.length} 个文件` : "";
  const body = targetFiles
    .slice(0, 6)
    .map((file) => `- ${statusLabel(file.status)} ${file.path}`)
    .join("\n");

  return {
    message: `${fallbackType(targetFiles)}(${fallbackScope(firstFile.path)}): ${action}${subject}${suffix}`.slice(0, 72),
    body,
    source: "fallback",
  };
}

function fallbackType(files: GitChangedFile[]) {
  const paths = files.map((file) => file.path.toLowerCase());
  if (paths.every((path) => path.includes("test") || path.includes("spec"))) return "test";
  if (paths.every((path) => path.endsWith(".md") || path.includes("/docs/") || path.includes("\\docs\\"))) return "docs";
  if (paths.some((path) => path.includes("package") || path.includes("vite") || path.includes("tsconfig") || path.includes("eslint"))) return "build";
  if (paths.some((path) => path.includes("git"))) return "fix";
  return "chore";
}

function fallbackScope(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/git/") || normalized.includes("git")) return "git";
  if (normalized.includes("/settings/")) return "settings";
  if (normalized.includes("/electron/")) return "electron";
  if (normalized.includes("/ui/")) return "ui";
  if (normalized.includes("/docs/")) return "docs";
  return "repo";
}

function summarizeAction(files: GitChangedFile[]) {
  const statuses = new Set(files.map((file) => file.status));
  if (statuses.size > 1) return "更新";
  const [status] = Array.from(statuses);
  if (status === "added" || status === "untracked") return "新增";
  if (status === "deleted") return "删除";
  if (status === "renamed") return "重命名";
  return "调整";
}

function statusLabel(status: GitChangedFile["status"]) {
  switch (status) {
    case "added":
      return "新增";
    case "deleted":
      return "删除";
    case "renamed":
      return "重命名";
    case "copied":
      return "复制";
    case "untracked":
      return "新增";
    case "conflicted":
      return "冲突";
    case "modified":
    default:
      return "修改";
  }
}

function summarizeSubject(filePath: string) {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  const fileName = parts.at(-1) ?? filePath;
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

function sanitizeLine(value: unknown) {
  return typeof value === "string"
    ? value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

function sanitizeBody(value: unknown) {
  if (typeof value !== "string") return undefined;
  const body = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join("\n")
    .slice(0, MAX_BODY_CHARS)
    .trim();
  return body || undefined;
}

function truncateMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const headLength = Math.floor(maxLength * 0.65);
  const tailLength = maxLength - headLength - 40;
  return `${value.slice(0, headLength)}\n\n... diff 内容过长，已省略中间部分 ...\n\n${value.slice(Math.max(0, value.length - tailLength))}`;
}
