# src/electron/libs/knowledge/repowiki/scanner.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：609

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `detectLanguage@219`
- `buildFileTree@226`
- `scanRepoWikiProject@249`
- `walk@266`
- `hasSkippedSuffix@374`
- `readIgnorePatterns@379`
- `shouldSkipDirectory@397`
- `matchesIgnore@404`
- `wildcardMatch@422`
- `entryPriority@427`
- `looksMinifiedSource@438`
- `isEntrypointPath@447`
- `extractImports@454`
- `extractExports@464`
- `extractCodeSymbols@473`
- `extractFileSignals@498`
- `isSignalSourceLanguage@541`
- `uniqueMatches@545`
- `dedupeSignals@558`
- `lineNumberAt@568`
- `shouldSkipSymbolName@572`
- `guessProjectName@576`
- `splitPath@597`
- `normalizePath@601`
- `parentDirName@605`
- `SKIP_DIRS@10`
- `IGNORE_FILES@26`
- `SKIP_EXTS@28`
- `MINIFIED_SOURCE_EXTS@84`
- `LANG_MAP@86`
- `CONFIG_FILES@158`
- `ENTRYPOINT_NAMES@193`
- `ENTRYPOINT_DIRS@217`
- `name@221`
- `entries@228`
- `parts@231`
- `normalized@239`
- `depth@240`
- `name@241`
- `workspaceRoot@255`

## 依赖输入

- `fs`
- `path`
- `./types.js`

## 对外暴露

- `detectLanguage`
- `buildFileTree`
- `scanRepoWikiProject`
- `parentDirName`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
  "node_modules",
  "__pycache__",
  "venv",
  "env",
  "dist",
  "build",
  "egg-info",
  "coverage",
  "vendor",
  "third_party",
  "target",
  "__snapshots__",
  "Pods",
]);

const IGNORE_FILES = [".techignore", ".repowikiignore", ".gitignore"];

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
    entries.add(fi
... (truncated)
```
