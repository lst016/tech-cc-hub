# src/electron/libs/feedback.ts

> 模块：`electron` · 语言：`typescript` · 行数：169

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildFeedbackIssueContent@31`
- `buildFeedbackIssueDraftUrl@60`
- `submitFeedbackIssue@71`
- `normalizeImages@130`
- `truncateDraftBody@134`
- `openFeedbackDraft@141`
- `getErrorMessage@165`
- `FEEDBACK_OWNER@26`
- `FEEDBACK_REPO@28`
- `FEEDBACK_LABEL@29`
- `MAX_DRAFT_BODY_CHARS@30`
- `bodyText@36`
- `titleText@37`
- `images@38`
- `markdownBody@39`
- `issue@62`
- `body@63`
- `params@64`
- `token@76`
- `issue@87`
- `response@88`
- `errorText@104`
- `data@111`
- `issueUrl@147`
- `finalMessage@148`
- `FeedbackImage@1`
- `FeedbackSubmitPayload@5`
- `FeedbackSubmitResult@10`
- `FeedbackFetch@18`
- `SubmitFeedbackOptions@20`
- `openExternal@145`

## 对外暴露

- `FeedbackImage`
- `FeedbackSubmitPayload`
- `FeedbackSubmitResult`
- `buildFeedbackIssueContent`
- `buildFeedbackIssueDraftUrl`
- `submitFeedbackIssue`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type FeedbackImage = {
  dataUrl: string;
  name: string;
};

export type FeedbackSubmitPayload = {
  body: string;
  images?: FeedbackImage[];
};

export type FeedbackSubmitResult = {
  success: boolean;
  issueUrl?: string;
  error?: string;
  fallback?: boolean;
  message?: string;
};

type FeedbackFetch = (input: string, init: RequestInit) => Promise<Response>;

type SubmitFeedbackOptions = {
  token?: string;
  fetchFn: FeedbackFetch;
  openExternal?: (url: string) => Promise<void>;
};

const FEEDBACK_OWNER = "lst016";
const FEEDBACK_REPO = "tech-cc-hub";
const FEEDBACK_LABEL = "feedback";
const MAX_DRAFT_BODY_CHARS = 3500;

export function buildFeedbackIssueContent(
  payload: FeedbackSubmitPayload,
  options: { includeImageDataUrls?: boolean } = {},
): { title: string; body: string } {
  const bodyText = payload.body?.trim() || "(无文字描述)";
  const titleText = bodyText.split(/\r?\n/)[0]?.trim().slice(0, 72) || "用户反馈";
  const images = normalizeImages(payload.images);
  let markdownBody = bodyText;

  if (images.length > 0) {
    markdownBody += "\n\n---\n### 截图\n";
    if (options.includeImageDataUrls ?? true) {
      for (const image of images) {
        markdownBody += `\n![${image.name}](${image.dataUrl})`;
      }
    } else {
      markdownBody += `客户端选择了 ${images.length} 张图片。网页登录草稿无法自动携带图片，请在 GitHub 页面手动上传或粘贴截图。\n`;
      markdownBody += images.map((image) => `- ${image.name}`).join("\n");
    }
  }

  markdownBody += "\n\n---\n*提交于 tech-cc-hub 客户端*";

  return {
    title: `[反馈] ${titleText}`,
    body: markdownBody,
  };
}

export function buildFeedbackIssueDraftUrl(payload: FeedbackSubmitPayload): string {
  const issue = buildFeedbackIssueContent(payload, { includeImageDataUrls: false });
  const body = truncateDraftBody(issue.body);
  const params = new URLSearchParams({
    title: issue.title,
    body,
    labels: FEEDBACK_LABEL,
  });
  return `https://github.com/${FEEDBACK_OWNER}/${FEEDBACK_REPO}/issues/new?${params.toString()}`;
}

export async function submitFeedbackIssue(
  payload: FeedbackSubmitPayload,
  options: SubmitFeedbackOptions,
): Promise<FeedbackSubmitResult> {
  const token = options.token?.trim();

  if (!token) {
    return await openFeedbackDraft(
      payload,
      "未配置 GitHub Token，已打开 GitHub Issue 草稿页，请在浏览器中确认提交。",
      options.openExternal,
    );
  }

  try {
    const issue = buildFeedbackIssueContent(payload, { includeImageDataUrls: true });
    const response = await options.fetchFn(`https://api.github.com/repos/${FEEDBACK_OWNER}/${FEEDBACK_REPO}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "tech-cc-hub",
      },
      body: JSON.stringify({
        title: issue.title,
        body: issue.body,
        labels: [FEEDBACK_LABEL],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return await openFeedbackDraft(
        payload,
        `GitHub API 提交失败 (${response.status})，已打开 GitHub Issue 草稿页，请在浏览器中确认提交。${errorText ? ` 原因：${errorText.slice(0, 240)}` : ""}`,
        options.openExternal,
      );
    }

    const data = await response.json() as { html_url?: string };
    if (!data.html_url) {
      return await openFeedbackDraft(
        payload,
        "GitHub API 没有返回 Issue 地址，已打开 GitHub Issue 草稿页，请在浏览器中确认提交。",
        options.openExternal,
      );
    }

    return { success: true, issueUrl: data.html_url };
  } catch (error) {
    return await openFeedbackDraft(
      payload,
      `GitHub API 暂时不可用，已打开 GitHub Issue 草稿页，请在浏览器中确认提交。原因：${getErrorMessage(error)}`,
      options.openExternal,
    );
  }
}

function normalizeImages(images: FeedbackImage[] | undefined): FeedbackImage[] {
  return (images ?? []).filter((image) => image.dataUrl?.trim() && image.name?.trim());
}

function truncateDraftBody(body: string): string {
  if (body.length <= MAX_DRAFT_BODY_CHARS) {
    return body;
  }
  return `${body.slice(0, MAX_DRAFT_BODY_CHARS)}\n\n...(内容过长，已截断；请在提交前补充剩余信息)`;
}

async function openFeedbackDraft(
  payload: FeedbackSubmitPayload,
  message: string,
  op
... (truncated)
```
