# src/electron/libs/mcp-tools/figma-design-intelligence.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：525

## 文件职责

Figma 设计智能分析：根据设计领域推荐设计系统栈，生成 UX 审查报告和 token 建议

## 关键符号

- `FIGMA_DESIGN_DOMAINS@0 - 设计领域常量（auto/admin/saas/ai-tool/mobile/marketing/data-heavy/ecommerce）`
- `FIGMA_DESIGN_AUDIT_FRAMEWORKS@0 - UX 审查框架（practical/laws-of-ux/enterprise/platform/token-system/ai-ux）`
- `DESIGN_SYSTEM_PROFILES@0 - 设计系统参考库（Carbon/Fluent/Primer/Ant Design/Shadcn/Aceternity/Material）`
- `buildFigmaDesignPlaybook@0 - 根据设计领域构建推荐技术栈和实施清单`
- `buildFigmaDesignAudit@0 - 根据 UX 原则生成设计审查结果和建议`

## 对外暴露

- `FIGMA_DESIGN_DOMAINS`
- `FIGMA_DESIGN_AUDIT_FRAMEWORKS`
- `FigmaDesignDomain`
- `FigmaDesignAuditFramework`
- `FigmaDesignSummaryForAudit`
- `buildFigmaDesignPlaybook`
- `buildFigmaDesignAudit`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
    bestFor: ["admin", "saas", "ai-tool", "data-hea
... (truncated)
```
