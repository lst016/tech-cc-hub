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
            print(f"[FAIL] {path.relative_to(ROOT)}")
            for err in errors:
                print(f"  - {err}")

    if failures:
        print(f"\nValidation failed: {failures} file(s) with issues.")
        return 1

    print(f"Validation passed: {len(files)} markdown file(s) checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
