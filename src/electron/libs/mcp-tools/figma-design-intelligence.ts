export const FIGMA_DESIGN_DOMAINS = [
  "auto",
  "admin",
  "saas",
  "ai-tool",
  "mobile",
  "marketing",
  "data-heavy",
  "ecommerce",
] as const;

export const FIGMA_DESIGN_AUDIT_FRAMEWORKS = [
  "practical",
  "laws-of-ux",
  "enterprise",
  "platform",
  "token-system",
  "ai-ux",
] as const;

export type FigmaDesignDomain = typeof FIGMA_DESIGN_DOMAINS[number];
export type FigmaDesignAuditFramework = typeof FIGMA_DESIGN_AUDIT_FRAMEWORKS[number];

type AuditSeverity = "high" | "medium" | "low";

type AuditFinding = {
  id: string;
  severity: AuditSeverity;
  principle: string;
  title: string;
  evidence: string;
  recommendation: string;
  affectedNodes?: string[];
};

type AuditNode = {
  id?: string;
  name?: string;
  type?: string;
  bounds?: {
    width?: number;
    height?: number;
  };
  layout?: Record<string, unknown>;
  text?: Record<string, unknown>;
  children?: AuditNode[];
};

type AuditTokenEntry<T extends string | number> = {
  value: T;
  count: number;
  usages: string[];
};

export type FigmaDesignSummaryForAudit = {
  nodes: AuditNode[];
  tokens: {
    colors: Array<AuditTokenEntry<string>>;
    typography: Array<AuditTokenEntry<string>>;
    radii: Array<AuditTokenEntry<number>>;
    spacing: Array<AuditTokenEntry<number>>;
    effects: Array<AuditTokenEntry<string>>;
  };
  stats: {
    visited: number;
    emitted: number;
    truncated: boolean;
  };
  warnings: string[];
};

type FlattenedAuditNode = {
  node: AuditNode;
  depth: number;
  parentName?: string;
  siblingCount: number;
};

type DesignSystemProfile = {
  id: string;
  name: string;
  source: string;
  bestFor: FigmaDesignDomain[];
  signal: string;
  strengths: string[];
  apply: string[];
};

const DESIGN_SYSTEM_PROFILES: DesignSystemProfile[] = [
  {
    id: "carbon",
    name: "IBM Carbon",
    source: "https://carbondesignsystem.com/",
    bestFor: ["admin", "data-heavy", "saas"],
    signal: "成熟企业级设计系统，适合复杂表单、数据表、状态和可访问性治理。",
    strengths: ["企业后台", "数据密度", "可访问性", "token 与组件规范"],
    apply: ["优先定义表单、表格、过滤器、状态提示和空状态规范。", "把颜色、间距、排版拆成 semantic tokens。"],
  },
  {
    id: "fluent",
    name: "Microsoft Fluent 2",
    source: "https://fluent2.microsoft.design/",
    bestFor: ["admin", "saas", "ai-tool"],
    signal: "官方提供 Figma UI kits、跨 Web/iOS/Android/Windows 组件与可访问性资源。",
    strengths: ["生产力工具", "跨平台", "焦点顺序", "可访问性插件"],
    apply: ["强化键盘焦点、菜单、弹层、列表密度和命令面板体验。", "让工具型界面更像稳定工作台，而不是营销页。"],
  },
  {
    id: "primer",
    name: "GitHub Primer",
    source: "https://primer.style/",
    bestFor: ["admin", "saas", "ai-tool", "data-heavy"],
    signal: "开源开发者产品设计系统，适合代码、协作、仓库、Issue 和权限类界面。",
    strengths: ["开发者工具", "信息架构", "状态标签", "代码协作"],
    apply: ["用清晰标签、状态色、紧凑列表和可扫描信息层级组织复杂开发工具。"],
  },
  {
    id: "ant-design",
    name: "Ant Design",
    source: "https://ant.design/",
    bestFor: ["admin", "saas", "data-heavy"],
    signal: "高星企业级组件体系，后台、表单、表格和配置页模式丰富。",
    strengths: ["中后台", "表单", "表格", "筛选与操作流"],
    apply: ["后台配置页优先参考 Ant 的表格、抽屉、表单、反馈和批量操作模式。"],
  },
  {
    id: "material",
    name: "Material Design 3",
    source: "https://m3.material.io/",
    bestFor: ["mobile", "saas", "ecommerce"],
    signal: "设计 token 分层清晰，reference / system / component tokens 适合做变量治理。",
    strengths: ["token 分层", "动态主题", "移动端", "组件状态"],
    apply: ["按 reference -> semantic/system -> component 三层治理 Figma variables 和代码 CSS vars。"],
  },
  {
    id: "apple-hig",
    name: "Apple Human Interface Guidelines",
    source: "https://developer.apple.com/design/human-interface-guidelines/",
    bestFor: ["mobile", "ai-tool"],
    signal: "官方平台规范和 Figma/SF Symbols 资源，适合 iOS/macOS/visionOS 体验。",
    strengths: ["平台一致性", "输入法与手势", "图标", "系统控件"],
    apply: ["移动端或 macOS 风格界面优先校验触控尺寸、导航层级、系统反馈和平台控件一致性。"],
  },
  {
    id: "tdesign-arco",
    name: "TDesign / Arco",
    source: "https://tdesign.tencent.com/",
    bestFor: ["admin", "saas", "data-heavy"],
    signal: "中文互联网中后台设计系统，贴近国内业务配置页和运营后台语境。",
    strengths: ["中文后台", "业务表格", "运营配置", "复杂筛选"],
    apply: ["中文管理台优先参考它们的布局密度、表单提示、筛选区和批量操作。"],
  },
  {
    id: "storybook",
    name: "Storybook Component States",
    source: "https://storybook.js.org/",
    bestFor: ["admin", "saas", "ai-tool", "data-heavy", "mobile", "ecommerce"],
    signal: "高星组件状态工作流，适合把 Figma 变体和代码组件状态对齐。",
    strengths: ["组件状态", "变体矩阵", "回归验证", "设计到代码映射"],
    apply: ["为核心组件补齐 loading、empty、error、disabled、hover、focus、selected 状态。"],
  },
];

