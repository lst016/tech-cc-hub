# scripts

> Build, development, and release utility scripts for the Desktop Agent workbench application.

Scripts module provides build automation, development server orchestration, OAuth setup, release management, and compatibility sync utilities. These scripts handle Electron app packaging for Windows and macOS, manage version bumps and GitHub releases, configure API profiles, and synchronize Claude Code compatibility data.

## Agent 可用信息

- Scripts are executable entrypoints for npm run commands in package.json scripts section
- dev-electron.mjs is critical for macOS development - it prepares signed Electron.app and sets ELECTRON_OVERRIDE_DIST_PATH
- after-pack-win-icon.cjs must be registered as 'afterPack' hook in electron-builder configuration to apply icons
- sync-claude-code-compat.mjs requires network access to claudelog.com and generates TypeScript output at hardcoded path
- github-release.mjs uses GITHUB_TOKEN environment variable for API authentication
- codex-oauth-setup.mjs reads from TECH_CC_HUB_API_CONFIG env var or platform-specific paths for config persistence

## 优先入口

- `scripts/dev.mjs`：Primary development orchestrator - runs both React and Electron dev servers concurrently
- `scripts/github-release.mjs`：Release automation entrypoint - run via 'npm run release:github' with version argument
- `scripts/package-win-safe.mjs`：Windows packaging entrypoint - run via 'npm run package:win-safe'

## 文件

### `scripts/sync-claude-code-compat.mjs`

Fetches Claude Code changelog from claudelog.com and generates TypeScript registry at src/electron/libs/claude-code-compat-registry.ts containing command items and prompt hints for compatibility mapping.

