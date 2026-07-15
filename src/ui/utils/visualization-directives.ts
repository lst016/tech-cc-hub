export type VisualizationTextSegment = { type: "text"; text: string };
export type VisualizationArtifactSegment = {
  type: "visualization";
  file: string;
  title?: string;
};
export type VisualizationContentSegment =
  | VisualizationTextSegment
  | VisualizationArtifactSegment;

type SourceLine = {
  start: number;
  end: number;
  nextStart: number;
  text: string;
};

type VisualizationMatch = {
  start: number;
  end: number;
  file: string;
  title?: string;
};

const DIRECTIVE_PREFIX = "::techcc-inline-vis{";
const DIRECTIVE_PATTERN =
  /^::techcc-inline-vis\{file="([^"\r\n]+)"(?:[\t ]+title="([^"\r\n]*)")?[\t ]*\}/;
const MARKDOWN_FENCE_PATTERN = /^[\t ]{0,3}(`{3,}|~{3,})/;
const MARKDOWN_FENCE_CLOSE_PATTERN = /^[\t ]{0,3}(`{3,}|~{3,})[\t ]*$/;
const WINDOWS_RESERVED_FILE_STEM = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

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

export function isSafeVisualizationFileName(fileName: string): boolean {
  if (!fileName || fileName.length > 255 || fileName.trim() !== fileName) return false;
  if (!fileName.toLowerCase().endsWith(".html")) return false;
  const hasControlCharacter = Array.from(fileName).some((character) => character.charCodeAt(0) <= 0x1f);
  if (fileName.includes("..") || /[\\/:*?"<>|]/.test(fileName) || hasControlCharacter) return false;

  const stem = fileName.slice(0, -".html".length);
  if (!stem || WINDOWS_RESERVED_FILE_STEM.test(stem)) return false;

  return /^[\p{L}\p{N}_-](?:[\p{L}\p{N} ._-]*[\p{L}\p{N}_-])?$/u.test(stem);
}

function parseVisualizationDirectives(text: string): {
  segments: VisualizationContentSegment[];
  incompleteStart: number | null;
} {
  const matches: VisualizationMatch[] = [];
  let activeMarkdownFence = "";
  let incompleteStart: number | null = null;

  lineLoop: for (const line of splitSourceLines(text)) {
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

    let cursor = 0;
    while (cursor < line.text.length) {
      const directiveStart = line.text.indexOf(DIRECTIVE_PREFIX, cursor);
      if (directiveStart < 0) break;

      const candidate = line.text.slice(directiveStart);
      const directive = DIRECTIVE_PATTERN.exec(candidate);
      if (directive) {
        const file = directive[1] ?? "";
        if (isSafeVisualizationFileName(file)) {
          const absoluteStart = line.start + directiveStart;
          matches.push({
            start: absoluteStart,
            end: absoluteStart + directive[0].length,
            file,
            ...(directive[2] === undefined ? {} : { title: directive[2] }),
          });
        }
        cursor = directiveStart + directive[0].length;
        continue;
      }

      const closingBrace = line.text.indexOf("}", directiveStart + DIRECTIVE_PREFIX.length);
      if (closingBrace < 0) {
        incompleteStart = line.start + directiveStart;
        break lineLoop;
      }
      cursor = closingBrace + 1;
    }
  }

  if (matches.length === 0) {
    return { segments: [{ type: "text", text }], incompleteStart };
  }

  const segments: VisualizationContentSegment[] = [];
  let lastTextStart = 0;

  for (const match of matches) {
    if (match.start > lastTextStart) {
      segments.push({ type: "text", text: text.slice(lastTextStart, match.start) });
    }
    segments.push({
      type: "visualization",
      file: match.file,
      ...(match.title === undefined ? {} : { title: match.title }),
    });
    lastTextStart = match.end;
  }

  if (lastTextStart < text.length) {
    segments.push({ type: "text", text: text.slice(lastTextStart) });
  }

  return { segments, incompleteStart };
}

export function extractVisualizationDirectives(text: string): VisualizationContentSegment[] {
  return parseVisualizationDirectives(text).segments;
}

export function stripVisualizationDirectives(text: string): string {
  const parsed = parseVisualizationDirectives(text);
  const safeText = parsed.incompleteStart === null ? text : text.slice(0, parsed.incompleteStart);

  return parseVisualizationDirectives(safeText).segments
    .filter((segment): segment is VisualizationTextSegment => segment.type === "text")
    .map((segment) => segment.text)
    .join("")
    .replace(/(?:\r?\n){3,}/g, "\n\n")
    .trim();
}
