import type { WikiModelSettings } from "./knowledge-types.js";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
  error?: {
    message?: string;
  };
};

function joinEndpoint(baseURL: string, path: string): string {
  const normalizedBase = baseURL.replace(/\/$/, "");
  return `${normalizedBase}${path}`;
}

function sanitizeWikiMarkdown(text: string): string {
  return text
    .trim()
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:markdown|md)?[^\S\r\n]*(?:\r?\n|$)/i, "")
    .replace(/\r?\n```[^\S\r\n]*$/i, "")
    .trim();
}

export async function generateWikiMarkdown(settings: WikiModelSettings, prompt: string): Promise<string> {
  const response = await fetch(joinEndpoint(settings.baseURL, "/chat/completions"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: "你是一个仓库 Wiki 生成器。只输出中文 Markdown，不要输出代码围栏外的解释。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: settings.maxOutputTokens,
    }),
  });

  const rawText = await response.text();
  let payload: OpenAIChatResponse;
  try {
    payload = rawText ? JSON.parse(rawText) as OpenAIChatResponse : {};
  } catch {
    throw new Error(`wiki model returned non-JSON response: ${rawText.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || rawText || response.statusText);
  }

  const text = sanitizeWikiMarkdown(payload.choices?.[0]?.message?.content || payload.choices?.[0]?.text || "");
  if (!text.trim()) {
    throw new Error("wiki model returned empty content");
  }
  return text;
}
