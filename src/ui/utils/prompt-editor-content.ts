import type { SlashCommandDisplayPart } from "./slash-command-display";
import { IMAGE_GENERATION_PLUGIN_TOKEN } from "../components/prompt-input/image-generation-plugin";
import { buildLarkMentionDisplayParts } from "../components/prompt-input/lark-mention-options";

function isPromptEditorSentinelNode(node: Node): boolean {
  return node instanceof HTMLElement && node.dataset.promptEditorSentinel === "true";
}

function isNativeEmptyPromptEditorPlaceholder(node: Node): boolean {
  if (isPromptEditorSentinelNode(node)) return true;
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").length === 0;
  if (node instanceof HTMLBRElement) return true;
  if (!(node instanceof HTMLElement)) return false;
  if (node.dataset.slashCommandName) return false;
  if ((node.textContent ?? "").length > 0) return false;
  return Array.from(node.childNodes).every(isNativeEmptyPromptEditorPlaceholder);
}

function isNativeEmptyPromptEditor(editor: HTMLElement): boolean {
  const childNodes = Array.from(editor.childNodes);
  const hasSentinel = childNodes.some(isPromptEditorSentinelNode);
  const nodes = childNodes.filter((node) => !isPromptEditorSentinelNode(node));
  if (nodes.length === 0) return true;
  if (hasSentinel) return false;
  return nodes.length === 0 || nodes.every(isNativeEmptyPromptEditorPlaceholder);
}

function getPromptTextFromEditorNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node instanceof HTMLElement) {
    if (isPromptEditorSentinelNode(node)) {
      return "";
    }
    const commandName = node.dataset.slashCommandName;
    if (commandName) {
      return `/${commandName}`;
    }
    if (node.dataset.imageGenerationPlugin === "true") {
      return IMAGE_GENERATION_PLUGIN_TOKEN;
    }
    if (node.dataset.larkMentionRaw) {
      return node.dataset.larkMentionRaw;
    }
  }
  if (node instanceof HTMLBRElement) {
    return "\n";
  }

  let text = "";
  node.childNodes.forEach((child) => {
    text += getPromptTextFromEditorNode(child);
  });
  return text;
}

export function getPromptTextFromEditor(editor: HTMLElement) {
  if (isNativeEmptyPromptEditor(editor)) {
    return "";
  }

  let text = "";
  editor.childNodes.forEach((child) => {
    text += getPromptTextFromEditorNode(child);
  });
  return text;
}

function getNodePromptLength(node: Node): number {
  return getPromptTextFromEditorNode(node).length;
}

function getEditorBoundaryOffset(editor: HTMLElement, targetNode: Node, targetOffset: number) {
  let offset = 0;
  let found = false;

  const visit = (node: Node) => {
    if (found) return;
    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += Math.min(targetOffset, node.textContent?.length ?? 0);
      } else {
        for (let index = 0; index < Math.min(targetOffset, node.childNodes.length); index += 1) {
          offset += getNodePromptLength(node.childNodes[index]);
        }
      }
      found = true;
      return;
    }

    if (
      node instanceof HTMLElement
      && (node.dataset.slashCommandName || node.dataset.imageGenerationPlugin === "true" || node.dataset.larkMentionRaw)
    ) {
      offset += getNodePromptLength(node);
      return;
    }

    if (node.nodeType === Node.TEXT_NODE || node instanceof HTMLBRElement) {
      offset += getNodePromptLength(node);
      return;
    }

    node.childNodes.forEach(visit);
  };

  visit(editor);
  return offset;
}

export function getSelectionOffsetInEditor(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return getPromptTextFromEditor(editor).length;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return getPromptTextFromEditor(editor).length;
  return getEditorBoundaryOffset(editor, range.startContainer, range.startOffset);
}

