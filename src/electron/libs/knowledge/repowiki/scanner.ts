import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "path";
import type {
  RepoWikiCodeSymbol,
  RepoWikiFileInfo,
  RepoWikiFileSignal,
  RepoWikiScanResult,
  RepoWikiSkippedFile,
} from "./types.js";

const SKIP_DIRS = new Set([
  ".git",
  ".agents",
  ".claude",
  ".codex",
  ".hermes",
  ".qoder",
  ".superpowers",
  ".tech",
  "node_modules",
  "__pycache__",
  ".venv",
  "venv",
  "env",
  ".idea",
  ".vscode",
  ".next",
  "dist",
  "dist-electron",
  "dist-react",
  "dist-test",
  "build",
  ".tox",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  "egg-info",
  ".turbo",
  "coverage",
  ".cache",
  "vendor",
  "third_party",
  "target",
  "__snapshots__",
  ".svn",
  ".hg",
  ".gradle",
  ".m2",
  "Pods",
  ".dart_tool",
  ".pub-cache",
]);

const SKIP_PATH_PREFIXES = [
  "doc/00-research/",
  "doc/assets/",
  "doc/40-product/1.0.0/assets/",
];

const SKIP_EXTS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".svg",
  ".webp",
  ".mp3",
  ".mp4",
  ".wav",
  ".avi",
  ".mov",
  ".mkv",
  ".flac",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".rar",
  ".xz",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".dat",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".pyc",
  ".pyo",
  ".class",
  ".o",
  ".obj",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".db",
  ".sqlite",
  ".sqlite3",
  ".lock",
  ".min.js",
  ".min.css",
  ".map",
  ".wasm",
];

const MINIFIED_SOURCE_EXTS = new Set([".js", ".mjs", ".cjs", ".css"]);

