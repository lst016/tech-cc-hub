import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  fileToAttachment,
  hasDraggedFiles,
  PROMPT_ATTACHMENT_ACCEPT,
} from "../../src/ui/components/prompt-input/prompt-attachments.js";

function dataTransfer(input: {
  types?: string[];
  items?: Array<{ kind: string }>;
  filesLength?: number;
}): DataTransfer {
  return {
    types: input.types ?? [],
    items: input.items ?? [],
    files: { length: input.filesLength ?? 0 },
  } as unknown as DataTransfer;
}

test("prompt attachment drag detection accepts common file drag signals", () => {
  assert.equal(hasDraggedFiles(dataTransfer({ types: ["Files"] })), true);
  assert.equal(hasDraggedFiles(dataTransfer({ types: ["files"] })), true);
  assert.equal(hasDraggedFiles(dataTransfer({ types: ["application/x-moz-file"] })), true);
  assert.equal(hasDraggedFiles(dataTransfer({ items: [{ kind: "file" }] })), true);
  assert.equal(hasDraggedFiles(dataTransfer({ filesLength: 1 })), true);
  assert.equal(
    hasDraggedFiles(dataTransfer({ types: ["text/plain"], items: [{ kind: "string" }], filesLength: 0 })),
    false,
  );
});

test("prompt input exposes an explicit attachment picker button", () => {
  const footerPath = "src/ui/components/prompt-input/PromptComposerFooter.tsx";
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const source = [
    promptInputSource,
    existsSync(footerPath) ? readFileSync(footerPath, "utf8") : "",
  ].join("\n");

  assert.match(source, /Paperclip/);
  assert.match(promptInputSource, /const handleSelectAttachmentClick = useCallback/);
  assert.match(promptInputSource, /fileInputRef\.current\?\.click\(\)/);
  assert.match(source, /aria-label="添加附件"/);
  assert.match(source, /title="添加附件"/);
});

test("prompt input handles file drops on the full composer shell", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const sectionStart = source.indexOf("<section");
  const cardStart = source.indexOf("prompt-composer-card", sectionStart);
  const sectionOpen = source.slice(sectionStart, cardStart);

  assert.ok(sectionStart >= 0);
  assert.ok(cardStart > sectionStart);
  assert.match(sectionOpen, /onDragEnter=\{handleComposerDragEnter\}/);
  assert.match(sectionOpen, /onDragOver=\{handleComposerDragOver\}/);
  assert.match(sectionOpen, /onDragLeave=\{handleComposerDragLeave\}/);
  assert.match(sectionOpen, /onDrop=\{\(event\) => \{ void handleComposerDrop\(event\); \}\}/);
  assert.match(source, /window\.addEventListener\("dragover", preventWindowFileNavigation\)/);
  assert.match(source, /window\.addEventListener\("drop", preventWindowFileNavigation\)/);
});

test("prompt input routes the picker accept list through attachment support", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");

  assert.match(source, /accept=\{PROMPT_ATTACHMENT_ACCEPT\}/);
  for (const extension of [".doc", ".docx", ".docm", ".xls", ".xlsx", ".xlsm", ".ppt", ".pptx", ".pptm", ".pdf", ".rtf", ".odt", ".ods", ".odp", ".zip"]) {
    assert.match(PROMPT_ATTACHMENT_ACCEPT, new RegExp(extension.replace(".", "\\.")));
  }
});

test("prompt send path dispatches image attachments without blocking on preprocessing", () => {
  const source = readFileSync("src/ui/components/prompt-input/usePromptActions.ts", "utf8");
  const sendStart = source.indexOf("const sendPromptDraft = useCallback");
  const handleSendStart = source.indexOf("const handleSend = useCallback", sendStart);
  const sendSection = source.slice(sendStart, handleSendStart);

  assert.ok(sendStart >= 0);
  assert.ok(handleSendStart > sendStart);
  assert.doesNotMatch(source, /prepareAttachmentsForDispatch/);
  assert.doesNotMatch(sendSection, /preprocessImageAttachments/);
  assert.doesNotMatch(sendSection, /preparedAttachments/);
  assert.equal(sendSection.match(/\battachments,\r?\n\s+runtime,/g)?.length, 2);
});

test("fileToAttachment extracts readable text from xlsx workbooks", async () => {
  const workbook = makeStoreZip({
    "xl/workbook.xml": [
      '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      "<sheets>",
      '<sheet name="June" sheetId="1" r:id="rId1"/>',
      "</sheets>",
      "</workbook>",
    ].join(""),
    "xl/_rels/workbook.xml.rels": [
      "<Relationships>",
      '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/>',
      "</Relationships>",
    ].join(""),
    "xl/sharedStrings.xml": [
      "<sst>",
      "<si><t>Item</t></si>",
      "<si><t>Alice &amp; Bob</t></si>",
      "</sst>",
    ].join(""),
    "xl/worksheets/sheet1.xml": [
      "<worksheet><sheetData>",
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Total</t></is></c></row>',
      '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>42</v></c></row>',
      "</sheetData></worksheet>",
    ].join(""),
  });

  const attachment = await fileToAttachment(new File([workbook], "report.xlsx", {
    type: "application/zip",
  }));

  assert.equal(attachment.kind, "text");
  assert.equal(attachment.mimeType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.match(attachment.data, /# Sheet: June/);
  assert.match(attachment.data, /Item\tTotal/);
  assert.match(attachment.data, /Alice & Bob\t42/);
});

test("fileToAttachment keeps unsupported binary files as best-effort text attachments", async () => {
  const bytes = toArrayBuffer(new TextEncoder().encode("\0\0Quarterly revenue table\0\0Important appendix"));
  const attachment = await fileToAttachment(new File([bytes], "legacy-report.xls", {
    type: "application/vnd.ms-excel",
  }));

  assert.equal(attachment.kind, "text");
  assert.equal(attachment.name, "legacy-report.xls");
  assert.match(attachment.data, /No dedicated parser is available/);
  assert.match(attachment.data, /Recovered readable text preview/);
  assert.match(attachment.data, /Quarterly revenue table/);
});

function makeStoreZip(entries: Record<string, string>): ArrayBuffer {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const localHeader = makeLocalHeader(nameBytes, contentBytes.length);
    const centralHeader = makeCentralHeader(nameBytes, contentBytes.length, offset);

    localParts.push(localHeader, contentBytes);
    centralParts.push(centralHeader);
    offset += localHeader.byteLength + contentBytes.byteLength;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = concatBytes(centralParts);
  const end = makeEndOfCentralDirectory(Object.keys(entries).length, centralDirectory.byteLength, centralDirectoryOffset);
  return toArrayBuffer(concatBytes([...localParts, centralDirectory, end]));
}

function makeLocalHeader(nameBytes: Uint8Array, size: number): Uint8Array {
  const header = new Uint8Array(30 + nameBytes.byteLength);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint32(14, 0, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.byteLength, true);
  header.set(nameBytes, 30);
  return header;
}

function makeCentralHeader(nameBytes: Uint8Array, size: number, localHeaderOffset: number): Uint8Array {
  const header = new Uint8Array(46 + nameBytes.byteLength);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, 0, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.byteLength, true);
  view.setUint32(42, localHeaderOffset, true);
  header.set(nameBytes, 46);
  return header;
}

function makeEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  return header;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
