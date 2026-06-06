import test from "node:test";
import assert from "node:assert/strict";

import {
  getAskUserQuestionSignature,
  normalizeAskUserQuestions,
} from "../../src/ui/utils/ask-user-question.js";

test("normalizeAskUserQuestions accepts historical non-array payloads", () => {
  assert.deepEqual(normalizeAskUserQuestions({ questions: "Pick a path" }), [
    { question: "Pick a path" },
  ]);

  assert.deepEqual(normalizeAskUserQuestions({ questions: { prompt: "Need approval" } }), [
    { question: "Need approval" },
  ]);
});

test("normalizeAskUserQuestions filters malformed questions and options", () => {
  const questions = normalizeAskUserQuestions({
    questions: [
      null,
      { question: "" },
      {
        text: "Choose mode",
        header: "Mode",
        multiSelect: true,
        options: [
          "Auto",
          { label: "Manual", description: "Review before merge" },
          { label: "" },
          { description: "missing label" },
        ],
      },
    ],
  });

  assert.deepEqual(questions, [
    {
      question: "Choose mode",
      header: "Mode",
      multiSelect: true,
      options: [
        { label: "Auto" },
        { label: "Manual", description: "Review before merge" },
      ],
    },
  ]);
});

test("getAskUserQuestionSignature uses normalized question shapes", () => {
  assert.equal(
    getAskUserQuestionSignature({
      questions: {
        question: "Merge?",
        options: [{ label: "Yes" }, "No"],
      },
    }),
    "Merge?||0|Yes|,No|",
  );
});
