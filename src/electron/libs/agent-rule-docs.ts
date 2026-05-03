import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getSystemAgentProfiles, getUserClaudeRoot } from "./agent-resolver.js";

export type AgentRuleDocuments = {
  systemDefaultMarkdown: string;
  userClaudeRoot: string;
  userAgentsPath: string;
  userAgentsMarkdown: string;
};

const USER_AGENTS_FILE = "CLAUDE.md";

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
    "## 自动优化沉淀默认规则",
    "",
    "自动优化或复盘后，稳定规则类内容必须进入 Rules，而不是 Memory。Rules 包括长期行为约束、默认策略、工具调用政策、项目约定、命名规范、验收口径和禁止项。",
    "",
    "Memory 只用于记录最近做了什么、当前状态、未完成事项、风险、接手线索和短期事实，不承载长期规则或方法论。",
    "",
    "如果优化建议可以沉淀成可复用流程、模板、脚本、触发条件或输入输出协议，优先建议新增或优化 Skills；Rules 只保留何时使用这些 Skills 的触发约束。",
    "",
    "当一条内容同时像 Rules 和 Memory 时，优先归入 Rules；同时像 Rules 和 Skills 时，把约束放 Rules，把执行细节放 Skills。",
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
    "## Karpathy Coding Guardrails 默认规则",
    "",
    "来源：https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md",
    "",
    "编码前先澄清假设、歧义和取舍；不确定时要显式说明，不要假装已经理解。",
    "",
    "优先选择能解决问题的最小实现；不要增加用户没有要求的功能、抽象、配置项或防御性复杂度。",
    "",
    "修改必须外科手术式收敛；只触碰完成本次请求必需的代码，匹配现有风格，不顺手重构无关区域。",
    "",
    "多步骤任务需要先定义可验证的成功标准；修 bug 和重构应优先有复现/验收路径，再进入实现闭环。",
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
