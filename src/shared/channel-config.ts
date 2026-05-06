export type ChannelChatToggleConfig = {
  enabled?: boolean;
  chatEnabled?: boolean;
};

export function isChannelChatEnabled(config: ChannelChatToggleConfig | null | undefined): boolean {
  if (!config?.enabled) return false;
  return typeof config.chatEnabled === "boolean" ? config.chatEnabled : true;
}
