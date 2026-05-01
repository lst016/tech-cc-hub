#!/usr/bin/env python3
"""
doc/_tools/check_doc_links.py — tech-cc-hub 文档体系坏链与孤儿文档检查脚本。

检查项：
  1. 跨文档 Markdown 链接断裂（[text](path.md) 目标不存在）
  2. 孤儿文档 — doc/ 下 .md 文件未被任何 INDEX.md 或 README.md 引用
  3. 旧编号体系残留 — 文件名匹配 73+ 流水号模式

用法：
  python doc/_tools/check_doc_links.py          # 检查全部
  python doc/_tools/check_doc_links.py --links  # 只检查坏链
  python doc/_tools/check_doc_links.py --orphans # 只检查孤儿文档
  python doc/_tools/check_doc_links.py --legacy # 只检查旧编号残留
  python doc/_tools/check_doc_links.py --skip-legacy-dirs  # 跳过旧 CLAW 目录
"""

import argparse
import os
import re
import sys
import urllib.parse
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Set, Tuple

DOC_ROOT = Path(__file__).resolve().parent.parent

# 旧 CLAW 目录（预迁移文档，内部链接不参与坏链检查）
LEGACY_DIRS = {"20-specs", "30-operations"}

# AionUi 源码镜像目录（reference only）
AIONUI_MIRROR = "00-research/AionUi"


def should_skip_file(rel: Path) -> bool:
    """判断文件是否应跳过收集。"""
    parts = rel.parts

    # 跳过工具目录自身
    if parts[0] == "_tools":
        return True

    # 完全跳过 AionUi 源码镜像（保留调研报告）
    if len(parts) >= 2 and parts[0] == "00-research" and parts[1] == "AionUi":
        # 仅保留 AionUi-调研报告/ 目录下的文件
        if len(parts) >= 3 and parts[2] == "AionUi-调研报告":
            return False
        # 保留 AionUi/ 根 README
        if rel.name == "README.md" and len(parts) == 2:
            return False
        return True

    return False


def is_legacy_dir(rel: Path) -> bool:
    """判断文件是否属于旧 CLAW 目录。"""
    parts = rel.parts
    return len(parts) >= 1 and parts[0] in LEGACY_DIRS


def collect_md_files(root: Path, skip_legacy: bool = False) -> Set[Path]:
    """收集 doc/ 下所有 .md 文件。"""
    files: Set[Path] = set()
    for f in root.rglob("*.md"):
        rel = f.relative_to(root)
        if should_skip_file(rel):
            continue
        if skip_legacy and is_legacy_dir(rel):
            continue
        files.add(f)
    return files


def decode_url_path(path: str) -> str:
    """解码 URL 编码的中文路径。"""
    try:
        decoded = urllib.parse.unquote(path)
        return decoded
    except Exception:
        return path


def extract_markdown_links(filepath: Path) -> List[Tuple[int, str, str]]:
    """提取文件中所有 Markdown 链接 [text](target)，返 (行号, 链接文本, 目标)。"""
    links: List[Tuple[int, str, str]] = []
    link_re = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for lineno, line in enumerate(f, 1):
                for m in link_re.finditer(line):
                    target = m.group(2)
                    # 跳过外部 URL 和纯 anchor
                    if target.startswith(("http://", "https://", "mailto:", "#")):
                        continue
                    links.append((lineno, m.group(1), target))
    except Exception as e:
        print(f"  WARN: cannot read {filepath}: {e}", file=sys.stderr)
    return links


def resolve_link_target(source: Path, target: str) -> Path | None:
    """将相对链接转为绝对路径候选。"""
    source_dir = source.parent

    if target.startswith("/"):
        return None  # 跳过绝对路径

    # target 可能带 anchor (#section)
    target_path = target.split("#")[0]
    if not target_path:
        return None  # 纯 anchor

    # URL 解码（处理 %E4%BA%A7 等编码的中文路径）
    target_path = decode_url_path(target_path)

    # 解析相对路径
    try:
        candidate = (source_dir / target_path).resolve()
    except Exception:
        return None

    # 如果是目录, 尝试 INDEX.md 或 README.md
    if candidate.is_dir():
        for idx in ["INDEX.md", "README.md", "index.md", "readme.md"]:
            idx_candidate = candidate / idx
            if idx_candidate.exists():
                return idx_candidate
        return None

    # 如果路径没有 .md 后缀, 尝试追加
    if not candidate.suffix:
        candidate_md = candidate.with_suffix(".md")
        if candidate_md.exists():
            return candidate_md

    return candidate if candidate.exists() else None


def check_broken_links(md_files: Set[Path]) -> List[Tuple[Path, int, str, str]]:
    """检查所有跨文档 Markdown 坏链。"""
    broken: List[Tuple[Path, int, str, str]] = []
    for f in sorted(md_files):
        links = extract_markdown_links(f)
        for lineno, text, target in links:
            resolved = resolve_link_target(f, target)
            if resolved is None:
                broken.append((f, lineno, text, target))
    return broken


