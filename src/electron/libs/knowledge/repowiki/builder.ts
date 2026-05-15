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

    if (project.intelligence) {
      pages.push({ id: "agent-playbook", title: "Agent 作业手册", content: buildAgentPlaybookPage(project), order: 1 });
      sidebar.push({ title: "Agent 作业手册", pageId: "agent-playbook", children: [] });
    }

    if (data.architecture.architecture_type || data.architecture.description || data.architecture.components?.length) {
      pages.push({ id: "architecture", title: "架构", content: buildArchitecturePage(data.architecture, project), order: 2 });
      sidebar.push({ title: "架构", pageId: "architecture", children: [] });
    }

    if (project.intelligence?.runtimeFlows.length) {
      pages.push({ id: "runtime-flows", title: "关键运行链路", content: buildRuntimeFlowsPage(project), order: 3 });
      sidebar.push({ title: "关键运行链路", pageId: "runtime-flows", children: [] });
    }

    if (project.intelligence) {
      pages.push({ id: "api-surface", title: "接口与存储面", content: buildApiSurfacePage(project), order: 4 });
      sidebar.push({ title: "接口与存储面", pageId: "api-surface", children: [] });
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

  if (overview.agent_summary?.length || project.intelligence?.highValueFiles.length) {
    lines.push("## Agent 快速定位", "");
    if (overview.agent_summary?.length) {
      for (const item of overview.agent_summary) {
        lines.push(`- ${item}`);
      }
      lines.push("");
    }
    if (project.intelligence?.highValueFiles.length) {
      lines.push("| 你要改什么 | 优先阅读 | 原因 |");
      lines.push("| --- | --- | --- |");
      for (const file of project.intelligence.highValueFiles.slice(0, 12)) {
        lines.push(`| ${inferAgentTask(file.path)} | \`${file.path}\` | ${file.reason} |`);
      }
      lines.push("");
    }
  }

  if (overview.key_workflows?.length) {
    lines.push("## 关键工作流", "");
    for (const workflow of overview.key_workflows) {
      lines.push(`### ${workflow.name}`, "");
      if (workflow.summary) lines.push(workflow.summary, "");
      if (workflow.files?.length) {
        lines.push(`证据文件：${workflow.files.map((file) => `\`${file}\``).join(", ")}`, "");
      }
    }
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

  if (overview.runtime_surfaces?.length) {
    lines.push("## 运行面", "");
    for (const surface of overview.runtime_surfaces) {
      lines.push(`- ${surface}`);
    }
    lines.push("");
  }

  if (overview.storage_and_indexes?.length || project.intelligence?.databaseTables.length) {
    lines.push("## 存储与索引", "");
    for (const item of overview.storage_and_indexes ?? []) {
      lines.push(`- ${item}`);
    }
    for (const table of project.intelligence?.databaseTables.slice(0, 16) ?? []) {
      lines.push(`- \`${table.name}\`：${table.detail ?? "SQLite schema"}`);
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

  if (overview.quality_gates?.length || project.intelligence?.scripts.length) {
    lines.push("## 验证命令", "");
    for (const gate of overview.quality_gates ?? []) {
      lines.push(`- ${gate}`);
    }
    for (const script of project.intelligence?.scripts.filter((script) => /^(qa|test|build|transpile|lint)/.test(script.name)).slice(0, 12) ?? []) {
      lines.push(`- \`npm run ${script.name}\`：\`${script.command}\``);
    }
    lines.push("");
  }

  if (overview.change_risks?.length) {
    lines.push("## 修改风险", "");
    for (const risk of overview.change_risks) {
      lines.push(`- ${risk}`);
    }
    lines.push("");
  }

  lines.push("## 仓库规模", "");
  lines.push(`- 文件数：${project.files.length}`);
  lines.push(`- 代码行数：${project.totalLines.toLocaleString("en-US")}`);
  lines.push("");
  return lines.join("\n").trim();
}

function buildArchitecturePage(architecture: ArchitectureDiagram, project: RepoWikiProjectContext): string {
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
  if (architecture.layers?.length) {
    lines.push("## 分层边界", "");
    for (const layer of architecture.layers) {
      lines.push(`### ${layer.name}`, "");
      if (layer.purpose) lines.push(layer.purpose, "");
      if (layer.files?.length) lines.push(`证据文件：${layer.files.map((file) => `\`${file}\``).join(", ")}`, "");
    }
  }
  if (architecture.boundaries?.length) {
    lines.push("## 边界规则", "");
    for (const boundary of architecture.boundaries) {
      lines.push(`- ${boundary}`);
    }
    lines.push("");
  }
  if (architecture.integration_points?.length || project.intelligence?.runtimeFlows.length) {
    lines.push("## 集成点", "");
    for (const item of architecture.integration_points ?? []) {
      lines.push(`- ${item}`);
    }
    for (const flow of project.intelligence?.runtimeFlows ?? []) {
      lines.push(`- **${flow.title}**：${flow.evidence.map((file) => `\`${file}\``).join(", ")}`);
    }
    lines.push("");
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
  if (module.agent_value?.length) {
    lines.push("## Agent 可用信息", "");
    for (const item of module.agent_value) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }
  if (module.entrypoints?.length) {
    lines.push("## 优先入口", "");
    for (const entry of module.entrypoints) {
      lines.push(`- \`${entry.path}\`${entry.reason ? `：${entry.reason}` : ""}`);
    }
    lines.push("");
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
  if (module.data_contracts?.length) {
    lines.push("## 数据与接口契约", "");
    for (const contract of module.data_contracts) {
      lines.push(`- **${contract.name}**：${contract.explanation || ""}`);
    }
    lines.push("");
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
  if (module.operational_notes?.length) {
    lines.push("## 运行注意事项", "");
    for (const note of module.operational_notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }
  if (module.change_risks?.length) {
    lines.push("## 修改风险", "");
    for (const risk of module.change_risks) {
      lines.push(`- ${risk}`);
    }
    lines.push("");
  }
  if (module.validation?.length) {
    lines.push("## 验证", "");
    for (const item of module.validation) {
      lines.push(`- ${item}`);
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
  if (guide.task_paths?.length) {
    lines.push("## 按任务阅读", "");
    for (const item of guide.task_paths) {
      lines.push(`### ${item.task}`, "");
      if (item.why) lines.push(item.why, "");
      if (item.files?.length) lines.push(`文件：${item.files.map((file) => `\`${file}\``).join(", ")}`, "");
    }
  }
  return lines.join("\n").trim();
}

function buildAgentPlaybookPage(project: RepoWikiProjectContext): string {
  const intelligence = project.intelligence;
  const lines = ["# Agent 作业手册", ""];
  lines.push("这页只服务于后续 Agent：先用它定位要读的文件，再进入模块页看细节。", "");
  if (!intelligence) return lines.join("\n").trim();

  lines.push("## 常见任务路径", "");
  for (const item of intelligence.agentQuestions) {
    lines.push(`### ${item.question}`, "");
    lines.push(item.answer, "");
    lines.push(`证据文件：${item.files.map((file) => `\`${file}\``).join(", ")}`, "");
  }

  lines.push("## 高价值文件", "");
  lines.push("| 文件 | Agent 应该知道什么 | 代码信号 |");
  lines.push("| --- | --- | --- |");
  for (const file of intelligence.highValueFiles.slice(0, 36)) {
    lines.push(`| \`${file.path}\` | ${file.reason} | ${file.signals.join("<br>") || "-"} |`);
  }
  lines.push("");

  if (intelligence.scripts.length) {
    lines.push("## 可执行命令", "");
    for (const script of intelligence.scripts) {
      lines.push(`- \`npm run ${script.name}\`：\`${script.command}\``);
    }
    lines.push("");
  }

  if (intelligence.dependencies.length) {
    lines.push("## 关键依赖", "");
    for (const dep of intelligence.dependencies) {
      lines.push(`- **${dep.name}** ${dep.version} (${dep.group})`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function buildRuntimeFlowsPage(project: RepoWikiProjectContext): string {
  const lines = ["# 关键运行链路", ""];
  for (const flow of project.intelligence?.runtimeFlows ?? []) {
    lines.push(`## ${flow.title}`, "", flow.summary, "");
    lines.push("### 步骤", "");
    for (const [index, step] of flow.steps.entries()) {
      lines.push(`${index + 1}. ${step}`);
    }
    lines.push("", "### 证据文件", "");
    for (const file of flow.evidence) {
      lines.push(`- \`${file}\``);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function buildApiSurfacePage(project: RepoWikiProjectContext): string {
  const intelligence = project.intelligence;
  const lines = ["# 接口与存储面", ""];
  if (!intelligence) return lines.join("\n").trim();

  appendSignalTable(lines, "Electron IPC", intelligence.ipcChannels);
  appendSignalTable(lines, "Renderer 调用", intelligence.uiIpcCalls);
  appendSignalTable(lines, "MCP Server", intelligence.mcpServers);
  appendSignalTable(lines, "MCP Tool", intelligence.mcpTools);
  appendSignalTable(lines, "SQLite / FTS / Vector", intelligence.databaseTables);
  appendSignalTable(lines, "事件", intelligence.events);
  return lines.join("\n").trim();
}

function appendSignalTable(lines: string[], title: string, signals: Array<{ name: string; detail?: string; line?: number }>): void {
  if (!signals.length) return;
  lines.push(`## ${title}`, "");
  lines.push("| 名称 | 位置/说明 |");
  lines.push("| --- | --- |");
  for (const signal of signals.slice(0, 80)) {
    lines.push(`| \`${signal.name}\` | ${signal.detail ?? (signal.line ? `line ${signal.line}` : "")} |`);
  }
  lines.push("");
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

function inferAgentTask(path: string): string {
  if (path.includes("/knowledge/")) return "知识库生成、索引、注入或检索";
  if (path.includes("KnowledgePanel")) return "知识库前端交互和进度显示";
  if (path.includes("/mcp-tools/") || path.includes("builtin-mcp")) return "Agent 工具/MCP 能力";
  if (path.includes("/task/")) return "任务面板、自动执行、恢复重试";
  if (path.includes("runner")) return "聊天会话、system prompt、MCP 加载";
  if (path.includes("ipc")) return "前后端 IPC 通道";
  if (path.includes("store")) return "UI 状态或持久化状态";
  if (path === "package.json") return "运行、构建和 QA 命令";
  return "项目入口或共享契约";
}
