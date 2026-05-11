import { unstable_v2_prompt } from "@anthropic-ai/claude-agent-sdk";
import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { buildEnvForConfig, getClaudeCodeModelOption, getClaudeCodePath, getCurrentApiConfig } from "../claude-settings.js";
import type { GitChangedFile, GitCommitMessageSuggestion } from "./types.js";

const MAX_AI_DIFF_CHARS = 18_000;
const MAX_AI_CONTEXT_CHARS = 22_000;
const MAX_BODY_CHARS = 700;

export async function generateCommitMessageSuggestion(input: {
  files: GitChangedFile[];
  stat: string;
  nameStatus: string;
  diff: string;
  language?: string;
}): Promise<GitCommitMessageSuggestion> {
  const fallback = buildFallbackCommitSuggestion(input.files);
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
    const result: SDKResultMessage = await unstable_v2_prompt(prompt, {
      ...(claudeCodeModelOption ? { model: claudeCodeModelOption } : {}),
      env: {
        ...process.env,
        ...buildEnvForConfig(apiConfig, requestedModel),
      },
      pathToClaudeCodeExecutable: getClaudeCodePath(),
    } as Parameters<typeof unstable_v2_prompt>[1]);

    if (result.subtype !== "success") {
      return fallback;
    }

    return normalizeAiSuggestion(result.result, fallback, requestedModel);
  } catch (error) {
    console.error("[git] failed to generate commit message:", error);
    return fallback;
  }
}

function buildPrompt(input: {
  files: GitChangedFile[];
  stat: string;
  nameStatus: string;
  diff: string;
  language: string;
}) {
  const diff = truncateMiddle(input.diff, MAX_AI_DIFF_CHARS);
  const context = [
    "你是 Git 提交信息生成器。只根据暂存区 diff 生成提交信息，不要描述未暂存或未出现在 diff 里的内容。",
    `输出语言：${input.language === "zh-CN" ? "中文" : input.language}。`,
    "",
    "遵循 Conventional Commits 1.0.0：",
    "- message 必须使用 <type>(<scope>): <description> 或 <type>: <description>。",
    "- type 只能从 feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, i18n 中选择。",
    "- scope 可选，必须是英文小写名词，优先从文件路径推断，例如 git, ui, settings, electron。",
    "- description 用中文，使用祈使句/动宾结构，不超过 72 个字符，末尾不要句号。",
    "- 如果是破坏性变更，在 type/scope 后加 !，并在 body 末尾写 BREAKING CHANGE: 中文说明。",
    "",
    "选择规则：",
    "- 新功能或新增可见能力用 feat。",
    "- 修复错误、交互异常、样式错位、状态不刷新用 fix。",
    "- 只改文档用 docs；只改测试用 test；只改构建/依赖/脚本用 build 或 chore。",
    "- 代码结构调整但用户行为不变用 refactor；性能改进用 perf；格式或样式源码整理用 style。",
    "- 多个文件服务同一个目的时只写一条 message，不要按文件罗列。",
    "",
    "body 可选：",
    "- 只有当 message 说不清楚时才写 body。",
    "- body 最多 3 条，以 '- ' 开头，只写可从 diff 验证的事实。",
    "- 说明改了什么和为什么；不要写泛泛的“优化代码”“提升体验”。",
    "",
    "输出严格 JSON，不要 Markdown，不要代码块，不要解释。",
    '格式：{"message":"fix(git): 修复暂存全部文件状态不同步","body":"- 改为逐个暂存文件，避免单个路径失败中断全部操作"}',
    "",
    "Changed files:",
    input.files.map((file) => `- ${file.status}: ${file.path}`).join("\n"),
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
    message: `${action}${subject}${suffix}`.slice(0, 72),
    body,
    source: "fallback",
  };
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
