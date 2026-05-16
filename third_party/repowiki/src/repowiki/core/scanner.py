"""scan a project directory and collect file metadata for analysis."""

from __future__ import annotations

import logging
import os
import re
import fnmatch
from pathlib import Path

from repowiki.core.models import FileInfo

logger = logging.getLogger(__name__)

_SKIP_DIRS = {
    "node_modules", "__pycache__", "venv", "env",
    ".next", "dist", "build", ".tox", ".mypy_cache",
    ".pytest_cache", ".ruff_cache", "egg-info", ".turbo", "coverage",
    ".cache", "vendor", "target", "__snapshots__", ".svn", ".hg",
    ".gradle", ".m2", "Pods", ".dart_tool", ".pub-cache",
    "third_party",
}

_IGNORE_FILES = (".techignore", ".repowikiignore", ".gitignore")

_SKIP_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp",
    ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv", ".flac",
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".dat",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".pyc", ".pyo", ".class", ".o", ".obj",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".db", ".sqlite", ".sqlite3",
    ".lock",
    ".min.js", ".min.css",
    ".map",
    ".wasm",
}

_MINIFIED_SOURCE_EXTS = {".js", ".mjs", ".cjs", ".css"}

_LANG_MAP = {
    ".py": "python", ".pyi": "python",
    ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".ts": "typescript", ".mts": "typescript",
    ".jsx": "jsx", ".tsx": "tsx",
    ".html": "html", ".htm": "html",
    ".css": "css", ".scss": "scss", ".less": "less",
    ".json": "json", ".jsonc": "json",
    ".yaml": "yaml", ".yml": "yaml",
    ".toml": "toml",
    ".md": "markdown", ".mdx": "markdown",
    ".txt": "text", ".rst": "rst",
    ".sh": "shell", ".bash": "shell", ".zsh": "shell",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".kt": "kotlin", ".kts": "kotlin",
    ".scala": "scala",
    ".c": "c", ".h": "c",
    ".cpp": "cpp", ".hpp": "cpp", ".cc": "cpp", ".cxx": "cpp",
    ".cs": "csharp",
    ".rb": "ruby",
    ".php": "php",
    ".r": "r", ".R": "r",
    ".sql": "sql",
    ".swift": "swift",
    ".lua": "lua",
    ".dart": "dart",
    ".vue": "vue",
    ".svelte": "svelte",
    ".zig": "zig",
    ".nim": "nim",
    ".ex": "elixir", ".exs": "elixir",
    ".erl": "erlang",
    ".hs": "haskell",
    ".ml": "ocaml",
    ".clj": "clojure",
    ".proto": "protobuf",
    ".graphql": "graphql", ".gql": "graphql",
    ".tf": "terraform", ".hcl": "hcl",
    ".prisma": "prisma",
    ".astro": "astro",
    ".cfg": "ini", ".ini": "ini",
    ".env": "text",
    ".cmake": "cmake",
    ".gradle": "gradle",
    ".dockerfile": "dockerfile",
}

# files that give the LLM project context -- always read in full
_CONFIG_FILES = {
    "requirements.txt", "setup.py", "setup.cfg", "pyproject.toml",
    "package.json", "Cargo.toml", "go.mod", "go.sum",
    "Makefile", "CMakeLists.txt",
    "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    ".env.example", "config.py", "config.yaml", "config.json", "config.toml",
    "README.md", "README.rst", "README.txt", "README",
    "tsconfig.json", "vite.config.ts", "vite.config.js",
    "webpack.config.js", "rollup.config.js",
    "Gemfile", "build.gradle", "pom.xml",
    ".eslintrc.json", ".prettierrc",
}

# files that are likely entry points
_ENTRYPOINT_NAMES = {
    "main.py", "app.py", "index.py", "server.py", "run.py", "__main__.py",
    "main.go", "main.rs", "main.ts", "main.js",
    "index.ts", "index.js", "index.tsx", "index.jsx",
    "App.tsx", "App.jsx", "App.vue", "App.svelte",
    "manage.py", "wsgi.py", "asgi.py",
}

_ENTRYPOINT_DIRS = {"cmd", "bin", "scripts", "entrypoints"}


def _is_binary(data: bytes) -> bool:
    return b"\x00" in data[:1024]


def _has_skipped_suffix(path: Path) -> bool:
    name = path.name.lower()
    return any(name.endswith(ext) for ext in _SKIP_EXTS)


def _load_ignore_patterns(root: Path) -> list[str]:
    patterns: list[str] = []
    for name in _IGNORE_FILES:
        ignore_file = root / name
        if not ignore_file.exists():
            continue
        try:
            for raw in ignore_file.read_text(encoding="utf-8", errors="replace").splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or line.startswith("!"):
                    continue
                patterns.append(line)
        except OSError:
            continue
    return patterns


