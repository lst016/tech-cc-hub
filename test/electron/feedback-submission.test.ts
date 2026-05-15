import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFeedbackIssueDraftUrl,
  submitFeedbackIssue,
} from "../../src/electron/libs/feedback.js";

test("feedback issue draft url omits image data and preserves attachment names", () => {
  const url = buildFeedbackIssueDraftUrl({
    body: "设置有红点需要优化\n第二行",
    images: [{ name: "screen.png", dataUrl: "data:image/png;base64,abc" }],
  });
  const parsed = new URL(url);
  const draftBody = parsed.searchParams.get("body") ?? "";

  assert.equal(parsed.origin + parsed.pathname, "https://github.com/lst016/tech-cc-hub/issues/new");
  assert.equal(parsed.searchParams.get("title"), "[反馈] 设置有红点需要优化");
  assert.equal(parsed.searchParams.get("labels"), "feedback");
  assert.match(draftBody, /网页登录草稿无法自动携带图片/);
  assert.match(draftBody, /screen\.png/);
  assert.doesNotMatch(draftBody, /data:image/);
});

test("feedback submission opens a draft when token is missing", async () => {
  const openedUrls: string[] = [];
  const result = await submitFeedbackIssue(
    { body: "设置有红点需要优化", images: [] },
    {
      fetchFn: async () => {
        throw new Error("fetch should not run without a token");
      },
      openExternal: async (url) => {
        openedUrls.push(url);
      },
    },
  );

  assert.equal(result.success, true);
  assert.equal(result.fallback, true);
  assert.equal(openedUrls.length, 1);
  assert.match(openedUrls[0] ?? "", /github\.com\/lst016\/tech-cc-hub\/issues\/new/);
});

test("feedback submission posts to GitHub when a token is available", async () => {
  let request: { input: string; init: RequestInit } | undefined;
  const result = await submitFeedbackIssue(
    { body: "设置有红点需要优化", images: [] },
    {
      token: "ghp_test",
      fetchFn: async (input, init) => {
        request = { input, init };
        return new Response(JSON.stringify({ html_url: "https://github.com/lst016/tech-cc-hub/issues/1" }), { status: 201 });
      },
    },
  );

  assert.equal(result.success, true);
  assert.equal(result.issueUrl, "https://github.com/lst016/tech-cc-hub/issues/1");
  assert.equal(request?.input, "https://api.github.com/repos/lst016/tech-cc-hub/issues");

  const headers = request?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer ghp_test");
  const body = JSON.parse(String(request?.init.body)) as { title: string; labels: string[] };
  assert.equal(body.title, "[反馈] 设置有红点需要优化");
  assert.deepEqual(body.labels, ["feedback"]);
});
