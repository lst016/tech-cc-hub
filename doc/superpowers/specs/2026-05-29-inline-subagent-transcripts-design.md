# Inline Subagent Transcripts Design

## Goal

Make dynamic workflow concurrency visible without polluting the main chat stream. When a workflow dispatches a subagent, the main chat should continue normally and insert a compact clickable agent card. Selecting the card opens a right-side child tab that renders that subagent's execution trace using the existing chat/message components.

## Context

`runner.ts` already enables Claude dynamic workflows via SDK settings. When the prompt asks for dynamic workflows, multi-agent work, background orchestration, or similar intent and reasoning is `xhigh`, `ultracode` is enabled. The runtime may then dispatch subagents internally.

The current UI can show normal session messages, tool calls, ActivityRail summaries, and task execution records, but it does not expose workflow-dispatched subagents as first-class transcript lanes. A phase-only timeline is too flat for concurrent workflows.

## User Experience

The main chat remains the user's primary narrative. Workflow progress appears inline as normal assistant text plus lightweight subagent cards:

- A subagent card appears below the assistant message that spawned or reports the agent.
- The card shows role, status, latest summary, touched file count, tool count, and last update time.
- Clicking a card opens the right bar and activates a child tab for that subagent.
- The right tab reuses the existing chat/message rendering path for the subagent's assignment, assistant output, tool calls, tool results, and final result.
- The main chat receives only important merge points and compact cards, not every subagent tool event.

## Data Model

Introduce a UI-facing transcript model that can be backed by structured SDK events when available and inferred raw events when not:

- `WorkflowRun`: run id, background task id, workflow name, session id, status.
- `WorkflowAgent`: agent id, run id, role, status, latest summary, started/completed timestamps.
- `WorkflowAgentMessage`: agent id, message id, timestamp, message payload compatible with the current chat renderer where possible.
- `WorkflowAgentArtifact`: agent id, path, kind, summary.

If the runtime emits `SubagentStart`, `SubagentStop`, `task_progress`, forwarded subagent text, or tool events, map them directly. If a field is inferred from text/logs, mark it as inferred internally so the UI can avoid overclaiming precision later.

## Architecture

Add a small workflow transcript layer between SDK/server events and React:

1. Electron observes session stream events and extracts workflow/subagent signals.
2. It stores or caches workflow run and subagent transcript state keyed by `runId` and `agentId`.
3. It emits `workflow.agent.updated` and `workflow.agent.message` server events.
4. React stores workflow transcript state separately from normal session messages.
5. Main chat renders `SubagentCard` inline where workflow agent summaries appear.
6. Right bar opens a child tab that renders `WorkflowAgentChat` using the same message renderer used by normal chat.

## Error Handling

When no structured subagent data is available, show the card as "activity inferred" and expose the raw event excerpt in the right tab. If a subagent stalls, keep the last summary visible with a stale indicator. If the run completes but a child transcript is incomplete, keep the card but mark the transcript partial.

## Testing

Add unit coverage for event extraction and store updates. Add focused UI tests for inline card rendering, card click behavior, and right-tab transcript rendering. Use a fixture with one dispatcher message, one running implementer agent, one queued verifier agent, and tool call messages.
