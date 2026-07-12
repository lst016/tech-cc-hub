export type ChartTextSegment = { type: "text"; text: string };
export type ChartConfigSegment = { type: "chart"; json: string };
export type ChartContentSegment = ChartTextSegment | ChartConfigSegment;

type SourceLine = {
  start: number;
  end: number;
  nextStart: number;
  text: string;
};

const ECHARTS_START_PATTERN = /^:::echarts[\t ]*$/;
const ECHARTS_END_PATTERN = /^:::[\t ]*$/;
const MARKDOWN_FENCE_PATTERN = /^[\t ]{0,3}(`{3,}|~{3,})/;
const MARKDOWN_FENCE_CLOSE_PATTERN = /^[\t ]{0,3}(`{3,}|~{3,})[\t ]*$/;

function splitSourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;

  while (start < source.length) {
    const newlineIndex = source.indexOf("\n", start);
    const hasNewline = newlineIndex >= 0;
    const rawEnd = hasNewline ? newlineIndex : source.length;
    const end = rawEnd > start && source[rawEnd - 1] === "\r" ? rawEnd - 1 : rawEnd;
    const nextStart = hasNewline ? newlineIndex + 1 : source.length;
    lines.push({ start, end, nextStart, text: source.slice(start, end) });
    start = nextStart;
  }

  return lines;
}

function isMatchingMarkdownFence(line: string, activeFence: string): boolean {
  const match = MARKDOWN_FENCE_CLOSE_PATTERN.exec(line);
  return Boolean(match && match[1]?.[0] === activeFence[0] && match[1].length >= activeFence.length);
}

function parseChartBlocks(text: string): { segments: ChartContentSegment[]; incompleteStart: number | null } {
  const lines = splitSourceLines(text);
  const segments: ChartContentSegment[] = [];
  let lastTextStart = 0;
  let activeMarkdownFence = "";
  let incompleteStart: number | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;

    if (activeMarkdownFence) {
      if (isMatchingMarkdownFence(line.text, activeMarkdownFence)) {
        activeMarkdownFence = "";
      }
      continue;
    }

    const markdownFence = MARKDOWN_FENCE_PATTERN.exec(line.text)?.[1];
    if (markdownFence) {
      activeMarkdownFence = markdownFence;
      continue;
    }

    if (!ECHARTS_START_PATTERN.test(line.text)) continue;

    let closingIndex = -1;
    for (let candidateIndex = index + 1; candidateIndex < lines.length; candidateIndex += 1) {
      const candidate = lines[candidateIndex];
      if (candidate && ECHARTS_END_PATTERN.test(candidate.text)) {
        closingIndex = candidateIndex;
        break;
      }
    }

    if (closingIndex < 0) {
      incompleteStart = line.start;
      break;
    }

    if (line.start > lastTextStart) {
      segments.push({ type: "text", text: text.slice(lastTextStart, line.start) });
    }

    const closingLine = lines[closingIndex];
    if (!closingLine) continue;
    segments.push({
      type: "chart",
      json: text.slice(line.nextStart, closingLine.start).trim(),
    });
    lastTextStart = closingLine.nextStart;
    index = closingIndex;
  }

  if (segments.length === 0) {
    return { segments: [{ type: "text", text }], incompleteStart };
  }

  if (lastTextStart < text.length) {
    segments.push({ type: "text", text: text.slice(lastTextStart) });
  }

  return { segments, incompleteStart };
}

export function extractChartBlocks(text: string): ChartContentSegment[] {
  return parseChartBlocks(text).segments;
}

export function stripChartBlocks(text: string): string {
  const parsed = parseChartBlocks(text);
  const safeText = parsed.incompleteStart === null ? text : text.slice(0, parsed.incompleteStart);
  return parseChartBlocks(safeText).segments
    .filter((segment): segment is ChartTextSegment => segment.type === "text")
    .map((segment) => segment.text)
    .join("")
    .replace(/(?:\r?\n){3,}/g, "\n\n")
    .trim();
}
