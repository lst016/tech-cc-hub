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
  openExternal: ((url: string) => Promise<void>) | undefined,
): Promise<FeedbackSubmitResult> {
  const issueUrl = buildFeedbackIssueDraftUrl(payload);
  let finalMessage = message;

  if (openExternal) {
    try {
      await openExternal(issueUrl);
    } catch (error) {
      finalMessage = `已生成 GitHub Issue 草稿链接，但自动打开失败，请点击打开草稿。原因：${getErrorMessage(error)}`;
    }
  }

  return {
    success: true,
    fallback: true,
    issueUrl,
    message: finalMessage,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
