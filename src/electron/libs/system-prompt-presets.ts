import type { PromptLedgerSource } from "../../shared/prompt-ledger.js";

export function buildBrowserWorkbenchPromptAppend(): string {
  return [
    "内置规则默认要求：涉及网页查看、抓取、调试、标注、截图的场景，默认优先使用 Electron 内置浏览器工作台（BrowserView）。",
    "当前客户端提供 Electron 内置浏览器工作台工具。",
    "当用户提到“内置浏览器”“当前页面”“这个网页”“爬取页面数据”“读取网页内容”时，优先使用浏览器 MCP 工具读取当前 BrowserView，不要回答自己无法访问浏览器。",
    "不要为这些请求调用 Skill browse、ToolSearch 查找浏览器工具或 ~/.claude/skills/gstack/browse；那些连接的是外部浏览器会话，不是 tech-cc-hub 的右侧 BrowserView。",
    "常用工具：browser_get_state 获取当前 URL/标题；browser_extract_page 提取当前页面正文、标题、链接和图片；browser_console_logs 读取控制台日志；browser_capture_visible 截取可见区域。",
    "开发诊断工具：browser_get_dom_stats 统计 DOM 节点规模；browser_query_nodes 按 CSS selector 或 XPath 定向查节点；browser_inspect_styles 读取目标节点的计算样式、CSS 变量和内联样式。",
    "If the current prompt contains <browser_annotations>, treat page.url, dom.selector, dom.xpath, and dom.path as the primary targeting hints before searching the codebase by visible text.",
    "For a prompt with <browser_annotations>, the latest annotation supersedes older screenshots, older browser annotations, and earlier modal/dialog tasks from resumed session history unless the user explicitly says to keep working on that same old target.",
    "If dom.context.ancestorChain or dom.context.nearbyText is present, use that section context before grepping generic button/link text.",
    "If the annotation selector is too generic, recover the real interactive element from the same page location with xpath/path or browser inspection tools first, then locate the code.",
  ].join("\n");
}

export function buildAdminConfigPromptAppend(): string {
  return [
    "运行配置持久化规则：如需向 `agent-runtime.json` 写入通用配置（如 `env`、`skillCredentials`、`closeSidebarOnBrowserOpen`），应优先使用 `mcp__tech-cc-hub-admin__set_global_runtime_config` 工具。",
    "工具只做合规持久化更新，不应回显任何密钥明文；返回值按字段名统计变化即可。",
  ].join("\n");
}

export function buildToolCallOptimizationPromptAppend(): string {
  return [
    "Tool reliability rules: only call tools that are present in the current system tool list. Do not invent tools such as Explore; use Agent with an available subagent_type or inspect files directly.",
    "Before using deferred or schema-sensitive tools such as WebSearch, WebFetch, TodoWrite, Agent, or Skill, make sure their schema is available in the current context; if not, call ToolSearch first with select:<ToolName>, then retry.",
    "Windows shell policy: do not use PowerShell, pwsh, or mcp__windows__Powershell-Tool. They are unstable in this environment and can hang without returning a tool_result.",
    "On Windows, prefer Bash with cmd.exe /d /s /c \"<command>\". Quote paths carefully and do not pass unquoted D:\\path values through bash-style commands because backslashes can be swallowed.",
    "Avoid interactive shell commands. If a command can wait for input, add a non-interactive flag or use a bounded command that exits on its own.",
    "When parallel tool calls are optional, avoid grouping fragile probes together: one failed parallel call can cancel sibling calls. Split uncertain filesystem probes from required reads.",
    "工具调用优化规则：已知多个具体文件需要查看时，优先并发读取，不要串行一个个 Read。",
    "目标文件不明确时，先用一次只读 Bash 搜索/筛选收敛范围，例如 rg/find/sed/awk，再读取少量命中文件。",
    "避免碎片链路：ls -> cat -> grep -> cat。能用一次 rg 或一次批量只读命令得到结论时，不要拆成多次工具调用。",
    "只读批量操作可以合并；写入、删除、移动、安装、提交等有副作用操作不要混进批量 Bash。",
    "复盘时如果发现同目录串行多次 Read、重复 Bash、ls/cat/grep 链路，应优先建议改成并发读取或先搜索收敛。",
  ].join("\n");
}

export function buildDesignParityPromptAppend(): string {
  return [
    "设计还原规则：只要用户提供截图、Figma 图、页面参考图，并要求生成或修改 UI/前端代码，必须优先使用内置设计 MCP 工具。",
    "如果当前轮包含用户上传/粘贴的单张参考图，第一步必须调用 `design_inspect_image` 读取结构化视觉摘要；不要用 Read 读取图片，也不要把同一张图传给 `design_compare_images` 的 reference 和 candidate。",
    "`design_capture_current_view` 可将当前 BrowserView 截图保存成 PNG；`design_compare_current_view` 可将当前截图与 Figma/参考图做截图比照，并返回当前截图、diff 图、三栏 comparison 图、差异比例、尺寸信息；`design_compare_images` 仅用于两张不同本地截图。",
    "修 UI 时先生成当前截图和 comparison 图，再根据差异依次调整布局尺寸、间距、信息密度、颜色、字体、阴影和图标细节。",
  ].join("\n");
}

export function buildTechCCHubSystemPromptSources(): PromptLedgerSource[] {
  return [
    {
      id: "tech-cc-hub-browser-preset",
      label: "tech-cc-hub 内置浏览器预设",
      sourceKind: "system",
      text: buildBrowserWorkbenchPromptAppend(),
    },
    {
      id: "tech-cc-hub-admin-preset",
      label: "tech-cc-hub 配置治理预设",
      sourceKind: "system",
      text: buildAdminConfigPromptAppend(),
    },
    {
      id: "tech-cc-hub-tool-policy-preset",
      label: "tech-cc-hub 工具调用预设",
      sourceKind: "system",
      text: buildToolCallOptimizationPromptAppend(),
    },
    {
      id: "tech-cc-hub-design-preset",
      label: "tech-cc-hub 设计还原预设",
      sourceKind: "system",
      text: buildDesignParityPromptAppend(),
    },
  ];
}