const UX_PRINCIPLES = [
  {
    id: "jakob",
    name: "Jakob's Law",
    use: "用用户熟悉的模式组织导航、表单、搜索、下拉、确认和错误反馈。",
  },
  {
    id: "fitts",
    name: "Fitts's Law",
    use: "重要点击目标足够大、足够近，桌面工具按钮至少稳定可点，触控目标建议不低于 44px。",
  },
  {
    id: "hick",
    name: "Hick's Law",
    use: "选项过多时分组、搜索、默认值、渐进披露，避免一次性把所有选择压给用户。",
  },
  {
    id: "miller",
    name: "Miller's Law",
    use: "把复杂信息切成可扫描区块，控制每屏核心组块数量。",
  },
  {
    id: "tesler",
    name: "Tesler's Law",
    use: "复杂度不能消失，只能被放到系统、默认值、模板和渐进流程里。",
  },
  {
    id: "aesthetic-usability",
    name: "Aesthetic-Usability Effect",
    use: "视觉秩序会提升用户容错感，但不能掩盖弱反馈、弱可读性或错层级。",
  },
];

export function buildFigmaDesignPlaybook(options: {
  domain?: FigmaDesignDomain;
  includeSources?: boolean;
  maxItems?: number;
} = {}): unknown {
  const domain = options.domain ?? "auto";
  const maxItems = clampInteger(options.maxItems, 1, DESIGN_SYSTEM_PROFILES.length, 8);
  const profiles = rankDesignSystems(domain).slice(0, maxItems).map((profile) => ({
    id: profile.id,
    name: profile.name,
    signal: profile.signal,
    strengths: profile.strengths,
    apply: profile.apply,
    source: options.includeSources ? profile.source : undefined,
  }));

  return {
    domain,
    intent: "给 Agent 选择设计系统、设计理论和 Figma 落地检查规则，不直接替代项目现有组件库。",
    recommendedStack: buildRecommendedStack(domain),
    designSystems: profiles,
    principles: UX_PRINCIPLES,
    figmaWorkflow: [
      "先用 figma_summarize_design 建立轻量节点树，再用 figma_audit_design 做设计理论审查。",
      "需要设计语言时用 figma_extract_design_tokens；需要变量治理时用 figma_get_file_variables。",
      "实现前先选一个设计系统作为约束，不要混搭太多视觉语言。",
      "实现后用 tech-cc-hub-design 截图比对，保留 diff/report 作为视觉验收证据。",
    ],
    sourceNotes: options.includeSources ? [
      "Figma Design Systems: https://www.figma.com/design-systems/",
      "Open design systems on Figma Community: https://www.designsystems.com/open-design-systems/",
      "Material token hierarchy: https://material-web.dev/theming/material-theming/",
      "Fluent 2: https://fluent2.microsoft.design/",
      "Apple Design Resources: https://developer.apple.com/design/resources/",
      "Laws of UX: https://lawsofux.com/",
    ] : undefined,
  };
}

