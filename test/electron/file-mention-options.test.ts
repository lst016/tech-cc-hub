import assert from "node:assert/strict";
import test from "node:test";

import {
  scoreFileMentionOption,
  type FileMentionOption,
} from "../../src/ui/components/prompt-input/file-mention-options.js";

const mentionOptions: FileMentionOption[] = [
  {
    path: "D:/repo/src/pages/log/PackageLog.tsx",
    label: "src/pages/log/PackageLog.tsx",
    name: "PackageLog.tsx",
    kind: "file",
  },
  {
    path: "D:/repo/src/pages/system/account",
    label: "src/pages/system/account",
    name: "account",
    kind: "directory",
  },
  {
    path: "D:/repo/src/pages/system/account/index.tsx",
    label: "src/pages/system/account/index.tsx",
    name: "index.tsx",
    kind: "file",
  },
  {
    path: "D:/repo/src/pages/ActivityCalendar",
    label: "src/pages/ActivityCalendar",
    name: "ActivityCalendar",
    kind: "directory",
  },
  {
    path: "D:/repo/src/features/target/TargetPanel.tsx",
    label: "src/features/target/TargetPanel.tsx",
    name: "TargetPanel.tsx",
    kind: "file",
  },
];

test("file mention prefers slash-separated path prefixes over loose fuzzy matches", () => {
  const ranked = mentionOptions
    .map((option) => ({
      option,
      score: scoreFileMentionOption(option, "pages/Ac"),
    }))
    .filter((item): item is { option: FileMentionOption; score: number } => item.score !== null)
    .sort((left, right) => left.score - right.score);

  assert.equal(ranked[0]?.option.label, "src/pages/ActivityCalendar");
  assert.equal(
    ranked.some((item) => item.option.label === "src/pages/log/PackageLog.tsx"),
    false,
  );
  assert.equal(
    ranked.some((item) => item.option.label === "src/pages/system/account"),
    true,
  );
});

test("file mention slash query can match descendants under the requested directory", () => {
  const targetByName = mentionOptions.find((option) => option.label === "src/features/target/TargetPanel.tsx");
  assert.ok(targetByName);
  assert.notEqual(scoreFileMentionOption(targetByName, "target"), null);
  assert.notEqual(scoreFileMentionOption(targetByName, "src/target"), null);
});
