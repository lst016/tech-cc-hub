import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getSystemAgentProfiles, getUserClaudeRoot } from "./agent-resolver.js";

export type AgentRuleDocuments = {
  systemDefaultMarkdown: string;
  userClaudeRoot: string;
  userAgentsPath: string;
  userAgentsMarkdown: string;
};

const USER_AGENTS_FILE = "AGENTS.md";

function safeReadText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function buildSystemDefaultMarkdown(): string {
  const profiles = getSystemAgentProfiles();
  const builtinRequirement = [
    "## 内置浏览器默认规则",
    "",
    "默认要求：涉及网页查看、抓取、调试、标注、截图的场景，默认优先使用 Electron 内置浏览器工作台（BrowserView）。",
    "",
    "禁止默认走外部 browse skill。请优先用浏览器 MCP（browser_get_state / browser_extract_page / browser_capture_visible ...）。",
    "",
  ].join("\n");

  const sections = [
    "# tech-cc-hub 系统默认规则",
    "",
    "这部分由应用内置生成，只用于展示当前软件默认加载的系统级 Agent 规则，不会写入用户目录。",
    "",
    builtinRequirement,
  ];

  for (const profile of profiles) {
    sections.push(
      [
        `## ${profile.name}`,
        "",
        `- ID: ${profile.id}`,
        `- 作用域: ${profile.scope}`,
        `- 运行面: ${profile.runSurface}`,
        `- 可见性: ${profile.visibility}`,
        `- 自动应用: ${profile.autoApply ? "是" : "否"}`,
        profile.allowedTools?.length ? `- 允许工具: ${profile.allowedTools.join(", ")}` : "- 允许工具: 未配置",
        "",
        profile.description ? `> ${profile.description}` : "",
        "",
        "```text",
        profile.prompt.trim(),
        "```",
        "",
      ].filter((line) => line !== "").join("\n"),
    );
  }

  return sections.join("\n").trimEnd() + "\n";
}

export function loadAgentRuleDocuments(): AgentRuleDocuments {
  const userClaudeRoot = getUserClaudeRoot();
  const userAgentsPath = join(userClaudeRoot, USER_AGENTS_FILE);

  return {
    systemDefaultMarkdown: buildSystemDefaultMarkdown(),
    userClaudeRoot,
    userAgentsPath,
    userAgentsMarkdown: existsSync(userAgentsPath) ? safeReadText(userAgentsPath) : "",
  };
}

export function saveUserAgentRuleDocument(markdown: string): void {
  const userClaudeRoot = getUserClaudeRoot();
  const userAgentsPath = join(userClaudeRoot, USER_AGENTS_FILE);
  mkdirSync(userClaudeRoot, { recursive: true });
  writeFileSync(userAgentsPath, markdown, "utf8");
}
