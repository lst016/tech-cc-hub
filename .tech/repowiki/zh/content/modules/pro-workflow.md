# pro-workflow

> AI coding workflow system providing self-correction memory, persistent research wikis with FTS5 indexing, quality gates, and multi-model routing for Claude Code and similar agents

Pro Workflow is a comprehensive Claude Code plugin that solves the problem of repeated corrections, vanished learnings, and context compaction. It maintains a single SQLite database with FTS5 full-text search that stores learned rules, research wikis, and session state. The module includes 37 hook scripts for lifecycle events (session start/end, file changes, permission handling), quality gates enforcing lint/typecheck/tests, drift detection to catch goal divergence, git safety guards blocking destructive operations, multi-model routing preferences, parallel session worktree support, and auto-research capabilities that grow wikis autonomously. After installation, skills are namespaced under /pro-workflow:* for wrap-up rituals, learning capture, and parallel worktree setup.

## 文件

### `config.json`

Default configuration for all pro-workflow features

- `database.path` (config) - SQLite database path, defaults to ~/.pro-workflow/data.db
- `self_correction` (config) - Settings for auto-capturing corrections, approval requirements, and learned file path
- `plan_mode` (config) - Thresholds for when plan mode activates (file count, tool call budget)
- `quality_gates` (config) - Commands for lint, typecheck, and test execution before commits
- `model_preferences` (config) - Maps task types (quick_fixes, features, refactors, architecture, debugging) to preferred models (haiku, sonnet, opus)
- `parallel_sessions` (config) - Git worktree settings for parallel session management

### `package.json`

NPM package definition with TypeScript build configuration

- `build script` (script) - Compiles TypeScript and copies schema.sql to dist/db/
- `better-sqlite3` (dependency) - SQLite3 wrapper for database operations including FTS5
- `files array` (manifest) - Lists all directories included in npm package (hooks, commands, agents, contexts, templates, rules, references, skills, docs)

### `scripts/commit-validate.js`

Hook script that validates commit messages against Conventional Commits specification

- `extractMessage` (function) - Parses git commit command to extract message from -m flag, heredoc, or file flag
- `validate` (function) - Checks first line against type(scope): summary pattern, validates summary length <= 72 chars
- `TYPES` (constant) - Array of valid Conventional Commits types: feat, fix, refactor, test, docs, chore, perf, ci, style, build, revert

### `scripts/config-watcher.js`

Hook script that detects and logs changes to sensitive configuration files during sessions

- `sensitiveFiles` (constant) - List of monitored files: settings.json, settings.local.json, hooks.json, .claudeignore
- `getTempDir/ensureDir` (function) - Creates temp directory at os.tmpdir()/pro-workflow for logging config changes

### `scripts/cwd-changed.js`

Hook script that detects project type when directory changes and exports PRO_WORKFLOW_PROJECT_TYPE

- `project type detection` (logic) - Detects Node (package.json), Rust (Cargo.toml), Go (go.mod), Python (pyproject.toml) by file presence
- `hasClaude check` (logic) - Warns if no CLAUDE.md exists in new directory

### `scripts/drift-detector.js`

Hook script that tracks user intent and detects when conversation diverges significantly from original goal

- `extractIntent` (function) - Extracts first sentence from prompt as intent representation
- `extractKeywords` (function) - Tokenizes text and filters stop words for keyword overlap comparison
- `isNewIntent` (function) - Detects significant intent change via keyword overlap scoring
- `relevance threshold` (constant) - Triggers drift warning when editsSinceLastTouch >= 6 AND relevance < 0.2

### `scripts/embed-wiki.js`

CLI tool to embed wiki pages for semantic search using configured embedding provider

- `cmdAll` (function) - Embeds all wiki pages (or by slug) using batch processing with configurable batch size (16)
- `cmdSearch` (function) - Searches embedded wiki content using vector similarity
- `getEmbeddingProvider` (function) - Returns configured provider (OpenAI or Voyage) based on env variables

### `scripts/file-changed.js`

Hook script that detects important config file changes and enqueues wiki verify seeds for wiki edits

