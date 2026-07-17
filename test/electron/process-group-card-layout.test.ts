import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("expanded process details are not clipped by an inner fixed-height scroller", () => {
  const source = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");

  assert.doesNotMatch(source, /max-h-64 overflow-auto/);
  assert.match(source, /overflow-visible rounded-lg/);
});

test("process history summaries are folded behind one disclosure by default", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const transcriptSource = readFileSync("src/ui/components/chat/ChatTranscript.tsx", "utf8");
  const processSource = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");

  assert.match(appSource, /const \[expandedProcessHistorySessionId, setExpandedProcessHistorySessionId\] = useState<string \| null>\(null\)/);
  assert.match(appSource, /const processHistoryExpanded = expandedProcessHistorySessionId === activeSessionId/);
  assert.match(transcriptSource, /const \[expandedProcessHistoryKey, setExpandedProcessHistoryKey\] = useState<string \| null>\(null\)/);
  assert.match(transcriptSource, /const processHistoryExpanded = expandedProcessHistoryKey === keyPrefix/);
  assert.match(appSource, /showProcessSummary=\{processHistoryExpanded\}/);
  assert.match(transcriptSource, /showProcessSummary=\{processHistoryExpanded\}/);
  assert.match(processSource, /showProcessSummary = true/);
  assert.match(processSource, /\{showProcessSummary && \(/);
  assert.match(processSource, /展开过程组/);
  assert.match(processSource, /收起过程组/);
  assert.doesNotMatch(processSource, /展开全部|收起全部/);
  assert.match(processSource, /export \{ ProcessGroupCard, ProcessHistoryDisclosure, ProcessChangedFilesCard \}/);
});

test("changed files are grouped at the end of every conversation round", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const transcriptSource = readFileSync("src/ui/components/chat/ChatTranscript.tsx", "utf8");
  const turnFileChangesSource = readFileSync("src/ui/utils/turn-file-changes.ts", "utf8");
  const processSource = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");

  assert.match(appSource, /return appendTurnFileChangeEntries\(entries, activeSessionId \?\? "chat"\)/);
  assert.match(transcriptSource, /return appendTurnFileChangeEntries\(entries, keyPrefix\)/);
  assert.match(turnFileChangesSource, /type: "turn_file_changes"/);
  assert.match(turnFileChangesSource, /const flushTurnFileChanges = \(\) =>/);
  assert.match(turnFileChangesSource, /entry\.type === "message" && entry\.message\?\.type === "user_prompt"/);
  assert.match(appSource, /if \(entry\.type === "turn_file_changes"\)[\s\S]*<TurnFileChangesCard[\s\S]*messages=\{entry\.messages\}/);
  assert.match(transcriptSource, /if \(entry\.type === "turn_file_changes"\)[\s\S]*<TurnFileChangesCard[\s\S]*messages=\{entry\.messages\}/);
  assert.match(appSource, /const trailingTurnFileChanges =/);
  assert.ok(appSource.lastIndexOf("<TurnFileChangesCard") > appSource.indexOf("showPartialMessage || partialMessage.trim()"));
  assert.doesNotMatch(appSource, /processHistoryMessages/);
  assert.doesNotMatch(transcriptSource, /processHistoryMessages/);
  assert.match(processSource, /function ChangedFilesSummaryCard/);
  assert.match(processSource, /const TurnFileChangesCard/);
  assert.match(processSource, /export \{ ProcessGroupCard, ProcessHistoryDisclosure, ProcessChangedFilesCard \}/);
  assert.match(processSource, /function ChangedFilesSummaryCard[\s\S]*rounded-\[12px\]/);

  const processGroupBody = processSource.slice(
    processSource.indexOf("const ProcessGroupCard"),
    processSource.indexOf("export default ProcessGroupCard"),
  );
  assert.doesNotMatch(processGroupBody, /ChangedFilesSummaryCard/);
});

test("the bottom changed-files card shows four files by default with roomier padding", () => {
  const source = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");
  const cardStart = source.indexOf("function ChangedFilesSummaryCard");
  const cardEnd = source.indexOf("const ProcessChangedFilesCard", cardStart);
  const cardSource = source.slice(cardStart, cardEnd);

  assert.match(cardSource, /const \[filesExpanded, setFilesExpanded\] = useState\(true\)/);
  assert.match(cardSource, /aria-expanded=\{filesExpanded\}/);
  assert.match(cardSource, /\{filesExpanded && \(/);
  assert.match(cardSource, /changedFiles\.slice\(0, 4\)/);
  assert.match(cardSource, /px-3\.5 py-2/);
  assert.match(cardSource, /h-7 w-7/);
  assert.doesNotMatch(cardSource, /点击文件在右侧预览/);
});
