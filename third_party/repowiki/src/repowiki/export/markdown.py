"""export wiki as a directory of Markdown files."""

from __future__ import annotations

from pathlib import Path

from repowiki.core.wiki_builder import Wiki


def _normalize_markdown(content: str) -> str:
    normalized = "\n".join(line.rstrip() for line in content.splitlines())
    return normalized.rstrip() + "\n"


def export_markdown(wiki: Wiki, output_dir: str | Path) -> None:
    """write each wiki page as a .md file, plus a _sidebar.md for navigation."""
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # write each page
    for page in wiki.pages:
        page_path = out / f"{page.id}.md"
        page_path.parent.mkdir(parents=True, exist_ok=True)
        page_path.write_text(_normalize_markdown(page.content), encoding="utf-8")

    # write sidebar navigation
    sidebar_lines = [f"# {wiki.project_name}\n"]
    for item in wiki.sidebar:
        _write_sidebar_item(sidebar_lines, item, 0)

    sidebar_path = out / "_sidebar.md"
    sidebar_path.write_text("\n".join(sidebar_lines) + "\n", encoding="utf-8")


def _write_sidebar_item(lines: list[str], item, depth: int) -> None:
    indent = "  " * depth
    if item.page_id:
        lines.append(f"{indent}- [{item.title}]({item.page_id}.md)")
    else:
        lines.append(f"{indent}- **{item.title}**")
    for child in item.children:
        _write_sidebar_item(lines, child, depth + 1)