def _matches_ignore(rel_path: str, patterns: list[str], is_dir: bool = False) -> bool:
    rel = rel_path.replace(os.sep, "/").strip("/")
    name = rel.rsplit("/", 1)[-1]
    for pattern in patterns:
        normalized = pattern.replace("\\", "/").strip()
        if not normalized:
            continue
        directory_only = normalized.endswith("/")
        normalized = normalized.strip("/")
        if directory_only and not is_dir:
            continue
        if not normalized:
            continue
        if "/" not in normalized:
            parts = rel.split("/")
            if any(fnmatch.fnmatch(part, normalized) for part in parts):
                return True
            if fnmatch.fnmatch(name, normalized):
                return True
            continue
        if rel == normalized or rel.startswith(normalized + "/"):
            return True
        if fnmatch.fnmatch(rel, normalized):
            return True
    return False


def _should_skip_dir(name: str, rel_path: str, ignore_patterns: list[str]) -> bool:
    if name.startswith("."):
        return True
    if name in _SKIP_DIRS or name.endswith(".egg-info"):
        return True
    if name.startswith("dist-") or name.startswith("dist_"):
        return True
    return _matches_ignore(rel_path, ignore_patterns, is_dir=True)


def _looks_minified_source(path: str, text: str) -> bool:
    if Path(path).suffix.lower() not in _MINIFIED_SOURCE_EXTS:
        return False

    lines = text.splitlines() or [text]
    longest = max(len(line) for line in lines)
    if longest < 1000:
        return False

    non_empty = [line for line in lines if line.strip()]
    return len(non_empty) <= 5 or longest > len(text) * 0.5


def detect_language(path: str) -> str:
    name = Path(path).name.lower()
    if name == "dockerfile" or name.startswith("dockerfile."):
        return "dockerfile"
    if name == "makefile":
        return "makefile"
    ext = Path(path).suffix.lower()
    return _LANG_MAP.get(ext, "unknown")


def _is_entrypoint(rel_path: str) -> bool:
    parts = Path(rel_path).parts
    name = parts[-1]
    if name in _ENTRYPOINT_NAMES:
        return True
    if len(parts) >= 2 and parts[-2] in _ENTRYPOINT_DIRS:
        return True
    return False


def build_file_tree(files: list[FileInfo], max_lines: int = 200) -> str:
    """render an ascii tree from the file list, similar to `tree` command."""
    # collect unique directories + files
    entries: set[str] = set()
    for f in files:
        entries.add(f.path)
        parts = Path(f.path).parts
        for i in range(1, len(parts)):
            entries.add(str(Path(*parts[:i])) + "/")

    sorted_entries = sorted(entries)
    lines = []
    for entry in sorted_entries[:max_lines]:
        depth = entry.rstrip("/").count(os.sep)
        indent = "  " * depth
        name = Path(entry.rstrip("/")).name
        if entry.endswith("/"):
            name += "/"
        lines.append(f"{indent}{name}")

    if len(sorted_entries) > max_lines:
        lines.append(f"  ... and {len(sorted_entries) - max_lines} more entries")
    return "\n".join(lines)


def _unique_limited(values: list[str], limit: int = 40) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        clean = value.strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        output.append(clean)
        if len(output) >= limit:
            break
    return output


def _extract_js_ts_metadata(text: str) -> tuple[list[str], list[str], list[str], list[str]]:
    imports: list[str] = []
    exports: list[str] = []
    symbols: list[str] = []
    signals: list[str] = []

    for match in re.finditer(r"^\s*import(?:\s+type)?[\s\S]*?\s+from\s+['\"]([^'\"]+)['\"]", text, re.MULTILINE):
        imports.append(match.group(1))
    for match in re.finditer(r"^\s*import\s*['\"]([^'\"]+)['\"]", text, re.MULTILINE):
        imports.append(match.group(1))
    for match in re.finditer(r"\brequire\(\s*['\"]([^'\"]+)['\"]\s*\)", text):
        imports.append(match.group(1))

    for match in re.finditer(r"^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)", text, re.MULTILINE):
        exports.append(match.group(1))
    for match in re.finditer(r"^\s*export\s*\{([^}]+)\}", text, re.MULTILINE):
        exports.extend(part.strip().split(" as ")[-1].strip() for part in match.group(1).split(","))

    symbol_patterns = [
        r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(",
        r"^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b",
        r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=",
        r"^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)\b",
        r"^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>",
    ]
    for pattern in symbol_patterns:
        for match in re.finditer(pattern, text, re.MULTILINE):
            line = text.count("\n", 0, match.start()) + 1
            symbols.append(f"{match.group(1)}@{line}")

    signal_patterns = [
        ("ipcMain.handle", r"ipcMain\.handle\(\s*['\"]([^'\"]+)['\"]"),
        ("ipcMain.on", r"ipcMain\.on\(\s*['\"]([^'\"]+)['\"]"),
        ("ipcRenderer.invoke", r"ipcRenderer\.invoke\(\s*['\"]([^'\"]+)['\"]"),
        ("electron.invoke", r"\.invoke(?:<[^>]+>)?\(\s*['\"]([^'\"]+)['\"]"),
        ("mcp tool", r"\.tool\(\s*['\"]([^'\"]+)['\"]"),
        ("mcp tool", r"\btool\(\s*['\"]([^'\"]+)['\"]"),
        ("create table", r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][\w]*)"),
        ("virtual table", r"CREATE\s+VIRTUAL\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][\w]*)"),
    ]
    for label, pattern in signal_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            signals.append(f"{label}: {match.group(1)}")

    return (
        _unique_limited(imports, 60),
        _unique_limited(exports, 60),
        _unique_limited(symbols, 80),
        _unique_limited(signals, 80),
    )


