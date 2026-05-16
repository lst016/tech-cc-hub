# doc/_tools/validate_frontmatter.py

> 模块：`doc` · 语言：`python` · 行数：178

## 文件职责

Markdown frontmatter 校验脚本，验证 YAML 元数据字段完整性、layer 目录约定匹配、H1 标题一致性

## 关键符号

- `parse_frontmatter@0 - 解析 YAML frontmatter，返回 (data dict, body string)`
- `extract_h1@0 - 从 body 提取第一个 H1 标题`
- `validate_file@0 - 校验单个文件的 frontmatter 完整性、required fields、layer 匹配、title 与 H1 一致性`
- `main@0 - 命令行入口，扫描 doc/ 下 managed roots 并输出校验结果`

## 依赖输入

- `__future__`
- `re`
- `sys`
- `pathlib`

## 对外暴露

- `expected_layer`
- `is_managed_doc`
- `parse_frontmatter`
- `extract_h1`
- `validate_file`
- `main`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```python
#!/usr/bin/env python3
"""
Validate CLAW 1.0.0 markdown front matter.

Checks:
- every markdown file starts with YAML front matter
- required fields exist
- owners/tags are non-empty lists
- version is 1.0.0
- layer matches directory convention
- title matches the first H1 heading
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANAGED_ROOTS = {
    "00-overview",
    "10-architecture",
    "20-specs",
    "30-operations",
    "40-product",
    "_templates",
    "_standards",
    "adr",
}
REQUIRED_FIELDS = {
    "doc_id",
    "title",
    "doc_type",
    "layer",
    "status",
    "version",
    "last_updated",
    "owners",
    "tags",
}


def expected_layer(path: Path) -> str:
    rel = path.relative_to(ROOT)
    head = rel.parts[0]
    if head == "00-overview":
        return "L0"
    if head == "10-architecture":
        return "L1"
    if head == "20-specs":
        return "L2"
    if head == "30-operations":
        return "L3"
    if head == "40-product":
        return "PM"
    if head in {"_templates", "_standards"}:
        return "meta"
    if head == "adr":
        return "adr"
    return "root"


def is_managed_doc(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    if rel.name == "README.md":
        return True
    return rel.parts[0] in MANAGED_ROOTS


def parse_frontmatter(text: str) -> tuple[dict[str, object], str] | tuple[None, str]:
    if not text.startswith("---\n"):
        return None, "missing opening front matter delimiter"

    lines = text.splitlines()
    end = None
    for idx in range(1, len(lines)):
        if lines[idx] == "---":
            end = idx
            break
    if end is None:
        return None, "missing closing front matter delimiter"

    meta_lines = lines[1:end]
    body = "\n".join(lines[end + 1 :])
    data: dict[str, object] = {}
    current_list_key: str | None = None

    for raw in meta_lines:
        if not raw.strip():
            continue
        list_match = re.match(r"^\s*-\s+\"?(.*?)\"?\s*$", raw)
        if list_match and current_list_key:
            data.setdefault(current_list_key, [])
            assert isinstance(data[current_list_key], list)
            data[current_list_key].append(list_match.group(1))
            continue

        key_match = re.match(r"^([A-Za-z0-9_]+):\s*(.*)$", raw)
        if not key_match:
            continue
        key, value = key_match.groups()
        if value == "":
            data[key] = []
            current_list_key = key
        else:
            current_list_key = None
            cleaned = value.strip().strip('"')
            data[key] = cleaned

    return data, body


def extract_h1(body: str) -> str | None:
    match = re.search(r"^#\s+(.+)$", body, flags=re.MULTILINE)
    return match.group(1).strip() if match else None


def validate_file(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    parsed, detail = parse_frontmatter(text)
    if parsed is None:
        return [detail]

    meta = parsed
    errors: list[str] = []

    missing = sorted(REQUIRED_FIELDS - set(meta))
    if missing:
        errors.append(f"missing required fields: {', '.join(missing)}")

    if meta.get("version") != "1.0.0":
        errors.append("version must be '1.0.0'")

    layer = meta.get("layer")
    expected = expected_layer(path)
    if layer != expected:
        errors.append(f"layer mismatch: expected '{expected}', got '{layer}'")

    for field in ("owners", "tags"):
        value = meta.get(field)
        if not isinstance(value, list) or not value:
            errors.append(f"{field} must be a non-empty list")

    heading = extract_h1(detail)
    if heading is None:
        errors.append("missing H1 heading")
    elif meta.get("title") != heading:
        errors.append(
            f"title mismatch: front matter title '{meta.get('title')}' != heading '{heading}'"
        )

    return errors


def main() -> int:
    files = sorted(path for path in ROOT.rglob("*.md") if is_managed_doc(path))
    failures = 0
    for path in files:
        errors = validate_file(path)
        if errors:
            failures += 1
... (truncated)
```