const LANG_MAP = new Map<string, string>([
  [".py", "python"],
  [".pyi", "python"],
  [".js", "javascript"],
  [".mjs", "javascript"],
  [".cjs", "javascript"],
  [".ts", "typescript"],
  [".mts", "typescript"],
  [".jsx", "jsx"],
  [".tsx", "tsx"],
  [".html", "html"],
  [".htm", "html"],
  [".css", "css"],
  [".scss", "scss"],
  [".less", "less"],
  [".json", "json"],
  [".jsonc", "json"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
  [".toml", "toml"],
  [".md", "markdown"],
  [".mdx", "markdown"],
  [".txt", "text"],
  [".rst", "rst"],
  [".sh", "shell"],
  [".bash", "shell"],
  [".zsh", "shell"],
  [".go", "go"],
  [".rs", "rust"],
  [".java", "java"],
  [".kt", "kotlin"],
  [".kts", "kotlin"],
  [".scala", "scala"],
  [".c", "c"],
  [".h", "c"],
  [".cpp", "cpp"],
  [".hpp", "cpp"],
  [".cc", "cpp"],
  [".cxx", "cpp"],
  [".cs", "csharp"],
  [".rb", "ruby"],
  [".php", "php"],
  [".r", "r"],
  [".sql", "sql"],
  [".swift", "swift"],
  [".lua", "lua"],
  [".dart", "dart"],
  [".vue", "vue"],
  [".svelte", "svelte"],
  [".zig", "zig"],
  [".nim", "nim"],
  [".ex", "elixir"],
  [".exs", "elixir"],
  [".erl", "erlang"],
  [".hs", "haskell"],
  [".ml", "ocaml"],
  [".clj", "clojure"],
  [".proto", "protobuf"],
  [".graphql", "graphql"],
  [".gql", "graphql"],
  [".tf", "terraform"],
  [".hcl", "hcl"],
  [".prisma", "prisma"],
  [".astro", "astro"],
  [".cfg", "ini"],
  [".ini", "ini"],
  [".env", "text"],
  [".cmake", "cmake"],
  [".gradle", "gradle"],
  [".dockerfile", "dockerfile"],
]);

const CONFIG_FILES = new Set([
  "requirements.txt",
  "setup.py",
  "setup.cfg",
  "pyproject.toml",
  "package.json",
  "Cargo.toml",
  "go.mod",
  "go.sum",
  "Makefile",
  "CMakeLists.txt",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".env.example",
  "config.py",
  "config.yaml",
  "config.json",
  "config.toml",
  "README.md",
  "README.rst",
  "README.txt",
  "README",
  "tsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "webpack.config.js",
  "rollup.config.js",
  "Gemfile",
  "build.gradle",
  "pom.xml",
  ".eslintrc.json",
  ".prettierrc",
]);

const ENTRYPOINT_NAMES = new Set([
  "main.py",
  "app.py",
  "index.py",
  "server.py",
  "run.py",
  "__main__.py",
  "main.go",
  "main.rs",
  "main.ts",
  "main.js",
  "index.ts",
  "index.js",
  "index.tsx",
  "index.jsx",
  "App.tsx",
  "App.jsx",
  "App.vue",
  "App.svelte",
  "manage.py",
  "wsgi.py",
  "asgi.py",
]);

const ENTRYPOINT_DIRS = new Set(["cmd", "bin", "scripts", "entrypoints"]);

export function detectLanguage(path: string): string {
  const name = basename(path).toLowerCase();
  if (name === "dockerfile" || name.startsWith("dockerfile.")) return "dockerfile";
  if (name === "makefile") return "makefile";
  return LANG_MAP.get(extname(path).toLowerCase()) ?? "unknown";
}

export function buildFileTree(files: RepoWikiFileInfo[], maxLines = 240): string {
  const entries = new Set<string>();
  for (const file of files) {
    entries.add(file.path);
    const parts = splitPath(file.path);
    for (let index = 1; index < parts.length; index += 1) {
      entries.add(`${parts.slice(0, index).join("/")}/`);
    }
  }

  const lines: string[] = [];
  for (const entry of Array.from(entries).sort().slice(0, maxLines)) {
    const normalized = entry.replace(/\/$/, "");
    const depth = normalized ? normalized.split("/").length - 1 : 0;
    const name = basename(normalized) + (entry.endsWith("/") ? "/" : "");
    lines.push(`${"  ".repeat(depth)}${name}`);
  }
  if (entries.size > maxLines) {
    lines.push(`  ... and ${entries.size - maxLines} more entries`);
  }
  return lines.join("\n");
}

export function scanRepoWikiProject(root: string, options: {
  maxFileSize?: number;
  maxFiles?: number;
  previewLines?: number;
} = {}): RepoWikiScanResult {
  const workspaceRoot = resolve(root);
  if (!existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) {
    throw new Error(`Not a directory: ${workspaceRoot}`);
  }

  const maxFileSize = options.maxFileSize ?? 200 * 1024;
  const maxFiles = options.maxFiles ?? 1_000;
  const previewLines = options.previewLines ?? 80;
  const files: RepoWikiFileInfo[] = [];
  const skipped: RepoWikiSkippedFile[] = [];

  function walk(currentDir: string): void {
    if (files.length >= maxFiles) return;

    let entries: string[];
    try {
      entries = readdirSync(currentDir).sort((left, right) => (
        entryPriority(normalizePath(relative(workspaceRoot, join(currentDir, left))))
        - entryPriority(normalizePath(relative(workspaceRoot, join(currentDir, right))))
        || left.localeCompare(right)
      ));
    } catch (error) {
      skipped.push({ path: normalizePath(relative(workspaceRoot, currentDir)) || ".", reason: error instanceof Error ? error.message : "read failed" });
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      const absolutePath = join(currentDir, entry);
      const relativePath = normalizePath(relative(workspaceRoot, absolutePath));
      if (shouldSkipPath(relativePath)) {
        skipped.push({ path: relativePath, reason: "ignored research/generated docs path" });
        continue;
      }

      let stats;
      try {
        stats = statSync(absolutePath);
      } catch (error) {
        skipped.push({ path: relativePath, reason: error instanceof Error ? error.message : "stat failed" });
        continue;
      }

      if (stats.isDirectory()) {
        if (SKIP_DIRS.has(entry) || entry.endsWith(".egg-info")) {
          skipped.push({ path: relativePath, reason: "ignored directory" });
          continue;
        }
        walk(absolutePath);
        continue;
      }

      if (!stats.isFile()) continue;
      if (stats.size <= 0 || stats.size > maxFileSize) {
        skipped.push({ path: relativePath, reason: stats.size <= 0 ? "empty file" : `file too large (${stats.size} bytes)` });
        continue;
      }
      if (hasSkippedSuffix(entry)) {
        skipped.push({ path: relativePath, reason: "ignored extension" });
        continue;
      }

      const raw = readFileSync(absolutePath);
      if (raw.subarray(0, 1024).includes(0)) {
        skipped.push({ path: relativePath, reason: "binary file" });
        continue;
      }
      const text = raw.toString("utf8");
      if (looksMinifiedSource(relativePath, text)) {
        skipped.push({ path: relativePath, reason: "generated/minified bundle" });
        continue;
      }

      const language = detectLanguage(relativePath);
      const isConfig = CONFIG_FILES.has(entry);
      const isEntrypoint = isEntrypointPath(relativePath);
      const lineCount = text.split(/\r?\n/).length;
      const preview = isConfig || isEntrypoint
        ? text
        : text.split(/\r?\n/).slice(0, previewLines).join("\n");
      const signals = extractFileSignals(relativePath, text, language, isConfig, isEntrypoint);

      files.push({
        path: relativePath,
        absolutePath,
        size: stats.size,
        language,
        lines: lineCount,
        preview,
        content: text,
        isConfig,
        isEntrypoint,
        imports: extractImports(text, language),
        exports: extractExports(text, language),
        symbols: extractCodeSymbols(text, language),
        signals,
      });
    }
  }

  walk(workspaceRoot);
  files.sort((left, right) => {
    const leftRank = left.isConfig ? 0 : left.isEntrypoint ? 1 : 2;
    const rightRank = right.isConfig ? 0 : right.isEntrypoint ? 1 : 2;
    return leftRank - rightRank || left.path.localeCompare(right.path);
  });

  return {
    project: {
      name: guessProjectName(workspaceRoot, files),
      root: workspaceRoot,
      files,
      fileTree: buildFileTree(files),
      totalLines: files.reduce((sum, file) => sum + file.lines, 0),
    },
    skipped,
  };
}

function hasSkippedSuffix(name: string): boolean {
  const lower = name.toLowerCase();
  return SKIP_EXTS.some((suffix) => lower.endsWith(suffix));
}

function shouldSkipPath(path: string): boolean {
  const normalized = normalizePath(path);
  return SKIP_PATH_PREFIXES.some((prefix) => normalized === prefix.replace(/\/$/, "") || normalized.startsWith(prefix));
}

function entryPriority(path: string): number {
  const first = path.split("/").filter(Boolean).at(0) ?? "";
  if (!first) return 0;
  if (["package.json", "README.md", "tsconfig.json", "vite.config.ts"].includes(path)) return 0;
  if (["src", "scripts", "test", "tests"].includes(first)) return 1;
  if (["shared", "electron", "ui"].includes(first)) return 2;
  if (["doc", "docs"].includes(first)) return 6;
  if (first.startsWith(".")) return 8;
  return 4;
}

function looksMinifiedSource(path: string, text: string): boolean {
  if (!MINIFIED_SOURCE_EXTS.has(extname(path).toLowerCase())) return false;
  const lines = text.split(/\r?\n/) || [text];
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  if (longest < 1_000) return false;
  const nonEmpty = lines.filter((line) => line.trim());
  return nonEmpty.length <= 5 || longest > text.length * 0.5;
}

function isEntrypointPath(path: string): boolean {
  const parts = splitPath(path);
  const name = parts.at(-1) ?? "";
  if (ENTRYPOINT_NAMES.has(name)) return true;
  return parts.length >= 2 && ENTRYPOINT_DIRS.has(parts.at(-2) ?? "");
}

function extractImports(text: string, language: string): string[] {
  if (!["javascript", "typescript", "jsx", "tsx"].includes(language)) return [];
  return uniqueMatches(text, [
    /import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g,
    /import\s+["']([^"']+)["']/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
    /await\s+import\s*\(\s*["']([^"']+)["']\s*\)/g,
  ], 36);
}

function extractExports(text: string, language: string): string[] {
  if (!["javascript", "typescript", "jsx", "tsx"].includes(language)) return [];
  const names = uniqueMatches(text, [
    /^\s*export\s+(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    /^\s*export\s*\{([^}]+)\}/gm,
  ], 36).flatMap((value) => value.split(",").map((part) => part.trim().replace(/\s+as\s+.+$/i, "")));
  return Array.from(new Set(names.filter(Boolean))).slice(0, 36);
}

function extractCodeSymbols(text: string, language: string): RepoWikiCodeSymbol[] {
  if (!["javascript", "typescript", "jsx", "tsx"].includes(language)) return [];
  const symbols: RepoWikiCodeSymbol[] = [];
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    const match = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/)
      ?? trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)?\s*=>/)
      ?? trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
    if (!match) continue;
    const kind = match[2] ? match[1] : "const";
    const name = match[2] ?? match[1];
    if (!name || shouldSkipSymbolName(name)) continue;
    symbols.push({
      name,
      kind,
      line: index + 1,
      signature: trimmed.length > 180 ? `${trimmed.slice(0, 180)}...` : trimmed,
    });
    if (symbols.length >= 40) break;
  }
  return symbols;
}

