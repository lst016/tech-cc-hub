# docs

> Project documentation module for specs, plans, and development guides organized by feature and date

The docs module contains project specifications and implementation plans organized in a hierarchical structure under `docs/superpowers/`. It separates design specs (高阶设计) from implementation plans (实施计划), each organized by feature name and date. This structure allows tracking the evolution of features like Figma MCP plugin and Git Workbench from design through implementation.

## 文件

### `docs/superpowers/plans/2026-05-10-figma-official-mcp-plugin.md`

Step-by-step implementation plan for integrating Figma official MCP plugin with checkbox tracking for agentic workers. Covers external MCP server parsing, runner modifications, IPC handlers, UI changes, and test coverage.

- `subagent-driven-development` (superpower) - Required superpower for implementing this plan
- `executing-plans` (superpower) - Fallback superpower for plan execution
- `mcp.list` (IPC channel) - Handler that uses listExternalMcpServerInfos for MCP settings page
- `plugins:getFigmaOfficialStatus` (IPC channel) - Figma plugin status query channel
- `plugins:installFigmaOfficial` (IPC channel) - Figma plugin installation channel

### `docs/superpowers/plans/2026-05-10-git-workbench-tab.md`

Implementation plan for adding Git workbench as a right-side tab. Details file structure for git module, IPC handlers, UI components, and simple-git integration.

- `simple-git` (dependency) - Git command wrapper library for Electron main process
- `git:*` (IPC channel pattern) - Git operation channels via preload bridge
- `ActivityWorkspaceTabs` (component) - Component managing right tab display and switching

### `docs/superpowers/specs/2026-05-10-figma-official-mcp-plugin-design.md`

High-level design specification for Figma official MCP plugin integration. Defines architecture for stdio/HTTP MCP support, plugin state management, OAuth handling, and capability tracking.

- `McpServerInfo` (interface) - Extended to include transport type and URL for HTTP MCP
- `GitRepoStatus` (interface) - Git repository status tracking
- `GitFileChange` (interface) - Individual file change with staged/unstaged status
- `auth-expired` (status value) - Figma token expired state requiring re-authorization

### `docs/superpowers/specs/2026-05-10-git-workbench-tab-design.md`

Design specification for Git Workbench tab covering open source research, target features, architecture, data models, and security boundaries.

- `diff2html` (dependency) - Existing library for rendering diff output
- `simple-git` (library reference) - Git command wrapper for Electron main process
- `GitRepoStatus` (type) - Repository state including branch, upstream, ahead/behind counts
- `GitFileChange` (type) - Single file change with path, status, and staged flag
- `GitCommitNode` (type) - Commit with hash, message, author, timestamp, parent references

## 关键概念

- **MCP Server Configuration**：Multi-model routing supports both stdio and HTTP transport types for external MCP servers, with enabled/disabled states and validation.
- **Plugin State Machine**：Figma plugin has states: not-configured, configured, needs-auth, auth-expired, with tracking of authStatus, lastAuthCheckedAt, and capabilities.
- **Git Operation Safety Boundary**：First version excludes high-risk operations: reset, rebase, cherry-pick, force push to prevent unintended history rewrites.
- **分层架构**：Electron main process encapsulates Git operations; Renderer only receives structured data via IPC preload bridge, never executing git directly.
- **Agentic Worker Checkbox Syntax**：Implementation plans use `- [ ]` checkbox syntax for tracking progress by agentic workers using subagent-driven-development superpower.

## 内部关系

- `docs/superpowers/specs/2026-05-10-figma-official-mcp-plugin-design.md` -> `docs/superpowers/plans/2026-05-10-figma-official-mcp-plugin.md`：Design spec provides architectural guidance for the implementation plan
- `docs/superpowers/specs/2026-05-10-git-workbench-tab-design.md` -> `docs/superpowers/plans/2026-05-10-git-workbench-tab.md`：Design spec provides architectural guidance for the implementation plan
