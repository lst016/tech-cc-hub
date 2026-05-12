# Pro Workflow Plugin

This plugin provides battle-tested Claude Code workflows.

## Installation

```bash
# Add marketplace
/plugin marketplace add rohitg00/pro-workflow

# Install plugin
/plugin install pro-workflow@pro-workflow
```

Or via CLI:

```bash
claude plugin marketplace add rohitg00/pro-workflow
claude plugin install pro-workflow@pro-workflow
```

Or load directly:

```bash
claude --plugin-dir /path/to/pro-workflow
```

## Components

- **Skills**: `/pro-workflow:pro-workflow` - Main workflow patterns
- **Agents**: `planner`, `reviewer`
- **Commands**: `/pro-workflow:wrap-up`, `/pro-workflow:learn-rule`, `/pro-workflow:parallel`
- **Hooks**: All 8 official hook types

## Usage

After installation, skills are namespaced:

```
/pro-workflow:wrap-up    # End-of-session ritual
/pro-workflow:learn-rule # Capture correction to memory
/pro-workflow:parallel   # Worktree setup guide
```
