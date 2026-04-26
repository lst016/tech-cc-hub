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
    "设计还原默认规则：只要用户提供截图、Figma 图、页面参考图，并要求生成或修改 UI/前端代码，请优先使用设计 MCP。单张参考图先用 design_inspect_image 生成结构化视觉摘要；已有页面后再用 design_capture_current_view / design_compare_current_view / design_compare_images 生成当前截图、三栏比照图和差异图，再按差异修 UI。",
    "",
    "## 工具调用优化默认规则",
    "",
    "已知多个具体文件需要查看时，优先并发读取，不要串行一个个 Read。",
    "",
    "目标文件不明确时，先用一次只读 Bash 搜索/筛选收敛范围，例如 rg/find/sed/awk，再读取少量命中文件。",
    "",
    "避免碎片链路：ls -> cat -> grep -> cat。能用一次 rg 或一次批量只读命令得到结论时，不要拆成多次工具调用。",
    "",
    "只读批量操作可以合并；写入、删除、移动、安装、提交等有副作用操作不要混进批量 Bash。",
    "",
    "复盘时如果发现同目录串行多次 Read、重复 Bash、ls/cat/grep 链路，应优先建议改成并发读取或先搜索收敛。",
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