- `importantPatterns` (regex array) - Matches package.json, tsconfig, .env, Dockerfile, GitHub workflows, CLAUDE.md, Cargo.toml, etc.
- `wikiMatch regex` (regex) - Detects edits inside .claude/wikis/*/wiki/ or .pro-workflow/wikis/*/wiki/ directories
- `enqueueSeed` (function) - Triggers auto-research verification when wiki files are modified

### `scripts/git-blast-radius.js`

Hook script that blocks dangerous git operations (force push, hard reset, branch deletion, etc.)

- `BLOCK` (array) - 14 dangerous patterns: force push, hard reset, clean -f, branch -D, checkout ., rebase -i on main/master, filter-branch, reflog expire, stash drop/clear
- `WARN_NOT_BLOCK` (array) - force-with-lease push (warned but allowed)
- `redact` (function) - Masks credentials in URLs before logging
- `PRO_WORKFLOW_ALLOW_UNSAFE_GIT` (env override) - Environment variable to bypass safety checks if set to '1'

### `scripts/learn-capture.js`

Hook script that auto-captures [LEARN] tags from assistant responses into SQLite database

- `regex pattern` (regex) - Parses [LEARN] category: rule with optional Mistake:, Correction:, Wiki: fields
- `addLearning` (function) - Stores captured learnings in SQLite with project, category, rule, mistake, correction, optional wiki association

### `scripts/notification-handler.js`

Hook script that logs permission request notifications

- `PermissionRequest handler` (logic) - Logs tool name when permission is requested

### `scripts/permission-denied.js`

Hook script that tracks permission denials and identifies patterns for tuning

- `denials tracking` (logic) - Stores last 500 permission denials in JSON file with timestamp, tool, input summary, session ID
- `topDenied analysis` (logic) - Every 10 denials, reports top 3 denied tools suggesting /permission-tuner

### `scripts/permission-request.js`

Hook script that warns about dangerous operations before permission is granted

- `dangerous patterns` (regex array) - Matches rm -rf, docker rm/rmi/prune, npm publish, git push --force, git reset --hard, sudo rm, chmod 777, curl/wget pipe to sh, dd, mkfs, >/dev/

## 关键概念

- **Self-Correction Memory**：Every [LEARN] tag in assistant responses is captured into SQLite FTS5. SessionStart hook loads learned rules so Claude never repeats the same mistake. The learned_file in config.json specifies where corrections are appended.
- **FTS5 Full-Text Search**：SQLite FTS5 enables fast keyword search across learnings and wiki content. The embed-wiki script generates vector embeddings for semantic search using OpenAI or Voyage API.
- **Quality Gates**：Hooks enforce lint, typecheck, and test execution. commit-validate.js validates Conventional Commits format. quality_gates config specifies npm commands to run.
- **Multi-Model Routing**：model_preferences config maps task types to preferred models: haiku for quick fixes, sonnet for features, opus for refactors/architecture/debugging. Used by agent orchestration.
- **Drift Detection**：Tracks original intent keywords across edits. When user makes 6+ edits with <20% keyword overlap to original intent, warns about goal divergence.
- **Git Blast Radius**：Pre-commit hook blocks destructive git operations: force push, hard reset, branch deletion, git clean -f, filter-branch. Can be overridden with environment variable.
- **Wiki Auto-Research**：file-changed hook detects edits inside wiki directories and enqueues verify seeds. embed-wiki script generates vector embeddings for semantic search. Wikis grow autonomously via auto-research loop.
- **Parallel Sessions**：Configures git worktree support for running multiple sessions in parallel. /pro-workflow:parallel command provides worktree setup guide. native_worktree enables git-native branching.

## 内部关系

- `scripts/embed-wiki.js` -> `dist/db/store.js`：Imports createStore from compiled database module for wiki page access
- `scripts/embed-wiki.js` -> `dist/search/embeddings.js`：Imports getEmbeddingProvider and upsertEmbedding for vector storage operations
- `scripts/file-changed.js` -> `dist/db/store.js`：Imports createStore to enqueue wiki verify seeds on wiki file edits
- `scripts/learn-capture.js` -> `dist/db/store.js`：Imports createStore to persist captured [LEARN] tags to database
- `package.json build script` -> `src/db/schema.sql`：Copies SQL schema to dist/db/ during build process
- `config.json` -> `dist/`：Configuration values are loaded at runtime to configure database path, quality gates, model preferences, and other features
