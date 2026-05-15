import type {
  ArchitectureDiagram,
  ModuleDoc,
  ProjectOverview,
  ReadingGuide,
  RepoWiki,
  RepoWikiProjectContext,
  SidebarItem,
  WikiData,
  WikiPage,
} from "./types.js";
import { RepoWikiDependencyGraph } from "./graph.js";

export class RepoWikiBuilder {
  build(project: RepoWikiProjectContext, data: WikiData, graph: RepoWikiDependencyGraph): RepoWiki {
    const pages: WikiPage[] = [];
    const sidebar: SidebarItem[] = [];

    const overview = buildOverviewPage(data.overview, project);
    pages.push({ id: "index", title: "项目概览", content: overview, order: 0 });
    sidebar.push({ title: "项目概览", pageId: "index", children: [] });

    if (data.architecture.architecture_type || data.architecture.description || data.architecture.components?.length) {
      pages.push({ id: "architecture", title: "架构", content: buildArchitecturePage(data.architecture), order: 1 });
      sidebar.push({ title: "架构", pageId: "architecture", children: [] });
    }

    const moduleSidebar: SidebarItem = { title: "模块", children: [] };
    for (const [index, module] of data.modules.entries()) {
      const moduleId = `modules/${slugify(module.name || `module-${index + 1}`)}`;
      pages.push({
        id: moduleId,
        title: module.name || `module-${index + 1}`,
        content: buildModulePage(module),
        parentId: "modules",
        order: 100 + index,
      });
      moduleSidebar.children.push({ title: module.name || `module-${index + 1}`, pageId: moduleId, children: [] });
    }
    if (moduleSidebar.children.length > 0) {
      sidebar.push(moduleSidebar);
    }

    if (data.reading_guide.steps?.length) {
      pages.push({
        id: "reading-guide",
        title: "阅读指南",
        content: buildReadingGuidePage(data.reading_guide),
        order: 900,
      });
      sidebar.push({ title: "阅读指南", pageId: "reading-guide", children: [] });
    }

    const mermaid = graph.toMermaid();
    if (mermaid) {
      pages.push({
        id: "dependencies",
        title: "依赖关系",
        content: buildDependencyPage(graph, mermaid),
        order: 910,
      });
      sidebar.push({ title: "依赖关系", pageId: "dependencies", children: [] });
    }

    return {
      pages,
      sidebar,
      projectName: data.overview.name || project.name,
    };
  }
}

function buildOverviewPage(overview: ProjectOverview, project: RepoWikiProjectContext): string {
  const lines = [`# ${overview.name || project.name} 项目概览`, ""];
  if (overview.one_liner) {
    lines.push(`> ${overview.one_liner}`, "");
  }
  if (overview.description) {
    lines.push(overview.description, "");
  }

  if (overview.tech_stack?.length) {
    lines.push("## 技术栈", "");
    for (const item of overview.tech_stack) {
      const version = item.version ? ` ${item.version}` : "";
      const category = item.category ? ` (${item.category})` : "";
      lines.push(`- **${item.name}**${version}${category}`);
    }
    lines.push("");
  }

  if (overview.key_features?.length) {
    lines.push("## 核心功能", "");
    for (const feature of overview.key_features) {
      lines.push(`- ${feature}`);
    }
    lines.push("");
  }

  if (overview.setup_instructions?.length) {
    lines.push("## 快速开始", "");
    for (const [index, step] of overview.setup_instructions.entries()) {
      lines.push(`${index + 1}. ${step}`);
    }
    lines.push("");
  }

  lines.push("## 仓库规模", "");
  lines.push(`- 文件数：${project.files.length}`);
  lines.push(`- 代码行数：${project.totalLines.toLocaleString("en-US")}`);
  lines.push("");
  return lines.join("\n").trim();
}

function buildArchitecturePage(architecture: ArchitectureDiagram): string {
  const lines = ["# 架构", ""];
  if (architecture.architecture_type) {
    lines.push(`**类型：** ${architecture.architecture_type}`, "");
  }
  if (architecture.description) {
    lines.push(architecture.description, "");
  }
  if (architecture.mermaid_component) {
    lines.push("## 组件图", "", "```mermaid", architecture.mermaid_component, "```", "");
  }
  if (architecture.components?.length) {
    lines.push("## 组件", "");
    for (const component of architecture.components) {
      lines.push(`### ${component.name}`, "");
      if (component.purpose) lines.push(component.purpose, "");
      if (component.files?.length) {
        lines.push(`文件：${component.files.map((file) => `\`${file}\``).join(", ")}`, "");
      }
    }
  }
  if (architecture.mermaid_sequence) {
    lines.push("## 关键流程", "", "```mermaid", architecture.mermaid_sequence, "```", "");
  }
  if (architecture.data_flow) {
    lines.push("## 数据流", "", architecture.data_flow, "");
  }
  return lines.join("\n").trim();
}

function buildModulePage(module: ModuleDoc): string {
  const lines = [`# ${module.name}`, ""];
  if (module.purpose) {
    lines.push(`> ${module.purpose}`, "");
  }
  if (module.description) {
    lines.push(module.description, "");
  }
  if (module.files?.length) {
    lines.push("## 文件", "");
    for (const file of module.files) {
      lines.push(`### \`${file.path}\``, "");
      if (file.purpose) lines.push(file.purpose, "");
      if (file.key_symbols?.length) {
        for (const symbol of file.key_symbols) {
          const kind = symbol.kind ? ` (${symbol.kind})` : "";
          const description = symbol.description ? ` - ${symbol.description}` : "";
          lines.push(`- \`${symbol.name}\`${kind}${description}`);
        }
        lines.push("");
      }
    }
  }
  if (module.key_concepts?.length) {
    lines.push("## 关键概念", "");
    for (const concept of module.key_concepts) {
      lines.push(`- **${concept.name}**：${concept.explanation || ""}`);
    }
    lines.push("");
  }
  if (module.relationships?.length) {
    lines.push("## 内部关系", "");
    for (const relation of module.relationships) {
      lines.push(`- \`${relation.source}\` -> \`${relation.target}\`：${relation.description || ""}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function buildReadingGuidePage(guide: ReadingGuide): string {
  const lines = ["# 阅读指南", ""];
  if (guide.introduction) {
    lines.push(guide.introduction, "");
  }
  for (const step of guide.steps ?? []) {
    const time = step.time_estimate ? ` (${step.time_estimate})` : "";
    lines.push(`## Step ${step.order}: ${step.title}${time}`, "");
    if (step.files?.length) {
      lines.push(`**文件：** ${step.files.map((file) => `\`${file}\``).join(", ")}`, "");
    }
    if (step.explanation) {
      lines.push(step.explanation, "");
    }
  }
  if (guide.tips?.length) {
    lines.push("## Tips", "");
    for (const tip of guide.tips) {
      lines.push(`- ${tip}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function buildDependencyPage(graph: RepoWikiDependencyGraph, mermaid: string): string {
  const lines = ["# 模块依赖", "", "```mermaid", mermaid, "```", ""];
  const core = graph.getCoreFiles(12);
  if (core.length) {
    lines.push("## 核心文件 (PageRank)", "");
    for (const [index, path] of core.entries()) {
      lines.push(`${index + 1}. \`${path}\``);
    }
    lines.push("");
  }
  const entries = graph.getEntryPoints().slice(0, 12);
  if (entries.length) {
    lines.push("## 可能入口", "");
    for (const entry of entries) {
      lines.push(`- \`${entry}\``);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || "module";
}