export function buildFigmaDesignAudit(
  summary: FigmaDesignSummaryForAudit,
  options: {
    domain?: FigmaDesignDomain;
    frameworks?: FigmaDesignAuditFramework[];
    maxFindings?: number;
    includePlaybook?: boolean;
  } = {},
): unknown {
  const domain = inferDomain(options.domain, summary);
  const frameworks = normalizeFrameworks(options.frameworks, domain);
  const nodes = flattenNodes(summary.nodes);
  const stats = buildAuditStats(summary, nodes);
  const findings = buildAuditFindings(summary, nodes, domain, frameworks)
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
    .slice(0, clampInteger(options.maxFindings, 1, 30, 12));
  const score = Math.max(0, Math.min(100, 100 - findings.reduce((total, finding) => (
    total + (finding.severity === "high" ? 14 : finding.severity === "medium" ? 8 : 4)
  ), 0)));

  return {
    domain,
    frameworks,
    score,
    stats,
    findings,
    tokenRecommendations: buildTokenRecommendations(summary),
    suggestedDesignSystems: rankDesignSystems(domain).slice(0, 4).map((profile) => ({
      id: profile.id,
      name: profile.name,
      why: profile.signal,
      apply: profile.apply,
    })),
    implementationChecklist: buildImplementationChecklist(domain, frameworks),
    playbook: options.includePlaybook ? buildFigmaDesignPlaybook({ domain, maxItems: 5 }) : undefined,
    warnings: summary.warnings,
  };
}

function rankDesignSystems(domain: FigmaDesignDomain): DesignSystemProfile[] {
  if (domain === "auto") {
    return DESIGN_SYSTEM_PROFILES;
  }
  return [...DESIGN_SYSTEM_PROFILES].sort((left, right) => {
    const leftScore = left.bestFor.includes(domain) ? 1 : 0;
    const rightScore = right.bestFor.includes(domain) ? 1 : 0;
    return rightScore - leftScore;
  });
}

function buildRecommendedStack(domain: FigmaDesignDomain): string[] {
  if (domain === "mobile") {
    return ["Apple HIG", "Material Design 3", "Laws of UX", "Figma variables"];
  }
  if (domain === "ai-tool") {
    return ["Fluent 2", "Primer", "Generative AI UX principles", "Laws of UX", "Storybook states"];
  }
  if (domain === "marketing") {
    return ["Material Design 3 tokens", "Aesthetic-Usability Effect", "responsive layout QA"];
  }
  return ["Carbon", "Fluent 2", "Primer", "Ant/TDesign", "Laws of UX", "Material token hierarchy"];
}

function inferDomain(domain: FigmaDesignDomain | undefined, summary: FigmaDesignSummaryForAudit): FigmaDesignDomain {
  if (domain && domain !== "auto") {
    return domain;
  }
  const text = JSON.stringify(summary.nodes).toLowerCase();
  if (/prompt|agent|chat|model|ai|生成|智能|助手/.test(text)) return "ai-tool";
  if (/table|filter|dashboard|settings|admin|配置|表格|筛选|管理/.test(text)) return "admin";
  if (/cart|checkout|price|sku|商品|订单|购物/.test(text)) return "ecommerce";
  if (/iphone|ios|android|mobile|tab bar|bottom nav/.test(text)) return "mobile";
  if (/hero|pricing|landing|cta|官网|营销/.test(text)) return "marketing";
  return "saas";
}

function normalizeFrameworks(
  frameworks: FigmaDesignAuditFramework[] | undefined,
  domain: FigmaDesignDomain,
): FigmaDesignAuditFramework[] {
  const base = new Set<FigmaDesignAuditFramework>(frameworks?.length ? frameworks : ["practical", "laws-of-ux", "token-system"]);
  if (["admin", "data-heavy", "saas"].includes(domain)) base.add("enterprise");
  if (["mobile"].includes(domain)) base.add("platform");
  if (domain === "ai-tool") base.add("ai-ux");
  return [...base];
}

function flattenNodes(nodes: AuditNode[], depth = 0, parentName?: string, siblingCount = nodes.length): FlattenedAuditNode[] {
  return nodes.flatMap((node) => {
    const current = { node, depth, parentName, siblingCount };
    return [current, ...flattenNodes(node.children ?? [], depth + 1, node.name, node.children?.length ?? 0)];
  });
}

