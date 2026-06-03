# Windows / WSL Claude Code Compatibility Checklist

> Source of truth for the Windows/WSL QA lane (Phase 9) of the
> Claude Code 2.1.161 compatibility workflow. Each scenario has an
> automation status and pass criteria. Manual scenarios keep the same
> pass/fail bars — a human-verified "looks fine" is not enough; the
> scenario must reproduce cleanly on a fresh checkout.

## Scenarios

### 1. PowerShell command display
- **What it checks**: when a slash command or a shell-issued PowerShell
  snippet is rendered, the display correctly shows the verb-noun form
  and does not strip `Get-`, `Set-`, `New-` prefixes.
- **Automation**: covered by `test/electron/windows-wsl-claude-qa.test.mjs`
  (smoke: PowerShell command detection).
- **Pass**: PowerShell command parsing returns the expected verb-noun pair.

### 2. WSL bash interop
- **What it checks**: when the user types a `wsl.exe` command, the runner
  recognizes it and routes through the WSL interop shim instead of
  treating it as a regular `wsl` binary.
- **Automation**: covered by the same smoke test (interop detection).
- **Pass**: `wsl.exe <command>` is detected and dispatched to the WSL
  transport.

### 3. Chinese IME input
- **What it checks**: the prompt input field accepts characters typed via
  the Chinese IME (pinyin, wubi, etc.) without dropping composition
  events. Composition end events are forwarded to the runner.
- **Automation**: not yet automated (relies on browser keyboard stack);
  manual repro path documented in the smoke test as a pending test.
- **Pass**: a pinyin phrase composed via IME ends up character-for-character
  intact in the chat send event.

### 4. Clipboard paste / copy
- **What it checks**: the prompt input accepts a multi-line clipboard
  paste (including Windows CRLF) without splitting into a single line.
- **Automation**: covered by the same smoke test (CRLF passthrough).
- **Pass**: a clipboard payload with CRLF line endings is preserved through
  the input field and the send event.

### 5. Windows path, file URL, and UNC path handling
- **What it checks**: file paths like `C:\Users\u\file.txt`,
  `file:///C:/Users/u/file.txt`, and `\\server\share\file.txt` are
  normalized to a single canonical form before being passed to tools.
- **Automation**: covered by the same smoke test (path normalization).
- **Pass**: all three path forms round-trip to the same canonical key.

### 6. `.bat`, `.cmd`, and `.ps1` permission display
- **What it checks**: when the runner surfaces a permission prompt for a
  Windows script, the file extension is preserved (not collapsed to
  "shell" or "bash").
- **Automation**: covered by the same smoke test (script extension
  detection).
- **Pass**: `.bat`, `.cmd`, and `.ps1` extensions are surfaced in the
  permission dialog.

### 7. Background session detach / resume on Windows
- **What it checks**: a background Claude Code session that is detached
  and later resumed on Windows retains its `worktreePath`,
  `permissionMode`, and `effort` (see Phase 4 background-agent state
  model).
- **Automation**: covered by the same smoke test (resume key passthrough).
- **Pass**: `RuntimeOverrides` round-trip preserves Windows-style paths.

### 8. WSL worktree path mapping
- **What it checks**: when a worktree path originates inside WSL
  (`\\wsl$\Ubuntu\home\u\...`), the runner treats it as a remote path
  and the path conversion layer applies UNC-to-POSIX mapping before any
  shell call.
- **Automation**: covered by the same smoke test (WSL path conversion).
- **Pass**: `\\wsl$\Ubuntu\home\u\repo` converts to
  `/home/u/repo` for shell consumption.

### 9. Long-running terminal command status
- **What it checks**: when a background shell command is still running,
  the activity rail surfaces a "running" status (not "stale") for at
  least the configured stale threshold.
- **Automation**: covered by the same smoke test (stale detection
  threshold).
- **Pass**: a 1-second-old lastEventAt with staleAfterMs=10s is NOT
  marked stale; the same with staleAfterMs=100ms IS.

### 10. MCP stdio server receives `CLAUDE_PROJECT_DIR`
- **What it checks**: when the runner spawns an MCP stdio server, it
  passes `CLAUDE_PROJECT_DIR` (the workspace root) so the MCP server can
  locate the right project context.
- **Automation**: covered by the same smoke test (env var injection).
- **Pass**: the spawned process environment contains
  `CLAUDE_PROJECT_DIR=<workspace root>`.

## Running the lane

```bash
# 1. Transpile
npm run transpile:electron

# 2. Run the Windows/WSL smoke suite
node --test test/electron/windows-wsl-claude-qa.test.mjs

# 3. Run the full compat workflow (this lane is gated by Phase 9)
node scripts/claude-code-compat-2161-workflow.mjs --phase 9 --force
```

## Manual repro recipes

| Scenario | Manual repro |
| --- | --- |
| IME input | Switch to Chinese IME, type "ni hao", confirm chat send event contains the full composed string |
| WSL interop | Run a workflow with `wsl.exe ls -la`; confirm the runner logs the WSL transport path |

When a manual scenario fails, capture: Windows build number, Node
version, terminal host (Windows Terminal / ConEmu / VS Code), and the
exact prompt bytes (UTF-8 hex dump if necessary).
