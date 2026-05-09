import type { TChatConversation } from '@/common/config/storage';
import type { TMessage } from '@/common/chat/chatLib';

export type ExportTranscriptLabels = Record<string, string>;

export const buildConversationExportText = (_conversation: TChatConversation | null, messages: TMessage[] | null) =>
  (messages ?? []).map((message) => `${message.role ?? 'unknown'}: ${message.content ?? ''}`).join('\n\n');

export const buildDefaultExportFileName = (source?: string) => `${normalizeExportFileName(source || 'conversation')}.md`;
export const getDefaultExportFileNameSource = (conversation?: TChatConversation | null) => conversation?.title || conversation?.id || 'conversation';
export const normalizeExportFileName = (input: string) => input.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'conversation';
export const joinFilePath = (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/');
export const resolveExportBaseDirectory = (conversation?: TChatConversation | null, workspace?: string) => workspace || conversation?.workspace || conversation?.path || '';