function buildAuditStats(summary: FigmaDesignSummaryForAudit, nodes: FlattenedAuditNode[]): Record<string, unknown> {
  const actionNodes = nodes.filter(({ node }) => isActionLikeNode(node));
  const textNodes = nodes.filter(({ node }) => node.type === "TEXT");
  const instanceNodes = nodes.filter(({ node }) => node.type === "INSTANCE");
  return {
    visited: summary.stats.visited,
    emitted: summary.stats.emitted,
    truncated: summary.stats.truncated,
    maxDepth: nodes.reduce((max, item) => Math.max(max, item.depth), 0),
    maxSiblingCount: nodes.reduce((max, item) => Math.max(max, item.siblingCount), 0),
    actionLikeNodes: actionNodes.length,
    textNodes: textNodes.length,
    instanceNodes: instanceNodes.length,
    tokenCounts: {
      colors: summary.tokens.colors.length,
      typography: summary.tokens.typography.length,
      radii: summary.tokens.radii.length,
      spacing: summary.tokens.spacing.length,
      effects: summary.tokens.effects.length,
    },
  };
}

function buildAuditFindings(
  summary: FigmaDesignSummaryForAudit,
  nodes: FlattenedAuditNode[],
  domain: FigmaDesignDomain,
  frameworks: FigmaDesignAuditFramework[],
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const actionNodes = nodes.filter(({ node }) => isActionLikeNode(node));
  const smallTargets = actionNodes.filter(({ node }) => {
    const width = node.bounds?.width ?? 0;
    const height = node.bounds?.height ?? 0;
    return width > 0 && height > 0 && (width < 36 || height < 32);
  });
  if (smallTargets.length > 0) {
    findings.push({
      id: "small-action-targets",
      severity: "high",
      principle: "Fitts's Law",
      title: "存在偏小的可点击目标",
      evidence: `${smallTargets.length} 个疑似按钮/图标/菜单目标小于桌面稳定点击尺寸。`,
      recommendation: "把主要操作目标提高到稳定尺寸；触控或移动端优先接近 44px，桌面图标按钮也要固定宽高并保留热区。",
      affectedNodes: smallTargets.slice(0, 8).map(formatNodeRef),
    });
  }

  const overloadedGroups = nodes.filter(({ node }) => (node.children?.length ?? 0) >= 10);
  if (frameworks.includes("laws-of-ux") && overloadedGroups.length > 0) {
    findings.push({
      id: "too-many-visible-choices",
      severity: "medium",
      principle: "Hick's Law",
      title: "同层选项偏多",
      evidence: `${overloadedGroups.length} 个容器存在 10 个以上子节点，用户决策和扫描成本会上升。`,
      recommendation: "用分组、搜索、默认值、折叠区或分页拆开选择面；配置型页面优先让主路径露出，其余放进次级入口。",
      affectedNodes: overloadedGroups.slice(0, 6).map(formatNodeRef),
    });
  }

  const tinyTextNodes = nodes.filter(({ node }) => node.type === "TEXT" && getTextNumber(node, "fontSize") !== undefined && getTextNumber(node, "fontSize")! < 12);
  if (tinyTextNodes.length > 0) {
    findings.push({
      id: "tiny-text",
      severity: "medium",
      principle: "Accessibility",
      title: "存在过小文本",
      evidence: `${tinyTextNodes.length} 个文本节点字号小于 12px。`,
      recommendation: "正文、说明和输入标签不要低于可读阈值；弱信息可通过颜色和层级降噪，不要只靠缩小字号。",
      affectedNodes: tinyTextNodes.slice(0, 8).map(formatNodeRef),
    });
  }

  if (summary.tokens.colors.length > 14 || summary.tokens.typography.length > 10) {
    findings.push({
      id: "token-sprawl",
      severity: "high",
      principle: "Design Tokens",
      title: "颜色或排版 token 候选过多",
      evidence: `颜色 ${summary.tokens.colors.length} 类，排版 ${summary.tokens.typography.length} 类。`,
      recommendation: "按 Material 式 reference -> semantic/system -> component token 分层收敛；先保留品牌色、语义状态色、文本层级和背景层级。",
    });
  }

  if (summary.tokens.spacing.length > 16 || summary.tokens.radii.length > 8) {
    findings.push({
      id: "scale-inconsistency",
      severity: "medium",
      principle: "Consistency",
      title: "间距或圆角比例不够收敛",
      evidence: `间距 ${summary.tokens.spacing.length} 类，圆角 ${summary.tokens.radii.length} 类。`,
      recommendation: "用 4/8px 间距阶梯和少量圆角等级治理视觉节奏；工具型界面卡片圆角不宜过度分散。",
    });
  }

  const nonInstanceActionNodes = actionNodes.filter(({ node }) => node.type !== "INSTANCE");
  if (nonInstanceActionNodes.length >= 6) {
    findings.push({
      id: "componentization-gap",
      severity: "medium",
      principle: "Design System Reuse",
      title: "疑似操作控件没有充分组件化",
      evidence: `${nonInstanceActionNodes.length} 个疑似操作节点不是 INSTANCE。`,
      recommendation: "把按钮、输入、下拉、标签、表格操作、空状态和错误状态沉淀为组件/变体，方便映射到代码组件。",
      affectedNodes: nonInstanceActionNodes.slice(0, 8).map(formatNodeRef),
    });
  }

  if (domain === "ai-tool" && frameworks.includes("ai-ux")) {
    findings.push({
      id: "ai-ux-state-coverage",
      severity: "low",
      principle: "Generative AI UX",
      title: "AI 工具需要补齐可解释和可恢复状态",
      evidence: "AI 产品除常规 UI 外，还需要覆盖生成中、失败、重试、引用来源、风险提示、撤销/回滚和人工接管。",
      recommendation: "在 Figma 里补齐 prompt 输入、结果生成、停止、重试、引用、置信度、敏感操作确认、错误恢复等状态。",
    });
  }

  if (domain === "admin" || domain === "data-heavy") {
    findings.push({
      id: "enterprise-workflow-states",
      severity: "low",
      principle: "Enterprise UX",
      title: "中后台需要明确表格和表单状态矩阵",
      evidence: "配置/后台界面通常不是单屏静态稿，真正成本在状态和边界。",
      recommendation: "参考 Carbon/Ant/TDesign：为列表、筛选、批量操作、详情抽屉、保存反馈、权限不足、空数据、加载和错误态补变体。",
    });
  }

  return findings;
}

