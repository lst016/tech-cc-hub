export function formatShortTime(value?: number) {
  if (!value) return "";
  const date = new Date(value);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function estimateTokensFromText(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}