- `SOURCE_URL` (const) - Remote URL for Claude Code changelog (https://claudelog.com/claude-code-changelog/)
- `OUTPUT_FILE` (const) - Output path for generated TypeScript registry file
- `parseArgs` (function) - Parses --version and -v command line arguments
- `normalizeVersion` (function) - Normalizes version strings, handles v2.1.x aliasing
- `fetchText` (function) - HTTP GET with custom User-Agent header
- `extractSections` (function) - Parses HTML changelog into structured sections with version, date, and item lists
- `extractCommandItems` (function) - Extracts /command patterns and special commands like 'agents' and 'plugin' from changelog items

### `scripts/codex-oauth-setup.mjs`

Interactive script to configure Codex OAuth API profile. Creates/modifies api-config.json with proper credentials, models list, and settings for the workbench.

- `BASE_URL` (const) - OpenAI API base URL (https://chatgpt.com)
- `DEFAULT_MODEL` (const) - Default model (gpt-5.5) used when not specified in existing config
- `MODELS` (const) - Full model list including compact variants
- `getDefaultConfigPath` (function) - Returns platform-specific config path (TECH_CC_HUB_API_CONFIG env var or platform default)
- `readSettings` (function) - Reads and parses api-config.json, normalizes legacy single profile format
- `buildCodexProfile` (function) - Constructs profile object preserving previous settings while applying new credential
- `saveCodexProfile` (function) - Writes updated config maintaining profile array structure

### `scripts/after-pack-win-icon.cjs`

Electron-builder afterPack hook (CommonJS) that applies custom icon.ico to Windows executable using rcedit.exe. Only runs on win32 platform.

- `applyWindowsIconAfterPack` (function) - Main export - async electron-builder hook
- `iconPath` (const) - Source icon path (build/icon.ico)
- `rceditPath` (const) - rcedit.exe binary path from electron-winstaller

### `scripts/dev-electron.mjs`

Prepares signed Electron.app on macOS (codesign verification, caching to ~/Library/Caches/tech-cc-hub), then launches Electron CLI with development environment. Sets ELECTRON_OVERRIDE_DIST_PATH for signed runtime.

- `run` (function) - Executes command synchronously, throws on non-zero exit
- `runOptional` (function) - Executes command ignoring errors (for xattr cleanup)
- `verifyCodesign` (function) - Verifies app signature using codesign --verify
- `prepareMacElectronDist` (function) - Main logic - copies Electron.app to cache, cleans extended attributes, signs with ad-hoc identity
- `cleanMacExtendedAttributes` (function) - Removes macOS extended attributes (FinderInfo, provenance, quarantine)

### `scripts/dev.mjs`

Orchestrates concurrent development servers - spawns React (dev:react) and Electron (dev:electron) npm tasks. Handles graceful shutdown on SIGINT/SIGTERM. Exits if any task fails.

- `children` (Map) - Tracks spawned child processes by name
- `stopAll` (function) - Kills all child processes and exits with code
- `startTask` (function) - Spawns npm run task, handles exit/error events

### `scripts/github-release.mjs`

Automated GitHub release workflow - bumps version in package.json, creates git tags, pushes, optionally creates GitHub release with auto-generated release notes. Supports dry-run mode.

- `args` (const) - Parsed command line arguments
- `requestedVersion` (const) - Version bump mode or explicit version (patch|minor|major|vX.Y.Z)
- `dryRun` (const) - Flag to simulate without mutating git state
- `run` (function) - Executes git commands with optional output capture
- `parseVersion` (function) - Parses semver strings into structured object
- `bumpVersion` (function) - Increments major/minor/patch or accepts explicit version
- `createGithubRelease` (function) - Creates GitHub release via GitHub API with generated release notes

### `scripts/package-win-safe.mjs`

Windows packaging script with multi-strategy fallback. Cleans old artifacts, runs electron-builder with code signing disabled, produces stable timestamped outputs (tech-cc-hub-win-x64-YYYYMMDD.exe, .zip) and win-unpacked.zip.

- `distDir` (const) - Target directory (process.cwd()/dist)
- `stamp` (const) - Date stamp for stable output naming (YYYYMMDD format)
- `cleanOldArtifacts` (function) - Removes win-unpacked/, .icon-ico/, and prior tech-cc-hub artifacts
- `findExeArtifact` (function) - Locates exe in dist directory matching tech-cc-hub pattern
- `createStableOutputs` (function) - Creates timestamped stable artifacts with proper naming
- `runWithFallback` (function) - Attempts packaging strategy, falls back to unsigned on failure

## 数据与接口契约

- **ClaudeCodeCompatRegistry**：Generated TypeScript interface at src/electron/libs/claude-code-compat-registry.ts with {sourceUrl, sourceVersion, sourceDate, generatedAt, commandItems, promptHints}
- **API Config JSON**：JSON structure with profiles array, each containing {id, name, apiKey, baseURL, model, expertModel, smallModel, analysisModel, models[], enabled, provider, apiType}
- **GitHub Release API**：POST /repos/{owner}/{repo}/releases with {tag_name, name, body, draft, prerelease}

## 关键概念

- **Electron AfterPack Hook**：after-pack-win-icon.cjs exports function matching electron-builder hook signature. Runs after packaging completes. Must be registered in electron-builder config.
- **macOS Code Signing**：dev-electron.mjs uses codesign --sign with ad-hoc identity (-). Verifies with --verify --deep --strict. Cleans xattr extended attributes to prevent Gatekeeper rejection.
- **GitHub Release Automation**：github-release.mjs uses GitHub API with Bearer token auth. Supports --dry-run, --no-push, --allow-dirty flags. Generates release notes from git commits with configurable templates.
- **Multi-Strategy Packaging**：package-win-safe.mjs tries electron-builder with signing disabled, falls back to unsigned builds. Produces timestamped stable outputs alongside standard artifacts.
- **OAuth Device Flow**：codex-oauth-setup.mjs implements OpenID Connect device authorization grant flow for Codex API, polling /device/code endpoint until user approves.

## 内部关系

- `scripts/dev.mjs` -> `scripts/dev-electron.mjs`：dev.mjs calls 'npm run dev:electron' which invokes dev-electron.mjs script
- `scripts/dev-electron.mjs` -> `node_modules/electron/cli.js`：Launches Electron CLI from installed dependency
- `scripts/sync-claude-code-compat.mjs` -> `src/electron/libs/claude-code-compat-registry.ts`：Generates TypeScript registry file consumed by Electron renderer
- `scripts/codex-oauth-setup.mjs` -> `api-config.json`：Reads/writes API configuration file referenced by Electron main process

## 运行注意事项

- dev-electron.mjs caches signed Electron.app to ~/Library/Caches/tech-cc-hub/electron-{version}-dist to avoid re-signing on each dev session
- Mac extended attribute cleaning in dev-electron.mjs removes com.apple.quarantine to prevent 'app is damaged' errors
- package-win-safe.mjs sets CSC_IDENTITY_AUTO_DISCOVERY=false to skip code signing during packaging
- github-release.mjs reads package.json version and package-lock.json for dependency tracking in release notes
- codex-oauth-setup.mjs supports both interactive flow and programmatic --profile-id --device-code --device-code-user flags
- sync-claude-code-compat.mjs supports version selection via --version=2.1.XX or defaults to latest section

## 修改风险

- Changing OUTPUT_FILE path in sync-claude-code-compat.mjs will break import references in src/electron
- Modifying MODELS array in codex-oauth-setup.mjs affects available model list for all Codex profiles
- Removing rcedit.exe dependency in after-pack-win-icon.cjs breaks Windows icon application
- Changing ELECTRON_OVERRIDE_DIST_PATH logic in dev-electron.mjs may cause macOS signature verification failures
- Altering GitHub API endpoint or auth method in github-release.mjs breaks release creation
- Changing stable output naming pattern in package-win-safe.mjs breaks release artifact distribution

## 验证

- Run 'node scripts/sync-claude-code-compat.mjs --version=2.1.50' and verify src/electron/libs/claude-code-compat-registry.ts is generated
- Run 'node scripts/codex-oauth-setup.mjs --help' to verify CLI argument parsing works
- Run 'node scripts/dev-electron.mjs' on macOS and verify Electron launches with signed app
- Run 'node scripts/github-release.mjs --dry-run patch' and verify git commands are logged without execution
- Run 'npm run package:win-safe' and verify stable timestamped artifacts appear in dist/
- Verify after-pack-win-icon.cjs is listed in electron-builder 'afterPack' hook configuration