function buildTokenRecommendations(summary: FigmaDesignSummaryForAudit): string[] {
  const recommendations = [
    "把 Figma variables 对齐到代码侧 CSS custom properties / Tailwind theme，不要让颜色和间距散落在组件实现里。",
    "推荐 token 层级：reference 原始值 -> semantic/system 语义角色 -> component 组件私有覆盖。",
  ];
  if (summary.tokens.colors.length > 0) {
    recommendations.push("颜色优先收敛为 brand、surface、text、border、success、warning、danger、info 等语义角色。");
  }
  if (summary.tokens.spacing.length > 0) {
    recommendations.push("间距优先归一到 4/8px 阶梯；少量业务密度例外需要命名说明。");
  }
  if (summary.tokens.typography.length > 0) {
    recommendations.push("排版用 display/title/body/caption/mono 等角色，避免每个局部文字都成为新样式。");
  }
  return recommendations;
}

function buildImplementationChecklist(domain: FigmaDesignDomain, frameworks: FigmaDesignAuditFramework[]): string[] {
  const checklist = [
    "先读取 Figma summary/token，再选择一个主设计系统作为约束，不要混搭多个体系的按钮、表格和弹层语言。",
    "实现时复用项目已有组件，生成代码只能当草稿。",
    "落地后用 design_compare_current_view 或 design_compare_images 做截图差异验收。",
  ];
  if (frameworks.includes("enterprise")) {
    checklist.push("补齐 loading、empty、error、disabled、hover、focus、selected、permission denied 等状态。");
  }
  if (frameworks.includes("platform")) {
    checklist.push("移动端/平台稿检查触控目标、导航层级、系统控件、键盘和安全区。");
  }
  if (domain === "ai-tool") {
    checklist.push("AI 工具额外检查生成中、停止生成、重试、引用来源、风险提示、撤销和人工接管。");
  }
  return checklist;
}

function isActionLikeNode(node: AuditNode): boolean {
  const name = `${node.name ?? ""} ${node.type ?? ""}`.toLowerCase();
  return /button|btn|cta|tab|nav|menu|link|action|icon|switch|checkbox|radio|chip|tag|dropdown|select|input|search|save|submit|delete|edit|新增|添加|保存|删除|编辑|搜索|筛选|按钮|菜单|链接|选择|确认|取消/.test(name);
}

function getTextNumber(node: AuditNode, key: string): number | undefined {
  const value = node.text?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatNodeRef({ node, parentName }: FlattenedAuditNode): string {
  return [node.name ?? node.type ?? "node", node.id ? `(${node.id})` : "", parentName ? `in ${parentName}` : ""]
    .filter(Boolean)
    .join(" ");
}

function severityWeight(severity: AuditSeverity): number {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(value), min), max);
}