export function getSelectionRangeInEditor(editor: HTMLElement) {
  const selection = window.getSelection();
  const fallback = getPromptTextFromEditor(editor).length;
  if (!selection || selection.rangeCount === 0) return { start: fallback, end: fallback };
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
    return { start: fallback, end: fallback };
  }
  const start = getEditorBoundaryOffset(editor, range.startContainer, range.startOffset);
  const end = getEditorBoundaryOffset(editor, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function findEditorPositionForOffset(editor: HTMLElement, offset: number): { node: Node; offset: number } {
  let remaining = Math.max(0, offset);

  const visit = (node: Node): { node: Node; offset: number } | null => {
    if (node instanceof HTMLElement && node.dataset.promptEditorSentinel) {
      return null;
    }

    if (
      node instanceof HTMLElement
      && (node.dataset.slashCommandName || node.dataset.imageGenerationPlugin === "true" || node.dataset.larkMentionRaw)
    ) {
      const length = getNodePromptLength(node);
      if (remaining <= length) {
        return {
          node: editor,
          offset: Array.prototype.indexOf.call(editor.childNodes, node) + 1,
        };
      }
      remaining -= length;
      return null;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length ?? 0;
      if (remaining <= textLength) {
        return { node, offset: remaining };
      }
      remaining -= textLength;
      return null;
    }

    if (node instanceof HTMLBRElement) {
      if (remaining <= 1) {
        return {
          node: editor,
          offset: Array.prototype.indexOf.call(editor.childNodes, node) + 1,
        };
      }
      remaining -= 1;
      return null;
    }

    for (const child of Array.from(node.childNodes)) {
      const position = visit(child);
      if (position) return position;
    }
    return null;
  };

  for (const child of Array.from(editor.childNodes)) {
    const position = visit(child);
    if (position) return position;
  }

  return { node: editor, offset: editor.childNodes.length };
}

export function restoreEditorSelection(editor: HTMLElement, offset: number) {
  const position = findEditorPositionForOffset(editor, offset);
  const range = document.createRange();
  range.setStart(position.node, position.offset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function createSlashCommandIconElement() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "h-[18px] w-[18px] shrink-0 translate-y-[3px]");

  for (const d of [
    "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
    "m3.3 7 8.7 5 8.7-5",
    "M12 22V12",
  ]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }

  return svg;
}

function createImageGenerationPluginElement(onConfigure?: () => void, onRemove?: () => void) {
  const token = document.createElement("span");
  token.dataset.imageGenerationPlugin = "true";
  token.contentEditable = "false";
  token.className = "mx-1 inline-flex select-none items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 align-baseline text-[14px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200";

  const configure = document.createElement("button");
  configure.type = "button";
  configure.className = "inline-flex items-center gap-1 outline-none";
  configure.textContent = "生图 ⚙";
  configure.addEventListener("click", (event) => {
    event.preventDefault();
    onConfigure?.();
  });
  token.appendChild(configure);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.ariaLabel = "移除生图插件";
  remove.className = "rounded-sm px-0.5 hover:bg-blue-100";
  remove.textContent = "×";
  remove.addEventListener("click", (event) => {
    event.preventDefault();
    onRemove?.();
  });
  token.appendChild(remove);
  return token;
}

function createLarkMentionElement(part: Extract<ReturnType<typeof buildLarkMentionDisplayParts>[number], { type: "mention" }>) {
  const token = document.createElement("span");
  token.dataset.larkMentionRaw = part.raw;
  token.dataset.larkMentionOpenId = part.openId;
  token.contentEditable = "false";
  token.className = "mx-0.5 inline-flex select-none items-center rounded-md bg-[#e8f3ff] px-1.5 py-0.5 align-baseline text-[15px] font-medium text-[#3370ff] ring-1 ring-inset ring-[#d6e4ff]";
  token.title = `飞书联系人 · ${part.name}`;
  token.ariaLabel = `飞书联系人 ${part.name}`;
  token.textContent = `@${part.name}`;
  return token;
}

function appendPlainPromptText(fragment: DocumentFragment, text: string) {
  const lines = text.split("\n");
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) fragment.appendChild(document.createElement("br"));
    if (line) fragment.appendChild(document.createTextNode(line));
  });
}

function appendPromptTextNode(
  fragment: DocumentFragment,
  text: string,
  onConfigureImageGeneration?: () => void,
  onRemoveImageGeneration?: () => void,
) {
  const segments = text.split(IMAGE_GENERATION_PLUGIN_TOKEN);
  segments.forEach((segment, index) => {
    if (segment) {
      for (const part of buildLarkMentionDisplayParts(segment)) {
        if (part.type === "mention") {
          fragment.appendChild(createLarkMentionElement(part));
        } else {
          appendPlainPromptText(fragment, part.text);
        }
      }
    }
    if (index < segments.length - 1) {
      fragment.appendChild(createImageGenerationPluginElement(onConfigureImageGeneration, onRemoveImageGeneration));
    }
  });
}

function appendPromptEditorSentinel(fragment: DocumentFragment) {
  const sentinel = document.createElement("br");
  sentinel.dataset.promptEditorSentinel = "true";
  fragment.appendChild(sentinel);
}

export function renderPromptEditorContent(
  editor: HTMLElement,
  parts: SlashCommandDisplayPart[],
  onConfigureImageGeneration?: () => void,
  onRemoveImageGeneration?: () => void,
) {
  const fragment = document.createDocumentFragment();
  let rawPromptText = "";

  for (const part of parts) {
    if (part.type === "text") {
      rawPromptText += part.text;
      appendPromptTextNode(fragment, part.text, onConfigureImageGeneration, onRemoveImageGeneration);
      continue;
    }

    rawPromptText += part.raw;
    const token = document.createElement("span");
    token.dataset.slashCommandName = part.commandName;
    token.contentEditable = "false";
    token.className = "inline-flex max-w-[240px] items-center gap-1.5 align-baseline font-medium text-[#2f80ed]";
    token.title = part.description || part.raw;
    token.appendChild(createSlashCommandIconElement());

    const label = document.createElement("span");
    label.className = "truncate";
    label.textContent = part.displayName;
    token.appendChild(label);
    fragment.appendChild(token);
  }

  if (rawPromptText.endsWith("\n") || rawPromptText.length === 0) {
    appendPromptEditorSentinel(fragment);
  }

  editor.replaceChildren(fragment);
}
