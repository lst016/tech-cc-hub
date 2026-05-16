# src/electron/libs/knowledge/repowiki/builder.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：489

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildOverviewPage@87`
- `buildArchitecturePage@196`
- `buildModulePage@251`
- `buildReadingGuidePage@333`
- `buildAgentPlaybookPage@366`
- `buildRuntimeFlowsPage@406`
- `buildApiSurfacePage@423`
- `appendSignalTable@437`
- `buildDependencyPage@448`
- `slugify@469`
- `inferAgentTask@477`
- `RepoWikiBuilder@13`
- `overview@18`
- `moduleId@45`
- `mermaid@68`
- `lines@89`
- `version@129`
- `category@130`
- `lines@198`
- `lines@253`
- `kind@281`
- `description@282`
- `lines@335`
- `time@340`
- `intelligence@368`
- `lines@369`
- `lines@408`
- `intelligence@425`
- `lines@426`
- `lines@450`
- `core@451`
- `entries@459`

## 依赖输入

- `./types.js`
- `./graph.js`

## 对外暴露

- `RepoWikiBuilder`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
      if (workflow.summary) lines.push(workflow.summary, "
... (truncated)
```
