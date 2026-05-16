# doc/_tools/check_doc_links.py

> 模块：`doc` · 语言：`python` · 行数：290

## 文件职责

坏链检查与孤儿文档检测脚本，验证 Markdown 链接完整性、旧编号体系残留和文档引用关系

## 关键符号

- `should_skip_file@0 - 判断文件是否应跳过收集（跳过 _tools、AionUi 源码镜像）`
- `is_legacy_dir@0 - 判断文件是否属于旧 CLAW 目录（20-specs、30-operations）`
- `collect_md_files@0 - 收集 doc/ 下所有 .md 文件，排除跳过项`
- `extract_markdown_links@0 - 提取文件中所有 Markdown 链接 [text](target)，返回 (行号, 链接文本, 目标)`
- `check_broken_links@0 - 检查跨文档链接断裂`
- `check_orphans@0 - 检查孤儿文档（未被任何 INDEX.md 或 README.md 引用）`
- `check_legacy_numbering@0 - 检查旧编号体系残留（73+ 流水号模式）`
- `main@0 - 命令行入口，支持 --links、--orphans、--legacy、--skip-legacy-dirs 参数`

## 依赖输入

- `argparse`
- `os`
- `re`
- `sys`
- `urllib.parse`
- `collections`
- `pathlib`
- `typing`

## 对外暴露

- `should_skip_file`
- `is_legacy_dir`
- `collect_md_files`
- `decode_url_path`
- `extract_markdown_links`
- `resolve_link_target`
- `check_broken_links`
- `build_reference_graph`
- `check_orphans`
- `check_legacy_numbering`
- `report_broken_links`
- `report_orphans`
- `report_legacy`
- `main`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```python
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
        for lineno, text, target
... (truncated)
```
