export type DevLoopTaskKind = "none" | "code" | "frontend" | "visual" | "electron" | "docs";
export type DevLoopMode = "none" | "dev" | "visual-dev" | "electron-window";
export type DevLoopPhase = "classified" | "prompt_injected" | "verified" | "paused" | "completed";

export type DevLoopClassification = {
  taskKind: DevLoopTaskKind;
  loopMode: DevLoopMode;
  confidence: number;
  reasons: string[];
  promptAddendum: string;
};

export type DevLoopAttachmentLike = {
  id?: string;
  kind?: string;
  type?: string;
  name?: string;
  mimeType?: string;
};

export type DevLoopClassifyInput = {
  prompt: string;
  attachments?: DevLoopAttachmentLike[];
  cwd?: string;
  runSurface?: string;
};

export type DevLoopMessage = {
  type: "dev_loop";
  phase: DevLoopPhase;
  taskKind: DevLoopTaskKind;
  loopMode: DevLoopMode;
  confidence: number;
  summary: string;
  reasons: string[];
  instructions?: string;
  iteration?: number;
  capturedAt?: number;
  historyId?: string;
};

const DOC_KEYWORDS = ["文档", "README", "说明", "计划", "规范", "设计文档", "开发文档"];
const DOC_ONLY_HINTS = ["不改代码", "不用改代码", "只写文档", "仅文档", "只整理", "planning only", "plan:"];
const DEV_KEYWORDS = [
  "修复",
  "实现",
  "开发",
  "重构",
  "测试",
  "bug",
  "API",
  "接口",
  "代码",
  "feature",
  "fix",
  "implement",
  "refactor",
  "test",
];
const FRONTEND_KEYWORDS = [
  "React",
  "Vue",
  "CSS",
  "Tailwind",
  "组件",
  "页面",
  "样式",
  "布局",
  "tsx",
  "jsx",
  ".vue",
  ".css",
];
const VISUAL_KEYWORDS = ["截图", "图片", "Figma", "复刻", "按图", "视觉", "设计稿", "对齐", "UI"];
const ELECTRON_KEYWORDS = ["Trace", "右侧", "右栏", "窗口", "Electron", "客户端", "UI", "布局", "真窗口"];

function includesAny(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function hasImageAttachment(attachments: DevLoopAttachmentLike[] = []): boolean {
  return attachments.some((attachment) => {
    const kind = (attachment.kind ?? attachment.type ?? "").toLowerCase();
    const mimeType = (attachment.mimeType ?? "").toLowerCase();
    const name = (attachment.name ?? "").toLowerCase();
    return kind === "image" || mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name);
  });
}

function isTechCcHubCwd(cwd?: string): boolean {
  return typeof cwd === "string" && /(?:^|[\\/])tech-cc-hub(?:[\\/]|$)/i.test(cwd);
}

function buildFirstShotDesignPack(mode: Extract<DevLoopMode, "visual-dev" | "electron-window">): string[] {
  const common = [
    "## First-Shot Design Pack（第一轮准确性优先）",
    "",
    "不要先写代码。写代码前先在回复或内部执行步骤里完成以下设计包，然后再基于设计包小步修改：",
    "1. 先提取目标图规格：页面尺寸、主区域分块、颜色 token、字号/字重、间距、圆角、阴影、组件层级、滚动/固定区域。",
    "2. 读取当前组件入口、现有 CSS/Tailwind 主题、可复用组件和不应改动的区域。",
    "3. 把目标规格映射到当前代码：明确改哪个组件、哪个容器、哪些样式变量或 class。",
    "4. 写出本轮验收标准：主布局、关键模块首屏可见、文字不溢出、不遮挡、交互状态正确。",
    "5. 只根据上述设计包改代码；缺少证据时先补截图/DOM/组件上下文，不要凭感觉重写整页。",
  ];

  if (mode === "electron-window") {
    return [
      ...common,
      "6. 当前组件入口要优先从 Electron 真窗口对应页面反查；验收标准必须包含 Electron 真窗口截图或真实窗口状态。",
    ];
  }

  return common;
}