def _extract_python_metadata(text: str) -> tuple[list[str], list[str], list[str], list[str]]:
    imports: list[str] = []
    exports: list[str] = []
    symbols: list[str] = []
    signals: list[str] = []

    for match in re.finditer(r"^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))", text, re.MULTILINE):
        imports.append(match.group(1) or match.group(2) or "")
    for match in re.finditer(r"^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(|^\s*class\s+([A-Za-z_]\w*)\b", text, re.MULTILINE):
        name = match.group(1) or match.group(2)
        line = text.count("\n", 0, match.start()) + 1
        symbols.append(f"{name}@{line}")
        if name and not name.startswith("_"):
            exports.append(name)
    for match in re.finditer(r"@(?:click|app|router)\.\w+\(([^)]*)\)", text):
        signals.append(f"decorator: {match.group(0)[:120]}")

    return (
        _unique_limited(imports, 60),
        _unique_limited(exports, 60),
        _unique_limited(symbols, 80),
        _unique_limited(signals, 80),
    )


def extract_file_metadata(language: str, text: str) -> tuple[list[str], list[str], list[str], list[str]]:
    if language in {"javascript", "typescript", "jsx", "tsx"}:
        return _extract_js_ts_metadata(text)
    if language == "python":
        return _extract_python_metadata(text)
    return [], [], [], []


def scan_directory(
    root: str | Path,
    max_file_size: int = 200 * 1024,
    max_files: int = 1000,
    preview_lines: int = 80,
) -> list[FileInfo]:
    """walk a project directory and return file info with previews."""
    root = Path(root).resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"Not a directory: {root}")

    results: list[FileInfo] = []
    ignore_patterns = _load_ignore_patterns(root)
    has_file_cap = max_files > 0

    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        current_dir = Path(dirpath)
        dirnames[:] = [
            d for d in dirnames
            if not _should_skip_dir(
                d,
                str((current_dir / d).relative_to(root)),
                ignore_patterns,
            )
        ]

        for fname in filenames:
            if has_file_cap and len(results) >= max_files:
                logger.info("Hit file cap (%d), stopping", max_files)
                break

            full = Path(dirpath) / fname
            rel = str(full.relative_to(root))
            rel_posix = rel.replace(os.sep, "/")

            if full.is_symlink():
                continue

            if _matches_ignore(rel_posix, ignore_patterns):
                continue

            if _has_skipped_suffix(full):
                continue

            try:
                size = full.stat().st_size
            except OSError:
                continue
            if size > max_file_size or size == 0:
                continue

            try:
                raw = full.read_bytes()
            except OSError:
                continue
            if _is_binary(raw):
                continue

            try:
                text = raw.decode("utf-8", errors="replace")
            except Exception:
                continue

            if _looks_minified_source(rel, text):
                continue

            lang = detect_language(rel)
            is_cfg = fname in _CONFIG_FILES
            is_entry = _is_entrypoint(rel)
            line_count = text.count("\n") + 1
            imports, exports, symbols, signals = extract_file_metadata(lang, text)

            # config/entrypoint files get full content for better LLM context
            if is_cfg or is_entry:
                preview = text
            else:
                preview = "\n".join(text.splitlines()[:preview_lines])

            results.append(FileInfo(
                path=rel,
                size=size,
                language=lang,
                lines=line_count,
                preview=preview,
                content=text,
                is_config=is_cfg,
                is_entrypoint=is_entry,
                imports=imports,
                exports=exports,
                symbols=symbols,
                signals=signals,
            ))

        if has_file_cap and len(results) >= max_files:
            break

    # sort: configs first, then entrypoints, then alphabetical
    def _sort_key(f: FileInfo) -> tuple:
        if f.is_config:
            return (0, f.path)
        if f.is_entrypoint:
            return (1, f.path)
        return (2, f.path)

    results.sort(key=_sort_key)
    return results
