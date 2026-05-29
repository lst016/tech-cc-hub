# Inline Subagent Transcripts Implementation Plan

## Goal

Show dynamic workflow subagents in the normal chat flow as compact clickable cards. Clicking a card opens a right-side workspace tab that reuses the existing chat message renderer to show that subagent's execution record.

## Scope

- Derive workflow agent summaries from existing session stream messages first.
- Add a visible right-rail tab only when workflow agent cards exist.
- Keep the main chat readable by rendering one card per agent instead of dumping every subagent event inline.
- Avoid backend/runtime protocol changes in this first slice unless the current stream already exposes enough structured metadata.

## Tasks

1. Add a workflow-agent transcript model utility.
   - Input: `StreamMessage[]`.
   - Output: agent summaries with status, label, latest text, tool count, message count, and transcript messages.
   - Recognize current system task events such as `task_started`, `task_progress`, and `task_updated`.
   - Keep fallback extraction defensive so unrelated system messages are ignored.

2. Add UI components.
   - `WorkflowAgentCard`: compact inline card below the relevant chat flow.
   - `WorkflowAgentTranscriptPanel`: right rail surface that reuses `MessageCard` for transcript messages.

3. Wire App and Activity Rail.
   - Extend right rail tab type with `workflow-agent`.
   - Add per-session selected workflow agent state.
   - Insert cards into `renderEntries` from derived summaries.
   - On card click, open the right rail and select the workflow-agent tab.
   - Pass selected agent and available-agent flag into `ActivityRail`.

4. Verify.
   - Unit-test transcript extraction with realistic task system events.
   - Update workspace tab tests to include the conditional workflow-agent tab.
   - Run targeted Node tests.
   - Run TypeScript check or the closest available verification script.

## Out of Scope For This Slice

- Full backend protocol for dedicated workflow/subagent events.
- Persisted historical transcript indexing.
- Fancy graph/timeline visualization. The right panel is chat-first by design.
