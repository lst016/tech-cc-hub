export type LarkMentionOption = {
  openId: string;
  name: string;
  department?: string;
};

export type LarkMentionContext = {
  start: number;
  end: number;
  query: string;
};

export type LarkMentionDisplayPart =
  | { type: "text"; text: string }
  | {
      type: "mention";
      raw: string;
      openId: string;
      name: string;
    };

type LarkContactBridge = {
  searchLarkContacts?: (query: string) => Promise<LarkMentionOption[]>;
};

export function getLarkMentionContext(promptValue: string, cursorIndex: number): LarkMentionContext | null {
  const safeCursor = Math.max(0, Math.min(cursorIndex, promptValue.length));
  const beforeCursor = promptValue.slice(0, safeCursor);
  const match = beforeCursor.match(/(^|[\s([{"'`，。；：！？])@([\p{L}\p{N}_-]*)$/u);
  if (!match) return null;

  const query = match[2] ?? "";
  return {
    start: safeCursor - query.length - 1,
    end: safeCursor,
    query,
  };
}

export async function searchLarkMentionOptions(query: string): Promise<LarkMentionOption[]> {
  const bridge = window.electron as typeof window.electron & LarkContactBridge;
  if (!bridge?.searchLarkContacts) return [];
  return bridge.searchLarkContacts(query);
}

export function formatLarkMentionSearchError(error: unknown): string {
  const fallback = "飞书联系人暂不可用，已回退到普通 @ 引用。请先完成 lark-cli 配置和用户登录。";
  const rawMessage = error instanceof Error
    ? error.message.trim()
    : typeof error === "string"
      ? error.trim()
      : "";
  if (!rawMessage) return fallback;

  const detail = rawMessage
    .replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/i, "")
    .trim();
  return detail ? `飞书联系人不可用，已回退到普通 @ 引用。${detail}` : fallback;
}

export function serializeLarkMention(option: LarkMentionOption): string {
  return `<at user_id="${option.openId}">${option.name}</at>`;
}

export function buildLarkMentionDisplayParts(promptValue: string): LarkMentionDisplayPart[] {
  const parts: LarkMentionDisplayPart[] = [];
  const pattern = /<at user_id="([^"]+)">([^<]*)<\/at>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(promptValue))) {
    if (match.index > cursor) {
      parts.push({ type: "text", text: promptValue.slice(cursor, match.index) });
    }
    parts.push({
      type: "mention",
      raw: match[0],
      openId: match[1] ?? "",
      name: match[2] ?? "",
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < promptValue.length) {
    parts.push({ type: "text", text: promptValue.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ type: "text", text: promptValue }];
}
