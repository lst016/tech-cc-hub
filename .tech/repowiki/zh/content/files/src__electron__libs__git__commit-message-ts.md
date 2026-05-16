# src/electron/libs/git/commit-message.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：262

## 文件职责

AI驱动的commit message生成，包含调用Claude Code的能力和fallback逻辑

## 关键符号

- `generateCommitMessageSuggestion@0 - 主函数，尝试用AI生成commit message，超时或失败时返回fallback`
- `runSinglePromptQuery@0 - 调用@anthropic-ai/claude-agent-sdk执行单次prompt查询`
- `buildFallbackCommitSuggestion@0 - 当AI不可用时，基于文件状态生成简化的commit message`
- `normalizeAiSuggestion@0 - 规范化AI返回的commit message格式`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `./types.js`

## 对外暴露

- `generateCommitMessageSuggestion`
- `generateFallbackCommitMessageSuggestion`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
    { buildEnvForConfig, getClaudeCodeModelOption, getClaudeCodePath, getCurrentApiConfig },
  ] = await Promise.all([
    import("@anthropic-ai/claude-agent-sdk"),
    import("../claude-settings.js"),
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
... (truncated)
```
