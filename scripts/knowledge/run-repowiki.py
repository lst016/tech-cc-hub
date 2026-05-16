#!/usr/bin/env python3
"""adapter for the vendored he-yufeng/RepoWiki engine."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import sys
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


ROOT = _repo_root()
REPOWIKI_SRC = ROOT / "third_party" / "repowiki" / "src"
sys.path.insert(0, str(REPOWIKI_SRC))

from repowiki.core.analyzer import Analyzer  # noqa: E402
from repowiki.core.cache import Cache  # noqa: E402
from repowiki.core.graph import DependencyGraph  # noqa: E402
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
        files.append(str(path.relative_to(workspace)))
    return files


async def _run(args: argparse.Namespace) -> dict:
    workspace = Path(args.workspace).resolve()
    output_dir = Path(args.output).resolve()
    cache_path = Path(args.cache).resolve()

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
    parser.add_argument("--model", required=True)
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--api-base", default="")
    parser.add_argument("--language", default="zh")
    parser.add_argument("--concurrency", type=int, default=3)
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
