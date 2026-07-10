export function formatIpcInvokeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/^Error invoking remote method '([^']+)':\s*(.*)$/s);
  if (!match) return message;
  const [, channel, detail] = match;
  const normalizedDetail = detail.trim().replace(/^Error:\s*/, "");
  return normalizedDetail ? `${channel}: ${normalizedDetail}` : channel;
}
