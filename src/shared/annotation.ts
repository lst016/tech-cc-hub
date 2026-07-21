/**
 * 聊天消息评论/标注 (annotation) 数据模型。
 *
 * 锚定方式：message_id + paragraph_index + (start_offset, end_offset, anchor_text)
 * - message_id 关联到 messages 表里的消息 id
 * - paragraph_index 是 markdown 渲染后第几个段落 (p / li)
 * - start/end_offset 是该段落 innerText 的字符区间
 * - anchor_text 是选中时的原文快照，用于容错匹配
 */

export type Annotation = {
  id: string;
  sessionId: string;
  messageId: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  anchorText: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

export type AnnotationInput = {
  sessionId: string;
  messageId: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  anchorText: string;
  body: string;
};
