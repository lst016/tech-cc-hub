#!/usr/bin/env python3
"""adapter for the vendored he-yufeng/RepoWiki engine."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


ROOT = _repo_root()
REPOWIKI_SRC = ROOT / "third_party" / "repowiki" / "src"
sys.path.insert(0, str(REPOWIKI_SRC))

from repowiki.core.analyzer import Analyzer  # noqa: E402
from repowiki.core.cache import Cache  # noqa: E402
from repowiki.core.graph import DependencyGraph  # noqa: E402
from repowiki.core.models import FileInfo  # noqa: E402
from repowiki.core.wiki_builder import WikiBuilder  # noqa: E402
from repowiki.export.markdown import export_markdown  # noqa: E402
from repowiki.ingest.local import ingest_local  # noqa: E402
from repowiki.llm.client import LLMClient  # noqa: E402


def _normalize_model(model: str, api_base: str) -> str:
    if not model:
        return model
    if "/" in model:
        return model
    if api_base:
        return f"openai/{model}"
    return model


def _collect_markdown(output_dir: Path, workspace: Path) -> list[str]:
    files: list[str] = []
    if not output_dir.exists():
        return files
    for path in sorted(output_dir.rglob("*.md")):
        try:
            files.append(str(path.relative_to(workspace)))
        except ValueError:
            files.append(str(path))
    return files


def _slugify_title(title: str) -> str:
    cleaned = re.sub(r"[\\/:*?\"<>|]+", "-", title).strip().strip(".")
    return cleaned or "未命名文档"


def _strip_json_fence(text: str) -> str:
    stripped = text.strip()
    stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
    stripped = re.sub(r"\s*```$", "", stripped)
    return stripped.strip()


def _extract_json(text: str) -> object | None:
    cleaned = _strip_json_fence(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    start_candidates = [pos for pos in (cleaned.find("{"), cleaned.find("[")) if pos >= 0]
    if not start_candidates:
        return None
    start = min(start_candidates)
    for end in range(len(cleaned), start, -1):
        try:
            return json.loads(cleaned[start:end])
        except json.JSONDecodeError:
            continue
    return None


async def _complete_with_retries(
    llm: LLMClient,
    messages: list[dict],
    *,
    temperature: float,
    max_tokens: int,
    attempts: int = 3,
) -> str:
    last_text = ""
    for attempt in range(1, max(1, attempts) + 1):
        text = await llm.complete(messages, temperature=temperature, max_tokens=max_tokens)
        last_text = text.strip()
        if last_text and not last_text.startswith("[LLM Error:"):
            return text
        if attempt < attempts:
            await asyncio.sleep(min(8, 2 ** (attempt - 1)))
    raise RuntimeError(last_text or "LLM returned empty content")


def _hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf8")).hexdigest()


def _is_documentable_file(file: FileInfo) -> bool:
    path = file.path.replace("\\", "/")
    lower = path.lower()
    if lower.startswith((
        ".git/",
        ".tech/",
        ".qoder/",
        ".venv/",
        "node_modules/",
        "dist/",
        "dist-react/",
        "dist-electron/",
        "build/",
        "coverage/",
        "tmp/",
        "third_party/",
    )):
        return False
    if lower.endswith((
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
        ".lock", ".sqlite", ".db", ".wasm", ".ttf", ".otf",
    )):
        return False
    return True


def _project_source_hash(project) -> str:
    parts: list[str] = []
    for file in sorted([item for item in project.files if _is_documentable_file(item)], key=lambda item: item.path):
        parts.append(f"{file.path}\0{file.lines}\0{_hash_text(file.content or file.preview or '')}")
    return _hash_text("\n".join(parts))


def _file_rank_lookup(graph: DependencyGraph) -> dict[str, float]:
    try:
        return {path: score for path, score in graph.rank_files()}
    except Exception:
        return {}


def _rank_file(file: FileInfo, rank_lookup: dict[str, float]) -> float:
    score = rank_lookup.get(file.path, 0.0) * 1000
    path = file.path.replace("\\", "/").lower()
    if file.is_entrypoint:
        score += 200
    if file.is_config:
        score += 90
    if path.startswith(("src/", "app/", "lib/", "scripts/")):
        score += 60
    if path.endswith(("readme.md", "package.json", "pyproject.toml", "dockerfile", "dockerfile.base")):
        score += 120
    if "/test" in path or path.startswith("test/"):
        score -= 25
    return score


def _key_file_summary(project, graph: DependencyGraph, limit: int = 80) -> str:
    rank_lookup = _file_rank_lookup(graph)
    files = sorted(
        [file for file in project.files if _is_documentable_file(file)],
        key=lambda item: _rank_file(item, rank_lookup),
        reverse=True,
    )[:limit]
    lines: list[str] = []
    for file in files:
        hints: list[str] = []
        if file.is_entrypoint:
            hints.append("entrypoint")
        if file.is_config:
            hints.append("config")
        if file.symbols:
            hints.append("symbols=" + ", ".join(file.symbols[:8]))
        if file.imports:
            hints.append("imports=" + ", ".join(file.imports[:5]))
        hint_text = f" | {'; '.join(hints)}" if hints else ""
        lines.append(f"- {file.path} ({file.language}, {file.lines} lines){hint_text}")
    return "\n".join(lines)


def _fallback_catalogs(project, graph: DependencyGraph) -> list[dict]:
    paths = {file.path.replace("\\", "/").lower() for file in project.files}
    catalogs: list[dict] = [
        {
            "name": "项目概述",
            "description": "project-overview",
            "prompt": f"为 {project.name} 创建项目概述，解释项目目标、核心能力、技术栈、运行边界和主要使用场景。",
            "dependent_files": ["README.md", "package.json", "pyproject.toml"],
            "order": 0,
        },
        {
            "name": "快速开始",
            "description": "quick-start",
            "prompt": "创建快速开始指南，覆盖安装、配置、启动、验证和常见初始化问题。",
            "dependent_files": ["README.md", "package.json", "scripts/"],
            "order": 1,
        },
        {
            "name": "核心架构设计",
            "description": "core-architecture",
            "prompt": "创建核心架构文档，解释进程边界、模块职责、数据流、关键技术决策和扩展点。",
            "dependent_files": ["src/", "README.md"],
            "order": 2,
        },
        {
            "name": "API参考文档",
            "description": "api-reference",
            "prompt": "创建面向开发和 Agent 调用的 API/IPC/MCP/命令参考，说明入口、参数、返回值和调用链。",
            "dependent_files": ["src/", "scripts/"],
            "order": 8,
        },
        {
            "name": "故障排除和最佳实践",
            "description": "troubleshooting-best-practices",
            "prompt": "整理常见故障、调试路径、日志位置、运行验证方式和工程最佳实践。",
            "dependent_files": ["README.md", "scripts/", "test/"],
            "order": 9,
        },
    ]
    if any(path.startswith("src/ui/") for path in paths):
        catalogs.append({
            "name": "前端界面架构",
            "description": "frontend-ui",
            "prompt": "说明前端 UI 结构、关键组件、状态管理、IPC 调用方式、页面布局和交互流。",
            "dependent_files": ["src/ui/"],
            "parent": "核心架构设计",
            "order": 3,
        })
    if any(path.startswith("src/electron/") for path in paths):
        catalogs.append({
            "name": "Electron运行时和后端服务",
            "description": "electron-runtime",
            "prompt": "说明 Electron 主进程、IPC handler、本地存储、后台任务和系统服务集成方式。",
            "dependent_files": ["src/electron/"],
            "parent": "核心架构设计",
            "order": 4,
        })
    if any("knowledge" in path for path in paths):
        catalogs.append({
            "name": "知识库和Repo Wiki系统",
            "description": "knowledge-engine",
            "prompt": "详细说明知识库、Repo Wiki 生成、向量索引、Memory、MCP 工具和聊天注入链路。",
            "dependent_files": ["src/electron/libs/knowledge/", "src/ui/components/KnowledgePanel.tsx", "scripts/knowledge/"],
            "parent": "核心架构设计",
            "order": 5,
        })
    if any("mcp" in path for path in paths):
        catalogs.append({
            "name": "MCP工具系统",
            "description": "mcp-tools",
            "prompt": "说明内置 MCP Server、工具注册、调用协议、权限边界和新增工具的扩展方式。",
            "dependent_files": ["src/electron/libs/mcp-tools/", "src/shared/builtin-mcp-registry.ts"],
            "parent": "核心架构设计",
            "order": 6,
        })
    if any("task" in path or "cron" in path for path in paths):
        catalogs.append({
            "name": "任务和调度系统",
            "description": "task-scheduling",
            "prompt": "说明任务模型、定时任务、执行器、状态流转、UI 面板和失败处理。",
            "dependent_files": ["src/electron/libs/task/", "src/electron/libs/cron", "src/ui/components/TaskPanel.tsx"],
            "parent": "核心架构设计",
            "order": 7,
        })
    return sorted(catalogs, key=lambda item: int(item.get("order", 100)))


def _target_catalog_count(project) -> int:
    try:
        requested = int(os.getenv("TECH_CC_HUB_REPOWIKI_TARGET_PAGES", "48"))
    except ValueError:
        requested = 48
    # Keep tiny repositories from getting nonsense pages while making real app
    # repos deep enough for humans and Agents to use as an implementation map.
    upper = max(18, min(96, len(project.files) + 8))
    return max(18, min(upper, requested))


def _module_for_path(path: str) -> str:
    normalized = path.replace("\\", "/")
    lower = normalized.lower()
    if "/knowledge/" in lower or "repowiki" in lower or "knowledgepanel" in lower:
        if lower.startswith("src/ui/") or "knowledgepanel" in lower:
            return "knowledge-ui"
        return "knowledge-engine"
    if "/mcp-tools/" in lower or "builtin-mcp" in lower or "modelcontextprotocol" in lower:
        return "mcp-tools"
    if "runner" in lower or normalized in {"src/electron/main.ts", "src/electron/preload.ts", "src/electron/preload.cts"}:
        return "electron-runtime"
    if lower.startswith("src/ui/components/git/") or "git" in lower:
        return "git-workbench"
    if "task" in lower or "cron" in lower:
        return "task-engine"
    if "session" in lower or "conversation" in lower:
        return "session-engine"
    if "skill" in lower or "plugin" in lower:
        return "skill-plugin-system"
    if lower.startswith("src/ui/"):
        return "ui-shell"
    if lower.startswith("src/electron/"):
        return "electron-main"
    if lower.startswith("src/shared/"):
        return "shared-contracts"
    if lower.startswith("scripts/"):
        return "scripts"
    if lower.startswith("test/") or "/test/" in lower:
        return "tests"
    if lower.startswith("doc/") or lower.startswith("docs/"):
        return "docs"
    parts = [part for part in normalized.split("/") if part]
    if len(parts) <= 1:
        return "root"
    if len(parts) >= 2 and parts[0] in {"src", "lib", "app", "packages"}:
        return parts[1]
    return parts[0] if parts else "root"


def _module_title(module: str) -> str:
    names = {
        "knowledge-engine": "知识库后端引擎",
        "knowledge-ui": "知识库前端交互",
        "mcp-tools": "MCP 工具系统",
        "electron-runtime": "Electron 运行时",
        "electron-main": "Electron 主进程服务",
        "ui-shell": "前端 Shell 与组件",
        "settings-ui": "设置中心",
        "git-workbench": "Git 工作台",
        "task-engine": "任务与调度系统",
        "session-engine": "会话与历史系统",
        "skill-plugin-system": "技能与插件系统",
        "shared-contracts": "共享协议与类型",
        "scripts": "工程脚本",
        "tests": "测试体系",
        "docs": "产品与工程文档",
        "root": "项目根配置",
        "pro-workflow": "Pro Workflow 自动化",
        "package": "发布包与分发配置",
    }
    return names.get(module, module.replace("-", " ").replace("_", " ").strip().title())


def _module_priority(module: str) -> int:
    priorities = {
        "knowledge-engine": 120,
        "knowledge-ui": 118,
        "mcp-tools": 112,
        "electron-runtime": 108,
        "electron-main": 106,
        "ui-shell": 102,
        "settings-ui": 98,
        "task-engine": 94,
        "session-engine": 92,
        "git-workbench": 90,
        "skill-plugin-system": 84,
        "shared-contracts": 80,
        "common": 76,
        "scripts": 62,
        "pro-workflow": 58,
        "tests": 44,
        "docs": 38,
        "package": 28,
        "root": 20,
    }
    return priorities.get(module, 50)


def _humanize_stem(value: str) -> str:
    words = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", value)
    words = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fa5]+", " ", words).strip()
    return words or value


def _topic_title_for_file(file: FileInfo, module: str) -> str:
    path = file.path.replace("\\", "/")
    lower = path.lower()
    stem = Path(path).stem
    mappings = [
        (r"knowledge-indexer", "知识索引与向量写入"),
        (r"knowledge-repository", "知识库 SQLite 与检索仓储"),
        (r"knowledge-overview", "聊天上下文知识注入"),
        (r"knowledge-ui-store", "知识库 UI 状态持久化"),
        (r"agent-cards", "Agent Knowledge Cards"),
        (r"mcp-tools/knowledge", "知识库 MCP 工具"),
        (r"repowiki/engine", "Repo Wiki 生成器适配"),
        (r"run-repowiki", "Repo Wiki Python Runner"),
        (r"KnowledgePanel", "知识库面板交互"),
        (r"runner", "会话 Runner 执行链路"),
        (r"main", "Electron IPC 与主进程入口"),
        (r"preload", "预加载桥接层"),
        (r"cron", "定时任务调度链路"),
        (r"task", "任务执行与状态流转"),
        (r"session", "会话生命周期"),
        (r"git", "Git 状态与工作台交互"),
        (r"settings", "设置页与配置读写"),
        (r"plugin", "插件能力接入"),
        (r"skill", "技能管理链路"),
        (r"model", "模型配置与路由"),
        (r"channel", "通道配置与桥接"),
        (r"preview", "预览工作台"),
        (r"browser", "浏览器工作台"),
        (r"activity", "活动轨与诊断面板"),
        (r"memory", "Memory 记忆系统"),
    ]
    for pattern, title in mappings:
        if re.search(pattern, path, re.I):
            return title
    stem_label = _humanize_stem(stem)
    if stem_label.lower() not in {"index", "main", "types", "utils", "helpers"}:
        return f"{_module_title(module)}：{stem_label}"
    generic_symbols = {"data", "input", "path", "fs", "os", "log", "run", "main", "index"}
    symbol = ""
    for candidate in file.symbols[:5]:
        cleaned = candidate.split("@", 1)[0].strip()
        if cleaned and cleaned.lower() not in generic_symbols:
            symbol = cleaned
            break
    label = _humanize_stem(symbol or stem)
    return f"{_module_title(module)}：{label}"


def _catalog_name_exists(catalogs: list[dict], name: str) -> bool:
    return any(str(item.get("name") or "") == name for item in catalogs)


def _add_catalog(catalogs: list[dict], catalog: dict) -> None:
    name = str(catalog.get("name") or "").strip()
    if not name or _catalog_name_exists(catalogs, name):
        return
    catalogs.append(catalog)


def _catalog_parent_depths(catalogs: list[dict]) -> dict[str, int]:
    by_name = {str(catalog.get("name") or ""): catalog for catalog in catalogs if str(catalog.get("name") or "")}
    depths: dict[str, int] = {}

    def depth_for(catalog: dict) -> int:
        name = str(catalog.get("name") or "")
        if name in depths:
            return depths[name]
        depth = 0
        seen = {name}
        parent = str(catalog.get("parent") or "").strip()
        while parent and parent in by_name and parent not in seen:
            depth += 1
            seen.add(parent)
            parent = str(by_name[parent].get("parent") or "").strip()
        depths[name] = depth
        return depth

    for catalog in catalogs:
        depth_for(catalog)
    return depths


def _max_catalog_parent_depth(catalogs: list[dict]) -> int:
    depths = _catalog_parent_depths(catalogs)
    return max(depths.values(), default=0)


def _expand_catalogs_from_source(project, graph: DependencyGraph, catalogs: list[dict], *, force_nested: bool = False) -> list[dict]:
    target_count = _target_catalog_count(project)
    if force_nested:
        target_count = max(len(catalogs) + 8, min(72, max(target_count + 12, 56)))
    if len(catalogs) >= target_count and not force_nested:
        return catalogs

    rank_lookup = _file_rank_lookup(graph)
    files = sorted(
        [file for file in project.files if _is_documentable_file(file)],
        key=lambda item: _rank_file(item, rank_lookup),
        reverse=True,
    )
    module_files: dict[str, list[FileInfo]] = {}
    for file in files:
        module = _module_for_path(file.path)
        module_files.setdefault(module, []).append(file)

    important_modules = sorted(
        module_files.keys(),
        key=lambda module: (
            _module_priority(module),
            sum(_rank_file(file, rank_lookup) for file in module_files[module][:20]),
        ),
        reverse=True,
    )

    next_order = max([int(catalog.get("order", index)) for index, catalog in enumerate(catalogs)] or [0]) + 1
    parent_names = {str(catalog.get("name") or "") for catalog in catalogs}
    module_parent = "核心模块规格"
    if module_parent not in parent_names:
        _add_catalog(catalogs, {
            "name": module_parent,
            "description": "core-module-specs",
            "prompt": "按工程模块整理实现入口、职责边界、关键文件、依赖关系、常见改造路径和验证方式。",
            "dependent_files": ["src/", "scripts/", "test/"],
            "parent": "",
            "order": next_order,
        })
        next_order += 1

    reserve_for_topics = 8 if force_nested else 0
    for module in important_modules[:24]:
        if force_nested and len(catalogs) >= target_count - reserve_for_topics:
            break
        if len(catalogs) >= target_count:
            break
        if module == "root" and len(catalogs) > 20:
            continue
        picked = module_files[module][:8]
        if not picked:
            continue
        title = f"{_module_title(module)}总览"
        _add_catalog(catalogs, {
            "name": title,
            "description": f"module-{module}",
            "prompt": (
                f"详细说明 {_module_title(module)} 的职责、入口文件、调用链、数据结构、扩展点、"
                "常见改造路径和验证命令。不要只列文件，要解释每个文件如何协作。"
            ),
            "dependent_files": [file.path for file in picked],
            "parent": module_parent,
            "order": next_order,
        })
        next_order += 1

    for module in important_modules:
        if len(catalogs) >= target_count:
            break
        for file in module_files[module][:6]:
            if len(catalogs) >= target_count:
                break
            lower = file.path.lower()
            if module == "root" or lower.endswith((".md", ".json", ".lock", ".png", ".jpg", ".jpeg", ".gif", ".svg")):
                continue
            title = _topic_title_for_file(file, module)
            if _catalog_name_exists(catalogs, title):
                detail = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fa5]+", " ", Path(file.path).stem).strip()
                title = f"{title}：{detail or Path(file.path).name}"
            if _catalog_name_exists(catalogs, title):
                title = f"{title}（{_catalog_id({'name': file.path})}）"
            _add_catalog(catalogs, {
                "name": title,
                "description": f"topic-{_catalog_id({'name': title})}",
                "prompt": (
                    f"围绕 `{file.path}` 解释 {title}。必须说明入口职责、核心函数或组件、"
                    "它和上下游文件的关系、修改这个功能时的步骤、回归验证方式和常见失败模式。"
                ),
                "dependent_files": [file.path, *file.imports[:6]],
                "parent": f"{_module_title(module)}总览" if _catalog_name_exists(catalogs, f"{_module_title(module)}总览") else module_parent,
                "order": next_order,
            })
            next_order += 1

    return catalogs


def _ensure_required_catalogs(project, graph: DependencyGraph, catalogs: list[dict]) -> list[dict]:
    paths = {file.path.replace("\\", "/").lower() for file in project.files}
    haystack = "\n".join(
        " ".join([
            str(catalog.get("name") or ""),
            str(catalog.get("description") or ""),
            str(catalog.get("prompt") or ""),
        ])
        for catalog in catalogs
    )
    next_order = max([int(catalog.get("order", index)) for index, catalog in enumerate(catalogs)] or [0]) + 1
    parent_names = {str(catalog.get("name") or "") for catalog in catalogs}
    architecture_parent = "系统架构" if "系统架构" in parent_names else ("核心架构设计" if "核心架构设计" in parent_names else "")

    if any("knowledge" in path or "repowiki" in path for path in paths) and not re.search(r"知识库|知识引擎|repo\s*wiki|knowledge\s*engine|knowledge-engine", haystack, re.I):
        catalogs.append({
            "name": "知识库与 Repo Wiki 系统",
            "description": "knowledge-engine-repowiki",
            "prompt": "详细说明内置知识库、Repo Wiki 生成、主题目录规划、Markdown 产物、向量索引、FTS 检索、MCP 工具和聊天注入链路。必须覆盖数据流、关键 IPC、SQLite 表、进度状态、失败恢复和调试入口。",
            "dependent_files": [
                "src/electron/libs/knowledge/",
                "src/electron/libs/mcp-tools/knowledge.ts",
                "src/ui/components/KnowledgePanel.tsx",
                "scripts/knowledge/",
                "scripts/qa/knowledge-engine-smoke.mjs",
                "scripts/qa/knowledge-chat-injection-smoke.mjs",
            ],
            "parent": architecture_parent,
            "order": next_order,
        })

    expanded = _expand_catalogs_from_source(project, graph, catalogs)
    if _max_catalog_parent_depth(expanded) < 2:
        expanded = _expand_catalogs_from_source(project, graph, expanded, force_nested=True)
    return sorted(expanded, key=lambda item: int(item.get("order", 100)))


async def _plan_catalogs(project, graph: DependencyGraph, llm: LLMClient, language: str, cache: Cache | None = None) -> list[dict]:
    source_hash = _project_source_hash(project)
    cache_key = f"qoder-plan:v4:{llm.model}:{language}:{source_hash}"
    cached = await cache.get(cache_key) if cache else None
    if isinstance(cached, list):
        return _ensure_required_catalogs(project, graph, cached)

    prompt = (
        "你是 Qoder Repo Wiki 的目录规划器。请根据代码库生成适合人和 Agent 阅读的 Wiki 目录。\n"
        "要求：\n"
        "- 生成 24 到 48 个目录项，不要停留在顶层概览；要覆盖主要模块和功能入口。\n"
        "- 可以有 6 到 12 个顶层目录，其余作为子页面挂在父目录下。\n"
        "- 目录要按产品/架构/运行链路/配置/接口/故障排除等主题拆分。\n"
        "- 大模块和功能点都可以有 parent 字段，允许形成 2 到 4 层嵌套目录，例如：核心模块规格 / 知识库后端引擎总览 / 知识索引与向量写入。\n"
        "- 每个目录项必须给出 dependent_files，尽量精确到文件或目录。\n"
        "- 每个 prompt 要像写作任务书，明确要解释哪些机制、流程图、代码示例和排障内容。\n"
        "- 标题用中文，避免 00-、01- 这类编号命名。\n\n"
        f"项目名：{project.name}\n\n"
        f"文件树：\n```\n{project.file_tree[:20000]}\n```\n\n"
        f"关键文件：\n{_key_file_summary(project, graph)}\n\n"
        "只输出 JSON 数组，结构如下：\n"
        '[{"name":"项目概述","description":"project-overview","prompt":"写作要求","dependent_files":["README.md"],"parent":"","order":0}]\n'
    )
    if language == "zh":
        system = "请用中文规划。输出必须是合法 JSON，不要 markdown。"
    else:
        system = "Plan in English. Output valid JSON only. No markdown."
    text = await _complete_with_retries(
        llm,
        [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=6000,
    )
    parsed = _extract_json(text)
    if not isinstance(parsed, list):
        repair_prompt = (
            "请把下面内容修复成合法 JSON 数组，只保留目录项。不要输出 markdown，不要解释。\n\n"
            f"{text[:20000]}"
        )
        try:
            repaired = await _complete_with_retries(
                llm,
                [{"role": "system", "content": "只输出合法 JSON。"}, {"role": "user", "content": repair_prompt}],
                temperature=0.0,
                max_tokens=6000,
                attempts=1,
            )
            parsed = _extract_json(repaired)
        except Exception:
            parsed = None
    if not isinstance(parsed, list):
        return _fallback_catalogs(project, graph)

    catalogs: list[dict] = []
    for index, item in enumerate(parsed):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        dependent_files = item.get("dependent_files")
        if isinstance(dependent_files, str):
            dependent_files = [part.strip() for part in dependent_files.split(",") if part.strip()]
        if not isinstance(dependent_files, list):
            dependent_files = []
        catalogs.append({
            "name": name,
            "description": str(item.get("description") or _slugify_title(name)).strip(),
            "prompt": str(item.get("prompt") or f"为 {project.name} 编写 {name} 文档。").strip(),
            "dependent_files": [str(path).strip() for path in dependent_files if str(path).strip()],
            "parent": str(item.get("parent") or "").strip(),
            "order": int(item.get("order") if isinstance(item.get("order"), int) else index),
        })
    planned = _ensure_required_catalogs(project, graph, catalogs or _fallback_catalogs(project, graph))
    if cache:
        await cache.put(cache_key, planned)
    return planned


def _format_source_link(file_path: str) -> str:
    return f"[{file_path}](file://{file_path})"


def _source_lines(file: FileInfo, max_chars: int = 14_000) -> str:
    content = file.content or file.preview or ""
    if len(content) > max_chars:
        content = content[:max_chars].rstrip() + "\n... (truncated)"
    numbered = []
    for index, line in enumerate(content.splitlines(), 1):
        numbered.append(f"{index:>4}: {line}")
    return "\n".join(numbered)


def _select_catalog_files(catalog: dict, project, graph: DependencyGraph, limit: int = 9) -> list[FileInfo]:
    rank_lookup = _file_rank_lookup(graph)
    candidate_files = [file for file in project.files if _is_documentable_file(file)]
    files_by_path = {file.path.replace("\\", "/"): file for file in candidate_files}
    selected: list[FileInfo] = []
    seen: set[str] = set()

    def add(file: FileInfo) -> None:
        if file.path in seen:
            return
        seen.add(file.path)
        selected.append(file)

    dependent = [str(item).replace("\\", "/").strip() for item in catalog.get("dependent_files", []) if str(item).strip()]
    for dep in dependent:
        normalized = dep.strip("/")
        if normalized in files_by_path:
            add(files_by_path[normalized])
            continue
        prefix = normalized.rstrip("/") + "/"
        matches = [file for path, file in files_by_path.items() if path.startswith(prefix)]
        for file in sorted(matches, key=lambda item: _rank_file(item, rank_lookup), reverse=True)[: max(2, limit // max(1, len(dependent)))]:
            add(file)

    if len(selected) < limit:
        query = " ".join([
            str(catalog.get("name", "")),
            str(catalog.get("description", "")),
            str(catalog.get("prompt", "")),
        ]).lower()
        tokens = [token for token in re.split(r"[^a-z0-9\u4e00-\u9fa5]+", query) if len(token) >= 2]

        def match_score(file: FileInfo) -> float:
            haystack = " ".join([
                file.path,
                file.language,
                " ".join(file.symbols[:20]),
                " ".join(file.signals[:20]),
            ]).lower()
            score = _rank_file(file, rank_lookup)
            for token in tokens:
                if token and token in haystack:
                    score += 100
            return score

        for file in sorted(candidate_files, key=match_score, reverse=True):
            if len(selected) >= limit:
                break
            if match_score(file) <= 0 and selected:
                continue
            add(file)
    return selected[:limit]


async def _generate_catalog_page(
    catalog: dict,
    project,
    graph: DependencyGraph,
    llm: LLMClient,
    language: str,
    cache: Cache | None = None,
) -> str:
    files = _select_catalog_files(catalog, project, graph)
    source_hash = _hash_text("\n".join(
        f"{file.path}\0{file.lines}\0{_hash_text(file.content or file.preview or '')}"
        for file in files
    ))
    prompt_hash = _hash_text(json.dumps(catalog, ensure_ascii=False, sort_keys=True))
    cache_key = f"qoder-page:v3:{llm.model}:{language}:{prompt_hash}:{source_hash}"
    cached = await cache.get(cache_key) if cache else None
    if isinstance(cached, dict) and isinstance(cached.get("page"), str):
        return str(cached["page"])

    cite_lines = "\n".join(f"- {_format_source_link(file.path)}" for file in files)
    code_context_parts = []
    for file in files:
        code_context_parts.append(
            f"## {file.path}\n"
            f"- language: {file.language}\n"
            f"- lines: {file.lines}\n"
            f"- symbols: {', '.join(file.symbols[:20])}\n"
            f"```text\n{_source_lines(file)}\n```"
        )
    code_context = "\n\n".join(code_context_parts)
    prompt = f"""
