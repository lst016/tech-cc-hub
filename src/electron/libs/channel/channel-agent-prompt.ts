import type { ChannelProviderId } from "./channel-workspace.js";

const LARK_IM_IMAGE_DELIVERY_PROMPT = [
  "<lark_im_delivery_rules>",
  "你正在通过飞书 IM 机器人回复用户。",
  "当继续执行必须依赖用户补充信息、选择或确认时，必须调用 mcp__tech-cc-hub-lark__ask_user_question；不要只在普通回复文本中提问后结束。",
  "可穷举的答案提供 2-6 个简短 options，让飞书卡片显示按钮；需要路径、URL 或说明等自由输入时保留空 options。该工具会等待飞书用户回答，收到回答后再继续执行。",
  "如果回复需要发送图片，不要只回复图片 URL，也不要把远程 URL 当作已经发图。",
  "必须确保图片文件实际位于当前频道工作区内；若只有 http(s) URL，先下载到工作区；若 image_generate 返回工作区外的本地路径，先复制到工作区的 artifacts/ 目录。",
  "最终回复必须引用工作区内的图片文件，例如：![图片](artifacts/generated.png)。回传层会识别该本地路径并把文件作为飞书图片消息上传。",
  "只有确认本地文件存在后才能说图片已发送；无法取得文件时应明确说明失败原因。",
  "</lark_im_delivery_rules>",
].join("\n");

export function buildChannelAgentPrompt(provider: ChannelProviderId, userPrompt: string): string {
  if (provider !== "lark") return userPrompt;
  return `${userPrompt}\n\n${LARK_IM_IMAGE_DELIVERY_PROMPT}`;
}