function buildPromptAddendum(mode: DevLoopMode): string {
  if (mode === "none") return "";

  const common = [
    "## Dev Loop（系统自动启用）",
    "",
    "这是一条开发任务。请按“理解需求 -> 小步修改 -> 运行验证 -> 失败则继续修复 -> 输出证据”的闭环执行。",
    "完成前必须运行与改动范围匹配的最小验证命令，并在最终回复里列出命令和结果。",
    "如果验证失败，不要直接结束；先根据失败信息修复一轮，再重新验证。",
  ];

  if (mode === "dev") {
    return common.join("\n");
  }

  if (mode === "visual-dev") {
    return [
      ...common,
      "",
      ...buildFirstShotDesignPack("visual-dev"),
      "",
      "如果任务涉及页面、组件、样式、截图、图片或 Figma，请启动可预览界面，截图当前结果，对照目标图或需求列出视觉偏差，并做至少一轮精准修复。",
      "视觉修复要优先小步调整颜色、间距、字体、布局和状态，不要无依据整页重写。",
    ].join("\n");
  }

  return [
    ...common,
    "",
    ...buildFirstShotDesignPack("electron-window"),
    "",
    "这是 Electron 桌面端相关任务，验收以 Electron 真窗口为准。",
    "除非用户明确要求只跑网页端，否则需要启动项目默认 Electron 客户端，使用真实窗口或窗口截图验证 UI 状态。",
  ].join("\n");
}

function buildClassification(
  taskKind: DevLoopTaskKind,
  loopMode: DevLoopMode,
  confidence: number,
  reasons: string[],
): DevLoopClassification {
  return {
    taskKind,
    loopMode,
    confidence,
    reasons,
    promptAddendum: buildPromptAddendum(loopMode),
  };
}

export function classifyDevLoop(input: DevLoopClassifyInput): DevLoopClassification {
  const prompt = input.prompt.trim();
  const promptAndCwd = `${prompt}\n${input.cwd ?? ""}\n${input.runSurface ?? ""}`;
  const reasons: string[] = [];
  const imageAttachment = hasImageAttachment(input.attachments);

  if (includesAny(prompt, DOC_KEYWORDS) && includesAny(prompt, DOC_ONLY_HINTS)) {
    return buildClassification("docs", "none", 0.88, ["检测到纯文档任务，并且用户明确不改代码"]);
  }

  if (imageAttachment) {
    return buildClassification("visual", "visual-dev", 0.92, ["检测到图片附件，需要进入视觉开发闭环"]);
  }

  if (isTechCcHubCwd(input.cwd) && includesAny(promptAndCwd, ELECTRON_KEYWORDS)) {
    reasons.push("tech-cc-hub UI/窗口任务需要 Electron 真窗口验收");
    return buildClassification("electron", "electron-window", 0.9, reasons);
  }

  if (includesAny(promptAndCwd, VISUAL_KEYWORDS)) {
    if (includesAny(promptAndCwd, VISUAL_KEYWORDS)) {
      reasons.push("检测到截图/Figma/复刻/视觉类关键词");
    }
    return buildClassification("visual", "visual-dev", 0.86, reasons);
  }

  if (includesAny(prompt, DOC_KEYWORDS) && !includesAny(promptAndCwd, FRONTEND_KEYWORDS)) {
    return buildClassification("docs", "none", 0.74, ["检测到文档类任务"]);
  }

  if (includesAny(promptAndCwd, FRONTEND_KEYWORDS)) {
    return buildClassification("frontend", "visual-dev", 0.82, ["检测到前端页面/组件/样式任务"]);
  }

  if (includesAny(promptAndCwd, DEV_KEYWORDS)) {
    return buildClassification("code", "dev", 0.78, ["检测到代码修改、修复、实现或测试类任务"]);
  }

  return buildClassification("none", "none", 0.35, ["未检测到明确开发闭环信号"]);
}

export function applyDevLoopToPrompt(prompt: string, classification: DevLoopClassification): string {
  if (classification.loopMode === "none" || !classification.promptAddendum.trim()) {
    return prompt;
  }

  if (prompt.includes("## Dev Loop（系统自动启用）")) {
    return prompt;
  }

  return `${prompt.trim()}\n\n${classification.promptAddendum}`;
}

function modeLabel(mode: DevLoopMode): string {
  if (mode === "dev") return "开发验证闭环";
  if (mode === "visual-dev") return "视觉开发闭环";
  if (mode === "electron-window") return "Electron 真窗口闭环";
  return "未启用";
}

export function createDevLoopMessage(
  classification: DevLoopClassification,
  phase: DevLoopPhase = "classified",
): DevLoopMessage {
  return {
    type: "dev_loop",
    phase,
    taskKind: classification.taskKind,
    loopMode: classification.loopMode,
    confidence: classification.confidence,
    summary: `Dev Loop ${modeLabel(classification.loopMode)}：${classification.loopMode === "none" ? "本轮不注入开发闭环。" : "已为本轮注入默认执行要求。"}`,
    reasons: classification.reasons,
    instructions: classification.promptAddendum || undefined,
  };
}