请为 `{project.name}` 生成一篇 Qoder Repo Wiki 风格的 Markdown 文档。

文档标题：{catalog.get("name")}
写作任务：{catalog.get("prompt")}
目录描述：{catalog.get("description")}

硬性要求：
1. 不要泛泛而谈，必须基于下面给出的真实文件和代码事实。
2. 开头必须包含：
   <cite>
   **本文引用的文件**
   {cite_lines}
   </cite>
3. 必须有“目录”小节，列出 6 到 10 个锚点。
4. 正文要适合人读，也适合 Agent 检索：解释职责、入口、调用链、数据结构、配置、失败模式、扩展点。
5. 至少包含 1 个 Mermaid 图（flowchart、sequenceDiagram 或 classDiagram），除非该主题完全不适合。
6. 关键结论后面要写“章节来源”或“图表来源”，用 `file://path#Lx-Ly` 形式引用来源行。
7. 需要给出实际用法、参数、状态流或排障步骤时，直接列出来。
8. 不要输出 JSON，不要解释你在做什么，只输出 Markdown。
9. 篇幅目标 300 到 650 行，宁愿少而准，不要复制整段源码。

项目文件树：
```text
{project.file_tree[:16000]}
```

参考代码：
{code_context}
""".strip()
    system = "你是资深工程师，正在给新加入项目的开发者和代码 Agent 写内部 Repo Wiki。请用中文，具体、可追溯、可执行。"
    if language != "zh":
        system = "You are a senior engineer writing an internal Repo Wiki for humans and code agents. Be concrete, traceable, and actionable."
    page = await _complete_with_retries(
        llm,
        [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        temperature=0.25,
        max_tokens=8000,
    )
    cleaned = page.strip()
    cleaned = re.sub(r"^```(?:markdown)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    if not cleaned.startswith("#"):
        cleaned = f"# {catalog.get('name')}\n\n{cleaned}"
    if cache:
        await cache.put(cache_key, {
            "page": cleaned,
            "catalog": catalog,
            "source_hash": source_hash,
            "prompt_hash": prompt_hash,
        })
    return cleaned


def _catalog_id(catalog: dict) -> str:
    raw = str(catalog.get("description") or catalog.get("name") or "catalog").strip().lower()
    raw = re.sub(r"[^a-z0-9\u4e00-\u9fa5]+", "-", raw).strip("-")
    return raw or _slugify_title(str(catalog.get("name") or "catalog"))


def _catalog_parent_name(catalog: dict, by_name: dict[str, dict]) -> str:
    parent = str(catalog.get("parent") or "").strip()
    return parent if parent in by_name else ""


def _catalog_ancestor_names(catalog: dict, by_name: dict[str, dict]) -> list[str]:
    ancestors: list[str] = []
    seen = {str(catalog.get("name") or "")}
    current = catalog
    while True:
        parent = _catalog_parent_name(current, by_name)
        if not parent or parent in seen:
            break
        ancestors.insert(0, parent)
        seen.add(parent)
        current = by_name[parent]
    return ancestors


def _catalog_has_children(catalog: dict, children_by_parent: dict[str, list[dict]]) -> bool:
    return bool(children_by_parent.get(str(catalog.get("name") or "")))


def _catalog_section_path(catalog: dict, by_name: dict[str, dict], children_by_parent: dict[str, list[dict]]) -> str:
    ancestors = _catalog_ancestor_names(catalog, by_name)
    name = str(catalog.get("name") or "")
    if _catalog_has_children(catalog, children_by_parent):
        return "/".join([*ancestors, name])
    if ancestors:
        return "/".join(ancestors)
    if re.search(r"项目|快速开始|概述|介绍", name):
        return "项目概述"
    return "Repo Wiki"


def _catalog_relative_path(catalog: dict, by_name: dict[str, dict], children_by_parent: dict[str, list[dict]]) -> str:
    name = str(catalog.get("name"))
    name_slug = _slugify_title(name)
    ancestors = [_slugify_title(ancestor) for ancestor in _catalog_ancestor_names(catalog, by_name)]
    if _catalog_has_children(catalog, children_by_parent):
        return "/".join([*ancestors, name_slug, f"{name_slug}.md"])
    return "/".join([*ancestors, f"{name_slug}.md"]) if ancestors else f"{name_slug}.md"


def _write_catalog_markdown(
    output_dir: Path,
    catalogs: list[dict],
    pages: dict[str, str],
) -> tuple[list[Path], dict]:
    content_dir = output_dir / "content"
    meta_dir = output_dir / "meta"
    page_meta_dir = meta_dir / "pages"
    content_dir.mkdir(parents=True, exist_ok=True)
    meta_dir.mkdir(parents=True, exist_ok=True)
    page_meta_dir.mkdir(parents=True, exist_ok=True)
    by_name = {str(item.get("name")): item for item in catalogs}
    children_by_parent: dict[str, list[dict]] = {}
    for catalog in catalogs:
        parent = _catalog_parent_name(catalog, by_name)
        if parent:
            children_by_parent.setdefault(parent, []).append(catalog)
    for children in children_by_parent.values():
        children.sort(key=lambda item: int(item.get("order", 100)))

    written: list[Path] = []
    sidebar_lines = ["# Repo Wiki\n"]
    wiki_catalogs: list[dict] = []
    relations: list[dict] = []
    generated_at = int(time.time() * 1000)

    for catalog in sorted(catalogs, key=lambda item: int(item.get("order", 100))):
        name = str(catalog.get("name"))
        rel_path = _catalog_relative_path(catalog, by_name, children_by_parent)
        target = content_dir / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(pages[name], encoding="utf8")
        written.append(target)

        catalog_id = _catalog_id(catalog)
        parent_name = _catalog_parent_name(catalog, by_name)
        parent_id = _catalog_id(by_name[parent_name]) if parent_name else ""
        parent_chain = _catalog_ancestor_names(catalog, by_name)
        page_record = {
            "id": catalog_id,
            "name": name,
            "title": name,
            "slug": rel_path[:-3],
            "path": rel_path,
            "description": str(catalog.get("description") or ""),
            "prompt": str(catalog.get("prompt") or ""),
            "dependent_files": catalog.get("dependent_files") or [],
            "parent_id": parent_id,
            "parent": parent_name,
            "parent_chain": parent_chain,
            "section_path": _catalog_section_path(catalog, by_name, children_by_parent),
            "layer_level": len(parent_chain),
            "order": int(catalog.get("order", 100)),
            "status": "completed",
            "page_type": "topic",
            "content_hash": _hash_text(pages[name]),
            "generated_at": generated_at,
        }
        wiki_catalogs.append(page_record)
        (page_meta_dir / f"{catalog_id}.json").write_text(
            json.dumps(page_record, ensure_ascii=False, indent=2) + "\n",
            encoding="utf8",
        )
        if parent_id:
            relations.append({
                "source_id": parent_id,
                "target_id": catalog_id,
                "type": "PARENT_CHILD",
            })

    def write_sidebar(catalog: dict, depth: int) -> None:
        name = str(catalog.get("name"))
        rel_path = _catalog_relative_path(catalog, by_name, children_by_parent)
        sidebar_lines.append(f"{'  ' * depth}- [{name}]({rel_path})\n")
        for child in children_by_parent.get(name, []):
            write_sidebar(child, depth + 1)

    top_catalogs = [
        catalog for catalog in sorted(catalogs, key=lambda item: int(item.get("order", 100)))
        if not _catalog_parent_name(catalog, by_name)
    ]
    for catalog in top_catalogs:
        write_sidebar(catalog, 0)

    (content_dir / "_sidebar.md").write_text("".join(sidebar_lines), encoding="utf8")
    return written, {"wiki_catalogs": wiki_catalogs, "knowledge_relations": relations}


async def _run_qoder_style(args: argparse.Namespace, project, graph: DependencyGraph, llm: LLMClient, output_dir: Path, workspace: Path, cache: Cache | None) -> dict:
    def progress(message: str) -> None:
        print(json.dumps({"event": "progress", "message": message}, ensure_ascii=False), file=sys.stderr, flush=True)

    progress("Planning wiki catalogs...")
    catalogs = await _plan_catalogs(project, graph, llm, args.language, cache)
    progress(f"Analyzing {len(catalogs)} modules...")
    pages: dict[str, str] = {}
    completed = 0
    lock = asyncio.Lock()
    semaphore = asyncio.Semaphore(max(1, args.concurrency))

    async def generate_one(catalog: dict) -> None:
        nonlocal completed
        name = str(catalog.get("name"))
        async with semaphore:
            page = await _generate_catalog_page(catalog, project, graph, llm, args.language, cache)
        async with lock:
            pages[name] = page
            completed += 1
            progress(f"Analyzed module {completed}/{len(catalogs)}")

    failures: list[dict] = []
    results = await asyncio.gather(*(generate_one(catalog) for catalog in catalogs), return_exceptions=True)
    for catalog, result in zip(catalogs, results, strict=False):
        if isinstance(result, Exception):
            name = str(catalog.get("name"))
            failures.append({
                "name": name,
                "error": str(result),
                "dependent_files": catalog.get("dependent_files") or [],
            })
            async with lock:
                completed += 1
                progress(f"Analyzed module {completed}/{len(catalogs)}")
    for catalog in catalogs:
        name = str(catalog.get("name"))
        if name not in pages:
            pages[name] = f"# {name}\n\n生成失败：未获得模型输出。\n"
    progress("Detecting architecture...")
    progress("Creating reading guide...")
    written, catalog_metadata = _write_catalog_markdown(output_dir, catalogs, pages)
    if failures:
        failures_dir = output_dir / "meta" / "failures"
        failures_dir.mkdir(parents=True, exist_ok=True)
        (failures_dir / "pages.json").write_text(
            json.dumps(failures, ensure_ascii=False, indent=2) + "\n",
            encoding="utf8",
        )
    metadata = {
        "generator": "tech-cc-hub qoder-style repowiki",
        "style": "catalog",
        "project": project.name,
        "wiki_catalogs": catalog_metadata["wiki_catalogs"],
        "knowledge_relations": catalog_metadata["knowledge_relations"],
        "failures": failures,
        "pageCount": len(written),
        "tokens": {
            "input": llm.total_input_tokens,
            "output": llm.total_output_tokens,
            "cost": llm.total_cost,
        },
    }
    (output_dir / "meta" / "repowiki-metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf8",
    )
    progress("Done!")
    return {
        "success": True,
        "engine": "tech-cc-hub/qoder-style-repowiki",
        "projectName": project.name,
        "scannedFiles": len(project.files),
        "totalLines": project.total_lines,
        "pageCount": len(written),
        "generatedFiles": _collect_markdown(output_dir, workspace),
        "tokens": metadata["tokens"],
    }


async def _run(args: argparse.Namespace) -> dict:
    workspace = Path(args.workspace).resolve()
    output_dir = Path(args.output).resolve()
    cache_path = Path(args.cache).resolve()
    if not args.model:
        raise ValueError("缺少 Wiki 模型：请传 --model 或设置 TECH_WIKI_MODEL。")
    if not args.api_key:
        raise ValueError("缺少 Wiki API Key：请传 --api-key 或设置 TECH_WIKI_API_KEY。")

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    project = ingest_local(
        workspace,
        max_file_size=args.max_file_size,
        max_files=args.max_files,
    )
    graph = DependencyGraph.build_from_project(project)
    llm = LLMClient(
        model=_normalize_model(args.model, args.api_base),
        api_key=args.api_key,
        api_base=args.api_base,
    )
    cache = Cache(cache_path)
    await cache.init()
    if args.style == "qoder":
        try:
            return await _run_qoder_style(args, project, graph, llm, output_dir, workspace, cache)
        finally:
            await cache.close()

    analyzer = Analyzer(
        llm=llm,
        cache=cache,
        language=args.language,
        concurrency=args.concurrency,
    )

    def on_progress(message: str) -> None:
        print(json.dumps({"event": "progress", "message": message}, ensure_ascii=False), file=sys.stderr, flush=True)

    wiki_data = await analyzer.analyze(project, on_progress=on_progress)
    wiki = WikiBuilder(file_page_limit=args.file_page_limit).build(project, wiki_data, graph)
    export_markdown(wiki, output_dir)
    await cache.close()

    return {
        "success": True,
        "engine": "he-yufeng/RepoWiki",
        "projectName": project.name,
        "scannedFiles": len(project.files),
        "totalLines": project.total_lines,
        "pageCount": len(wiki.pages),
        "generatedFiles": _collect_markdown(output_dir, workspace),
        "tokens": {
            "input": llm.total_input_tokens,
            "output": llm.total_output_tokens,
            "cost": llm.total_cost,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run vendored RepoWiki for a local workspace.")
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--cache", required=True)
    parser.add_argument("--model", default=os.getenv("TECH_WIKI_MODEL", ""))
    parser.add_argument("--api-key", default=os.getenv("TECH_WIKI_API_KEY", ""))
    parser.add_argument("--api-base", default=os.getenv("TECH_WIKI_API_BASE", ""))
    parser.add_argument("--language", default="zh")
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--style", choices=["qoder", "upstream"], default=os.getenv("TECH_CC_HUB_REPOWIKI_STYLE", "qoder"))
    parser.add_argument("--max-files", type=int, default=int(os.getenv("REPOWIKI_MAX_FILES", "0")))
    parser.add_argument("--max-file-size", type=int, default=307200)
    parser.add_argument(
        "--file-page-limit",
        type=int,
        default=int(os.getenv("REPOWIKI_FILE_PAGE_LIMIT", os.getenv("TECH_CC_HUB_REPOWIKI_FILE_PAGE_LIMIT", "0"))),
    )
    args = parser.parse_args()

    try:
        result = asyncio.run(_run(args))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
