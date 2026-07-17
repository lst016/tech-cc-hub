import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const uiTypesSource = readFileSync("src/ui/types.ts", "utf8");
const electronTypesSource = readFileSync("src/electron/types.ts", "utf8");
const ipcHandlersSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
const appSource = readFileSync("src/ui/App.tsx", "utf8");

test("session append types carry a request id and expose a correlated result ACK", () => {
  for (const source of [uiTypesSource, electronTypesSource]) {
    assert.match(
      source,
      /type: "session\.append"; payload: \{[^}]*requestId\??: string;/,
    );
    assert.match(
      source,
      /type: "session\.append\.result"; payload: \{ sessionId: string; requestId: string; success: boolean; error\?: string \}/,
    );
  }
});

test("session append handler ACKs both successful and failed requests", () => {
  const appendStart = ipcHandlersSource.indexOf('if (event.type === "session.append")');
  const appendEnd = ipcHandlersSource.indexOf('if (event.type === "session.stop")', appendStart);
  const appendSource = ipcHandlersSource.slice(appendStart, appendEnd);

  assert.notEqual(appendStart, -1);
  assert.notEqual(appendEnd, -1);
  assert.match(appendSource, /const appendRequestId = event\.payload\.requestId/);
  assert.match(appendSource, /type: "session\.append\.result"/);
  assert.match(appendSource, /requestId: appendRequestId/);
  assert.match(appendSource, /emitAppendResult\(true\)/);
  assert.match(
    appendSource,
    /const preparedAttachmentsPromise = preparePromptAttachmentsForSession\(event\.payload\.attachments\);\s*const appendPromptPromise = handle\.appendPrompt\(/,
    "the runner must reserve the append before attachment preparation is awaited",
  );
  assert.ok(
    (appendSource.match(/emitAppendResult\(false,/g)?.length ?? 0) >= 3,
    "missing session, inactive runner, and append failure paths must all return a negative ACK",
  );
});

test("queued append sends its queue id as requestId without removing the draft eagerly", () => {
  const appendStart = promptInputSource.indexOf("const appendQueuedDraft = useCallback");
  const acknowledgementStart = promptInputSource.indexOf("useEffect(() =>", appendStart);
  const appendSource = promptInputSource.slice(appendStart, acknowledgementStart);

  assert.notEqual(appendStart, -1);
  assert.notEqual(acknowledgementStart, -1);
  assert.match(appendSource, /type: "session\.append"/);
  assert.match(appendSource, /requestId: queuedMessage\.id/);
  assert.doesNotMatch(
    appendSource,
    /removeQueuedDraft\(/,
    "the queue item must remain until the main process acknowledges a successful append",
  );
});

test("PromptInput removes a queued draft only after its matching success ACK", () => {
  const acknowledgementStart = promptInputSource.indexOf("useEffect(() =>", promptInputSource.indexOf("const appendQueuedDraft"));
  const acknowledgementEnd = promptInputSource.indexOf("const editQueuedDraft", acknowledgementStart);
  const acknowledgementSource = promptInputSource.slice(acknowledgementStart, acknowledgementEnd);
  const requestMatchIndex = acknowledgementSource.indexOf("appendInFlightIdsRef.current.has(detail.requestId)");
  const failureGuardIndex = acknowledgementSource.indexOf("if (!detail.success)");
  const removeIndex = acknowledgementSource.indexOf("removeQueuedDraft(detail.requestId, detail.sessionId)");

  assert.match(acknowledgementSource, /addEventListener\(PROMPT_APPEND_RESULT_EVENT, handleAppendResult\)/);
  assert.ok(
    requestMatchIndex !== -1 && requestMatchIndex < failureGuardIndex && failureGuardIndex < removeIndex,
    "PromptInput must correlate the ACK, retain the draft on failure, and remove it only on success",
  );
  assert.match(
    acknowledgementSource,
    /if \(!detail\.success\) \{[\s\S]*?return;[\s\S]*?\}[\s\S]*?removeQueuedDraft\(detail\.requestId, detail\.sessionId\)/,
  );
});

test("App forwards session append result ACKs to the prompt queue listener", () => {
  assert.match(appSource, /event\.type === "session\.append\.result"/);
  assert.match(
    appSource,
    /new CustomEvent<PromptAppendResultDetail>\(PROMPT_APPEND_RESULT_EVENT, \{\s*detail: event\.payload,/,
  );
});