function extractFileSignals(path: string, text: string, language: string, isConfig: boolean, isEntrypoint: boolean): RepoWikiFileSignal[] {
  const signals: RepoWikiFileSignal[] = [];
  const pushMatches = (
    kind: RepoWikiFileSignal["kind"],
    pattern: RegExp,
    detail: string,
    max = 40,
  ) => {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const name = match[1]?.trim();
      if (!name) continue;
      signals.push({ kind, name, detail, line: lineNumberAt(text, match.index ?? 0) });
      if (signals.length >= max) return;
    }
  };

  if (isConfig) signals.push({ kind: "config", name: path, detail: "project or build configuration" });
  if (isEntrypoint) signals.push({ kind: "entrypoint", name: path, detail: "runtime or UI entrypoint" });

  if (!isSignalSourceLanguage(language)) {
    return dedupeSignals(signals);
  }

  pushMatches("ipc", /ipcMain\.(?:handle|on)\(\s*["'`]([^"'`]+)["'`]/g, "Electron ipcMain channel");
  pushMatches("ipc", /ipcMainHandle\(\s*["'`]([^"'`]+)["'`]/g, "typed Electron IPC channel");
  pushMatches("ipc", /registerSkillIpcHandler\(\s*["'`]([^"'`]+)["'`]/g, "skill manager IPC channel");
  pushMatches("ui_ipc", /invokeKnowledge(?:<[^>]+>)?\(\s*["'`]([^"'`]+)["'`]/g, "renderer knowledge bridge call");
  pushMatches("ui_ipc", /invoke(?:<[^>]+>)?\(\s*["'`]([^"'`]+)["'`]/g, "renderer IPC invoke");
  pushMatches("mcp_tool", /tool\(\s*["'`]([^"'`]+)["'`]\s*,/g, "built-in MCP tool");
  pushMatches("mcp_server", /createSdkMcpServer\(\s*\{[\s\S]*?name:\s*["'`]([^"'`]+)["'`]/g, "built-in MCP server");
  pushMatches("database", /CREATE\s+(?:VIRTUAL\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][\w]*)/gi, "SQLite table");
  pushMatches("database", /CREATE\s+INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][\w]*)/gi, "SQLite index");
  pushMatches("event", /type:\s*["'`]([a-z][a-z0-9_.:-]+)["'`]/g, "typed event payload");

  if (/create\s*<|zustand|createStore|use[A-Z]\w*Store/.test(text) || /\/store\//.test(path)) {
    const storeName = basename(path).replace(/\.[^.]+$/, "");
    signals.push({ kind: "store", name: storeName, detail: "UI/runtime state store" });
  }

  return dedupeSignals(signals).slice(0, 80);
}

function isSignalSourceLanguage(language: string): boolean {
  return ["javascript", "typescript", "jsx", "tsx", "sql"].includes(language);
}

function uniqueMatches(text: string, patterns: RegExp[], limit: number): string[] {
  const values = new Set<string>();
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = match[1]?.trim();
      if (value) values.add(value);
      if (values.size >= limit) return Array.from(values);
    }
  }
  return Array.from(values);
}

function dedupeSignals(signals: RepoWikiFileSignal[]): RepoWikiFileSignal[] {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.kind}:${signal.name}:${signal.detail ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function lineNumberAt(text: string, index: number): number {
  return text.slice(0, index).split(/\r?\n/).length;
}

function shouldSkipSymbolName(name: string): boolean {
  return name.length <= 1 || ["props", "state", "data", "value", "result"].includes(name);
}

function guessProjectName(root: string, files: RepoWikiFileInfo[]): string {
  for (const file of files) {
    if (file.path === "package.json" && file.content) {
      try {
        const pkg = JSON.parse(file.content) as { name?: unknown };
        if (typeof pkg.name === "string" && pkg.name.trim()) {
          return pkg.name.trim().replace(/^@/, "").replace(/\//g, "-");
        }
      } catch {
        // Continue to other heuristics.
      }
    }

    if ((file.path === "pyproject.toml" || file.path === "Cargo.toml") && file.content) {
      const match = file.content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
      if (match?.[1]) return match[1];
    }
  }
  return basename(root);
}

function splitPath(path: string): string[] {
  return normalizePath(path).split("/").filter(Boolean);
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

export function parentDirName(path: string): string {
  return normalizePath(dirname(path));
}