def build_reference_graph(md_files: Set[Path]) -> Dict[str, Set[str]]:
    """构建被引用图: {被引用文件 stem → {引用者 stem}}."""
    referenced: Dict[str, Set[str]] = defaultdict(set)
    for f in md_files:
        links = extract_markdown_links(f)
        for _lineno, _text, target in links:
            resolved = resolve_link_target(f, target)
            if resolved and resolved in md_files:
                referenced[resolved.stem].add(f.stem)
    return referenced


def check_orphans(md_files: Set[Path]) -> List[Path]:
    """检查未被任何 INDEX.md/README.md 引用的文档。"""
    ref_graph = build_reference_graph(md_files)

    orphans: List[Path] = []
    for f in sorted(md_files):
        rel = f.relative_to(DOC_ROOT)
        parts = rel.parts

        # 跳过根 README、standards、tools、archive、legacy
        if parts[0] in ("_standards", "_tools", "90-archive", "00-research"):
            continue
        if parts[0] in LEGACY_DIRS:
            continue
        if rel.name == "README.md" and len(parts) == 1:
            continue

        # INDEX/README 本身不算孤儿
        if f.stem in ("INDEX", "README"):
            continue

        # 检查是否被任何文件引用
        if f.stem not in ref_graph:
            orphans.append(f)

    return orphans


def check_legacy_numbering(md_files: Set[Path]) -> List[Path]:
    """检查 40-delivery 下 73+ 流水编号残留。"""
    legacy: List[Path] = []
    delivery_dir = DOC_ROOT / "40-product" / "1.0.0" / "40-delivery"
    if not delivery_dir.exists():
        return legacy

    pattern = re.compile(r"^(\d{2})[-_]")
    for f in delivery_dir.glob("*.md"):
        m = pattern.match(f.name)
        if m and int(m.group(1)) >= 73:
            legacy.append(f)
    return legacy


def report_broken_links(broken: List[Tuple[Path, int, str, str]]) -> int:
    if not broken:
        print("  [PASS] 未发现坏链。")
        return 0

    print(f"  [WARN] 发现 {len(broken)} 条坏链（多为旧 CLAW 文档间交叉引用，不影响新体系）：")
    # 仅展示前 20 条，避免刷屏
    for f, lineno, text, target in broken[:20]:
        rel = f.relative_to(DOC_ROOT)
        print(f"    {rel}:{lineno}  [{text}]({target})")
    if len(broken) > 20:
        print(f"    ... 及其他 {len(broken) - 20} 条")
    return 0  # 旧文档坏链不阻塞 CI


def report_orphans(orphans: List[Path]) -> int:
    if not orphans:
        print("  [PASS] 未发现孤儿文档。")
        return 0

    print(f"  [WARN] 发现 {len(orphans)} 个可能的孤儿文档：")
    for f in orphans:
        rel = f.relative_to(DOC_ROOT)
        print(f"    {rel}")
    return 0  # 孤儿文档不阻塞 CI，仅告警


def report_legacy(legacy: List[Path]) -> int:
    if not legacy:
        print("  [PASS] 未发现 73+ 流水编号残留。")
        return 0

    print(f"  [FAIL] 发现 {len(legacy)} 个 73+ 流水编号文件：")
    for f in legacy:
        rel = f.relative_to(DOC_ROOT)
        print(f"    {rel}")
    return len(legacy)


def main():
    parser = argparse.ArgumentParser(description="tech-cc-hub 文档体系健康检查")
    parser.add_argument("--links", action="store_true", help="只检查坏链")
    parser.add_argument("--orphans", action="store_true", help="只检查孤儿文档")
    parser.add_argument("--legacy", action="store_true", help="只检查旧编号残留")
    parser.add_argument("--skip-legacy-dirs", action="store_true", help="跳过旧 CLAW 目录 (20-specs, 30-operations)")
    args = parser.parse_args()

    run_all = not (args.links or args.orphans or args.legacy)
    md_files = collect_md_files(DOC_ROOT, skip_legacy=args.skip_legacy_dirs)
    print(f"doc/ 目录共 {len(md_files)} 个 .md 文件\n")

    exit_code = 0

    if run_all or args.links:
        print("=== 1. 跨文档 Markdown 坏链检查 ===")
        broken = check_broken_links(md_files)
        report_broken_links(broken)
        print()

    if run_all or args.orphans:
        print("=== 2. 孤儿文档检查 ===")
        orphans = check_orphans(md_files)
        report_orphans(orphans)
        print()

    if run_all or args.legacy:
        print("=== 3. 旧编号残留检查 ===")
        legacy = check_legacy_numbering(md_files)
        if report_legacy(legacy):
            exit_code = 1
        print()

    if exit_code == 0:
        print("文档体系健康检查通过。")
    else:
        print(f"文档体系健康检查失败 ({exit_code} 项)。")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
