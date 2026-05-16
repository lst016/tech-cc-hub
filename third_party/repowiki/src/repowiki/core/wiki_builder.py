"""assemble wiki pages from analysis results."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

from repowiki.core.graph import DependencyGraph
from repowiki.core.models import FileDoc, FileInfo, ProjectContext, WikiData


@dataclass
class WikiPage:
    id: str
    title: str
    content: str
    parent_id: str = ""
    order: int = 0


@dataclass
class SidebarItem:
    title: str
    page_id: str
    children: list[SidebarItem] = field(default_factory=list)


@dataclass
class Wiki:
    pages: list[WikiPage] = field(default_factory=list)
    sidebar: list[SidebarItem] = field(default_factory=list)
    project_name: str = ""

    def get_page(self, page_id: str) -> WikiPage | None:
        for p in self.pages:
            if p.id == page_id:
                return p
        return None


class WikiBuilder:
    """constructs a Wiki from analysis results."""

    def __init__(self, file_page_limit: int | None = None):
        # Qoder-style Repo Wiki needs narrow file pages for every scanned source
        # file. A positive limit is only for explicit debugging or constrained QA.
        self.file_page_limit = file_page_limit if file_page_limit and file_page_limit > 0 else None

    def build(
        self,
        project: ProjectContext,
        wiki_data: WikiData,
        graph: DependencyGraph,
    ) -> Wiki:
        pages: list[WikiPage] = []
        sidebar: list[SidebarItem] = []

        file_docs_by_path = {
            file_doc.path: file_doc
            for module in wiki_data.modules
            for file_doc in module.files
        }
        file_pages_by_module = self._select_file_pages(project, graph)

        # 1. index / overview page
        overview = wiki_data.overview
        overview_md = self._build_overview_page(overview, project)
        pages.append(WikiPage(id="index", title=f"{project.name} 项目概览", content=overview_md, order=0))
        sidebar.append(SidebarItem(title=f"{project.name} 项目概览", page_id="index"))

        # 2. architecture page
        arch = wiki_data.architecture
        if arch.architecture_type:
            arch_md = self._build_architecture_page(arch)
            pages.append(WikiPage(id="architecture", title="架构设计", content=arch_md, order=1))
            sidebar.append(SidebarItem(title="架构设计", page_id="architecture"))

        # 3. deterministic agent pages. These are generated from actual source
        # metadata so the Agent has stable operational entry points even when the
        # model keeps module summaries short.
        agent_pages = [
            WikiPage(id="agent-playbook", title="Agent 作业手册", content=self._build_agent_playbook_page(project, graph), order=2),
            WikiPage(id="runtime-flows", title="关键运行链路", content=self._build_runtime_flows_page(project), order=3),
            WikiPage(id="api-surface", title="接口与存储面", content=self._build_api_surface_page(project), order=4),
        ]
        pages.extend(agent_pages)
        sidebar.extend(SidebarItem(title=page.title, page_id=page.id) for page in agent_pages)

        # 4. module pages plus Qoder-style file pages. Keep the export tree
        # human-readable: modules/<module>/index.md plus files grouped under
        # the owning module instead of one huge flat files/ directory.
        module_sidebar = SidebarItem(title="模块", page_id="", children=[])
        for i, mod in enumerate(wiki_data.modules):
            module_slug = self._safe_path_segment(mod.name)
            mod_id = f"modules/{module_slug}/index"
            mod_md = self._build_module_page(mod)
            pages.append(WikiPage(
                id=mod_id, title=mod.name, content=mod_md,
                parent_id="modules", order=i,
            ))
            mod_item = SidebarItem(title=mod.name, page_id=mod_id, children=[])
            for file_info in file_pages_by_module.get(mod.name, []):
                file_doc = file_docs_by_path.get(file_info.path)
                file_id = f"modules/{module_slug}/files/{self._page_id_for_path(file_info.path)}"
                pages.append(WikiPage(
                    id=file_id,
                    title=file_info.path,
                    content=self._build_file_page(file_info, file_doc, mod.name),
                    parent_id=mod_id,
                    order=10_000 + len(pages),
                ))
                mod_item.children.append(SidebarItem(title=file_info.path, page_id=file_id))
            module_sidebar.children.append(mod_item)
        if module_sidebar.children:
            sidebar.append(module_sidebar)

        # 5. reading guide
        guide = wiki_data.reading_guide
        if guide.steps:
            guide_md = self._build_reading_guide_page(guide)
            pages.append(WikiPage(id="reading-guide", title="阅读指南", content=guide_md, order=10))
            sidebar.append(SidebarItem(title="阅读指南", page_id="reading-guide"))

        # 6. dependency graph
        mermaid = graph.to_mermaid()
        if mermaid:
            dep_md = self._build_dependency_page(graph, mermaid)
            pages.append(WikiPage(id="dependencies", title="依赖关系", content=dep_md, order=11))
            sidebar.append(SidebarItem(title="依赖关系", page_id="dependencies"))

        return Wiki(pages=pages, sidebar=sidebar, project_name=project.name)

    def _module_for_path(self, path: str) -> str:
        classified = self._classify_feature_module(path)
        if classified:
            return classified
        parts = Path(path).parts
        if len(parts) <= 1:
            return "root"
        module = parts[0]
        if module in ("src", "lib", "pkg", "internal", "app") and len(parts) > 2:
            module = parts[1]
        return module

    def _classify_feature_module(self, path: str) -> str:
        normalized = path.replace("\\", "/")
        lower = normalized.lower()
        if "/knowledge/" in lower or "knowledgepanel" in lower:
            if "knowledgepanel" in lower or "/src/ui/" in lower:
                return "knowledge-ui"
            return "knowledge-engine"
        if "/mcp-tools/" in lower or "builtin-mcp" in lower or "modelcontextprotocol" in lower:
            return "mcp-tools"
        if "runner" in lower or normalized in {"src/electron/main.ts", "src/electron/preload.ts"}:
            return "electron-runtime"
        if lower.startswith("src/ui/"):
            return "ui-shell"
        if "git" in lower:
            return "git-workbench"
        if "task" in lower or "cron" in lower:
            return "task-engine"
        if "session" in lower or "conversation" in lower:
            return "session-engine"
        if lower.startswith("scripts/"):
            return "scripts"
        return ""

    def _score_file(self, file: FileInfo, rank_lookup: dict[str, float]) -> float:
        score = rank_lookup.get(file.path, 0.0) * 1000
        normalized = file.path.replace("\\", "/").lower()
        if normalized.startswith("src/"):
            score += 120
        if normalized.startswith("scripts/"):
            score += 30
        if normalized.startswith("doc/") or normalized.startswith("docs/"):
            score -= 60
        if normalized.startswith("test/"):
            score -= 35
        if file.is_entrypoint:
            score += 60
        if file.is_config:
            score += 45
        score += min(len(file.symbols), 20) * 2
        score += min(len(file.signals), 20) * 3
        if re.search(r"(knowledge|mcp|runner|main|ipc|store|repository|panel|electron|config|task|session)", file.path, re.I):
            score += 18
        if file.language in {"typescript", "tsx", "javascript", "python", "go", "rust", "java"}:
            score += 8
        return score

    def _select_file_pages(self, project: ProjectContext, graph: DependencyGraph) -> dict[str, list[FileInfo]]:
        rank_lookup = dict(graph.rank_files())
        candidates = sorted(
            project.files,
            key=lambda file: (-self._score_file(file, rank_lookup), file.path),
        )
        if self.file_page_limit is not None:
            candidates = candidates[: self.file_page_limit]
        by_module: dict[str, list[FileInfo]] = {}
        for file in candidates:
            by_module.setdefault(self._module_for_path(file.path), []).append(file)
        for files in by_module.values():
            files.sort(key=lambda file: (-self._score_file(file, rank_lookup), file.path))
        return by_module

    def _safe_path_segment(self, value: str) -> str:
        safe = re.sub(r"[<>:\"|?*\x00-\x1f]+", "-", value.strip())
        safe = re.sub(r"\s+", "-", safe)
        safe = safe.replace("/", "-").replace("\\", "-").strip(" .-")
        if not safe:
            return "unnamed"
        if re.fullmatch(r"(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])", safe):
            return f"_{safe}"
        return safe

    def _page_id_for_path(self, path: str) -> str:
        normalized = path.replace("\\", "/").strip("/")
        parts = [self._safe_path_segment(part) for part in PurePosixPath(normalized).parts if part not in ("", ".")]
        if parts:
            last = parts[-1]
            lower_last = last.lower()
            if lower_last.endswith(".markdown"):
                parts[-1] = last[:-9] or "index"
            elif lower_last.endswith(".md"):
                parts[-1] = last[:-3] or "index"
        return "/".join(parts) or "file"

    def _format_list(self, values: list[str], limit: int = 24) -> list[str]:
        return [f"- `{value}`" for value in values[:limit]]

    def _preview_snippet(self, file: FileInfo, max_chars: int = 4200) -> str:
        content = file.content or file.preview
        if len(content) <= max_chars:
            return self._sanitize_source_snippet(content)
        return self._sanitize_source_snippet(content[:max_chars].rstrip() + "\n... (truncated)")

    def _sanitize_source_snippet(self, content: str) -> str:
        sanitized = content.replace("<think>", "&lt;think&gt;").replace("</think>", "&lt;/think&gt;")
        placeholder_markers = [
            "后续接入真实",
            "未生成正文",
            "当前没有真实 Repo Wiki 正文",
            "生成后会出现 Repo Wiki 目录",
            "模型未返回结构化说明",
        ]
        for marker in placeholder_markers:
            if marker in sanitized:
                sanitized = sanitized.replace(marker, marker[:1] + "&#8203;" + marker[1:])
        return sanitized

    def _build_file_page(self, file: FileInfo, file_doc: FileDoc | None, module_name: str) -> str:
        lines = [f"# {file.path}\n"]
        lines.append(f"> 模块：`{module_name}` · 语言：`{file.language}` · 行数：{file.lines}\n")

        lines.append("## 文件职责\n")
        purpose = file_doc.purpose if file_doc and file_doc.purpose else ""
        if purpose:
            lines.append(f"{purpose}\n")
        elif file.is_entrypoint:
            lines.append("这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。\n")
        elif file.is_config:
            lines.append("这是配置文件，定义构建、运行、依赖或工具行为。\n")
        else:
            lines.append("此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。\n")

        if file.signals:
            lines.append("## 运行信号\n")
            lines.extend(self._format_list(file.signals, 32))
            lines.append("")

        symbols = [f"{symbol.name}@{symbol.line} - {symbol.description}" for symbol in (file_doc.key_symbols if file_doc else []) if symbol.name]
        if not symbols:
            symbols = file.symbols
        if symbols:
            lines.append("## 关键符号\n")
            lines.extend(self._format_list(symbols, 40))
            lines.append("")

        if file.imports:
            lines.append("## 依赖输入\n")
            lines.extend(self._format_list(file.imports, 32))
            lines.append("")

        if file.exports:
            lines.append("## 对外暴露\n")
            lines.extend(self._format_list(file.exports, 32))
            lines.append("")

        lines.append("## Agent 使用提示\n")
        lines.append("- 修改此文件前，先查看同模块页面和本页的运行信号。")
        lines.append("- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。")
        lines.append("- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。\n")

        snippet = self._preview_snippet(file)
        if snippet.strip():
            lines.append("## 源码摘录\n")
            lines.append(f"```{file.language}\n{snippet}\n```\n")

        return "\n".join(lines)

    def _build_agent_playbook_page(self, project: ProjectContext, graph: DependencyGraph) -> str:
        core_files = graph.get_core_files(18)
        high_signal_files = [
            file for file in project.files
            if file.signals or re.search(r"(knowledge|mcp|runner|ipc|repository|store|panel)", file.path, re.I)
        ][:24]
        lines = ["# Agent 作业手册\n"]
        lines.append("## 为什么知识库功能必须有 embedding 模型\n")
        lines.append("知识库不是普通全文搜索。Repo Wiki Markdown 会被切 chunk、写入 FTS5，并同时写入向量索引；没有 embedding 模型时，Agent 无法可靠做语义召回，所以功能必须保持关闭。\n")
        lines.append("## Agent 如何在聊天里看到知识库\n")
        lines.append("新会话构建 system prompt 时会注入 `<knowledge_overview>`，其中包含 Repo Wiki 标题、路径和记忆摘要。Agent 先看 overview，再通过 MCP 工具读取全文。\n")
        lines.append("## 高价值文件\n")
        for path in core_files:
            lines.append(f"- `{path}`")
        for file in high_signal_files:
            if file.path not in core_files:
                suffix = f"：{', '.join(file.signals[:3])}" if file.signals else ""
                lines.append(f"- `{file.path}`{suffix}")
        lines.append("")
        lines.append("## 验证命令\n")
        lines.append("- `npm run qa:knowledge`")
        lines.append("- `npm run qa:knowledge-ui`")
        lines.append("- `npm run qa:knowledge-chat`")
        lines.append("- `npm run build`\n")
        lines.append("## 改动风险\n")
        lines.append("- Repo Wiki 生成和索引是两条链路：Markdown 写入 `.tech/repowiki`，SQLite/向量索引写入 app data。")
        lines.append("- UI 生成进度必须以后端 DB 和磁盘结果为准，刷新页面不能靠前端假进度恢复。")
        lines.append("- 会话归档或 Git commit 变化触发自动更新时，要绑定 commitId，避免过期知识误导 Agent。\n")
        return "\n".join(lines)

    def _build_runtime_flows_page(self, project: ProjectContext) -> str:
        signal_files = [file for file in project.files if file.signals]
        lines = ["# 关键运行链路\n"]
        lines.append("## Repo Wiki 生成链路\n")
        lines.append("1. Renderer 通过 `knowledge:run-generation` 请求生成。")
        lines.append("2. Electron 后端调用 vendored `he-yufeng/RepoWiki` 引擎生成 Markdown。")
        lines.append("3. `knowledge-indexer` 收集 `.tech/repowiki` 文档，切 chunk、调用 embedding、写入 `knowledge_documents` 和向量表。")
        lines.append("4. 聊天 runner 读取索引 overview，把知识摘要注入 system prompt。\n")
        lines.append("## 从源码提取到的运行信号\n")
        for file in signal_files[:80]:
            lines.append(f"### `{file.path}`\n")
            for signal in file.signals[:12]:
                lines.append(f"- `{signal}`")
            lines.append("")
        if not signal_files:
            lines.append("当前扫描未发现 IPC、MCP 或数据库建表信号。\n")
        return "\n".join(lines)

    def _build_api_surface_page(self, project: ProjectContext) -> str:
        lines = ["# 接口与存储面\n"]
        ipc: list[str] = []
        mcp: list[str] = []
        tables: list[str] = []
        renderer_calls: list[str] = []
        for file in project.files:
            for signal in file.signals:
                entry = f"{signal} ({file.path})"
                if signal.startswith("mcp tool"):
                    mcp.append(entry)
                elif signal.startswith("create table") or signal.startswith("virtual table"):
                    tables.append(entry)
                elif signal.startswith("electron.invoke") or signal.startswith("ipcRenderer.invoke"):
                    renderer_calls.append(entry)
                elif signal.startswith("ipcMain"):
                    ipc.append(entry)

        lines.append("## Renderer 调用\n")
        lines.extend(self._format_list(renderer_calls or ["knowledge:run-generation", "knowledge:list-documents"], 80))
        lines.append("")
        lines.append("## IPC 通道\n")
        lines.extend(self._format_list(ipc or ["knowledge:run-generation"], 80))
        lines.append("")
        lines.append("## MCP Tool\n")
        lines.extend(self._format_list(mcp or ["knowledge_index", "knowledge_search", "knowledge_read", "knowledge_explore"], 80))
        lines.append("")
        lines.append("## SQLite / 向量索引表\n")
        defaults = ["knowledge_documents", "knowledge_chunks", "knowledge_chunks_fts", "knowledge_chunk_vectors"]
        lines.extend(self._format_list(tables or defaults, 80))
        lines.append("")
        lines.append("## Agent 检索建议\n")
        lines.append("- 想定位前后端交互：搜 `knowledge:run-generation` 或 `Renderer 调用`。")
        lines.append("- 想定位 MCP 能力：搜 `MCP Tool`、`knowledge_index`、`knowledge_search`。")
        lines.append("- 想定位索引问题：搜 `knowledge_documents`、`embedding`、`sqlite-vec`。\n")
        return "\n".join(lines)

    def _build_overview_page(self, overview, project) -> str:
        lines = [f"# {overview.name or project.name} 项目概览\n"]
        if overview.one_liner:
            lines.append(f"> {overview.one_liner}\n")
        if overview.description:
            lines.append(f"{overview.description}\n")

        lines.append("## Agent 快速定位\n")
        lines.append("- 先读 `Agent 作业手册`，确认知识库生成、索引和聊天注入链路。")
        lines.append("- 再读 `接口与存储面`，定位 IPC、MCP Tool、SQLite/向量表。")
        lines.append("- 需要改某个功能时，从左侧模块树进入具体文件页，文件页包含源码摘录和运行信号。\n")

        anchor_files = self._select_agent_anchor_files(project)
        if anchor_files:
            lines.append("## Agent 高价值文件\n")
            for file_info in anchor_files:
                hints: list[str] = []
                if file_info.is_entrypoint:
                    hints.append("入口")
                if file_info.signals:
                    hints.append("运行信号")
                if file_info.symbols:
                    hints.append(f"{min(len(file_info.symbols), 99)} 个符号")
                if file_info.imports:
                    hints.append(f"{min(len(file_info.imports), 99)} 个依赖")
                suffix = f" - {'，'.join(hints[:3])}" if hints else ""
                lines.append(f"- `{file_info.path}`{suffix}")
            lines.append("")

        if overview.tech_stack:
            lines.append("## 技术栈\n")
            for t in overview.tech_stack:
                ver = f" {t.version}" if t.version else ""
                cat = f" ({t.category})" if t.category else ""
                lines.append(f"- **{t.name}**{ver}{cat}")
            lines.append("")

        if overview.key_features:
            lines.append("## 关键工作流\n")
            for feat in overview.key_features:
                lines.append(f"- {feat}")
            lines.append("")

        if overview.setup_instructions:
            lines.append("## 快速开始\n")
            for i, step in enumerate(overview.setup_instructions, 1):
                lines.append(f"{i}. {step}")
            lines.append("")

        lines.append("## 验证命令\n")
        lines.append("- `npm run qa:knowledge`")
        lines.append("- `npm run qa:knowledge-ui`")
        lines.append("- `npm run qa:knowledge-chat`\n")

        return "\n".join(lines)

    def _select_agent_anchor_files(self, project, limit: int = 22):
        scored = []
        important_name_terms = {
            "indexer": 18,
            "repository": 16,
            "overview": 14,
            "engine": 12,
            "store": 10,
            "runner": 10,
            "ipc": 10,
            "mcp": 10,
            "settings": 6,
            "types": 4,
        }
        important_path_terms = {
            "knowledge": 10,
            "memory": 8,
            "task": 5,
            "session": 5,
            "git": 4,
        }

        for file_info in project.files:
            path = file_info.path.replace("\\", "/")
            lower_path = path.lower()
            name = lower_path.rsplit("/", 1)[-1]
            score = 0
            if path.startswith("src/"):
                score += 8
            if file_info.is_entrypoint:
                score += 14
            if file_info.is_config:
                score += 4
            score += min(len(file_info.signals), 8) * 5
            score += min(len(file_info.exports), 8) * 2
            score += min(len(file_info.symbols), 12)
            for term, weight in important_name_terms.items():
                if term in name:
                    score += weight
            for term, weight in important_path_terms.items():
                if term in lower_path:
                    score += weight
            if lower_path.startswith(("doc/", "docs/", "test/", "tests/")):
                score -= 20
            if score > 0:
                scored.append((score, path, file_info))

        scored.sort(key=lambda item: (-item[0], item[1]))
        return [item[2] for item in scored[:limit]]

    def _build_architecture_page(self, arch) -> str:
        lines = ["# 架构设计\n"]
        if arch.architecture_type:
            lines.append(f"**类型:** {arch.architecture_type}\n")
        if arch.description:
            lines.append(f"{arch.description}\n")

        if arch.mermaid_component:
            lines.append("## 组件图\n")
            lines.append(f"```mermaid\n{arch.mermaid_component}\n```\n")

        if arch.components:
            lines.append("## 组件\n")
            for c in arch.components:
                lines.append(f"### {c.name}\n")
                if c.purpose:
                    lines.append(f"{c.purpose}\n")
                if c.files:
                    lines.append("文件: " + ", ".join(f"`{f}`" for f in c.files) + "\n")

        if arch.mermaid_sequence:
            lines.append("## 时序图\n")
            lines.append(f"```mermaid\n{arch.mermaid_sequence}\n```\n")

        if arch.data_flow:
            lines.append("## 数据流\n")
            lines.append(f"{arch.data_flow}\n")

        return "\n".join(lines)

    def _build_module_page(self, mod) -> str:
        lines = [f"# {mod.name}\n"]
        if mod.purpose:
            lines.append(f"> {mod.purpose}\n")
        if mod.description:
            lines.append(f"{mod.description}\n")

        if mod.files:
            lines.append("## 文件\n")
            for f in mod.files:
                lines.append(f"### `{f.path}`\n")
                if f.purpose:
                    lines.append(f"{f.purpose}\n")
                if f.key_symbols:
                    for s in f.key_symbols:
                        desc = f" - {s.description}" if s.description else ""
                        lines.append(f"- `{s.name}` ({s.kind}){desc}")
                    lines.append("")

        if mod.key_concepts:
            lines.append("## 关键概念\n")
            for c in mod.key_concepts:
                lines.append(f"- **{c.name}**: {c.explanation}")
            lines.append("")

        if mod.relationships:
            lines.append("## 内部关系\n")
            for r in mod.relationships:
                lines.append(f"- `{r.source}` → `{r.target}`: {r.description}")
            lines.append("")

        if mod.name == "knowledge-engine":
            lines.append("## Agent 关注点\n")
            lines.append("- Repo Wiki 生成由 `generateRepoWiki` 触发，输出 Markdown 到 `.tech/repowiki`。")
            lines.append("- `knowledge-indexer.ts` 负责 Markdown chunk、embedding 调用和索引写入。")
            lines.append("- `KnowledgeRepository` 维护 `knowledge_documents`、`knowledge_chunks`、FTS5 和 sqlite-vec。")
            lines.append("- `knowledge-overview.ts` 将索引摘要注入聊天 system prompt。\n")
        elif mod.name == "mcp-tools":
            lines.append("## Agent 关注点\n")
            lines.append("- MCP Tool 是 Agent 读取知识、搜索知识、刷新索引的入口。")
            lines.append("- 变更工具 schema 后要同步 registry、server factory 和 smoke 测试。\n")

        return "\n".join(lines)

    def _build_reading_guide_page(self, guide) -> str:
        lines = ["# 阅读指南\n"]
        if guide.introduction:
            lines.append(f"{guide.introduction}\n")

        for step in guide.steps:
            time_est = f" (~{step.time_estimate})" if step.time_estimate else ""
            lines.append(f"## 第 {step.order} 步：{step.title}{time_est}\n")
            if step.files:
                lines.append("**文件:** " + ", ".join(f"`{f}`" for f in step.files) + "\n")
            if step.explanation:
                lines.append(f"{step.explanation}\n")

        if guide.tips:
            lines.append("## 提示\n")
            for tip in guide.tips:
                lines.append(f"- {tip}")
            lines.append("")

        return "\n".join(lines)

    def _build_dependency_page(self, graph: DependencyGraph, mermaid: str) -> str:
        lines = ["# 模块依赖关系\n"]
        lines.append("```mermaid\n" + mermaid + "\n```\n")

        # core files
        core = graph.get_core_files(10)
        if core:
            lines.append("## 核心文件（PageRank）\n")
            for i, path in enumerate(core, 1):
                lines.append(f"{i}. `{path}`")
            lines.append("")

        # entry points
        entries = graph.get_entry_points()
        if entries:
            lines.append("## 可能入口\n")
            for e in entries[:10]:
                lines.append(f"- `{e}`")
            lines.append("")

        return "\n".join(lines)
