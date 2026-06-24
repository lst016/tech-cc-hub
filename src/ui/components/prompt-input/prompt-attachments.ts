import type { PromptAttachment } from "../../types.js";

const MAX_TEXT_ATTACHMENT_LENGTH = 60_000;
const MAX_TEXT_ATTACHMENT_READ_BYTES = 2_000_000;
const MAX_OFFICE_ATTACHMENT_BYTES = 40 * 1024 * 1024;
const MAX_BINARY_TEXT_BYTES = 2_000_000;
const MAX_BINARY_RECOVERED_LINES = 180;
const MAX_BINARY_RECOVERED_CHARS = 30_000;
const MAX_IMAGE_EDGE = 1600;
const IMAGE_JPEG_QUALITY = 0.88;

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const SVG_MIME_TYPE = "image/svg+xml";

const TEXT_FILE_PATTERN = /\.(txt|md|markdown|json|jsonl|ndjson|ya?ml|xml|svg|csv|tsv|log|js|jsx|ts|tsx|py|rb|java|go|rs|sh|bash|zsh|ps1|css|scss|less|html?|sql|toml|ini|env|rtf|diff|patch|adoc|rst)$/i;
const OFFICE_OPEN_XML_PATTERN = /\.(docx|docm|dotx|xlsx|xlsm|xltx|pptx|pptm|potx)$/i;
const OPEN_DOCUMENT_PATTERN = /\.(odt|ods|odp)$/i;
const ARCHIVE_FILE_PATTERN = /\.(zip|7z|rar|tar|tgz|tar\.gz|gz|bz2|xz)$/i;

const TEXT_MIME_TYPES = new Set([
  "application/javascript",
  "application/json",
  "application/ld+json",
  "application/rtf",
  "application/sql",
  "application/x-ndjson",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
]);

const MIME_TYPE_BY_EXTENSION = new Map<string, string>([
  [".csv", "text/csv"],
  [".doc", "application/msword"],
  [".docm", "application/vnd.ms-word.document.macroenabled.12"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".dotx", "application/vnd.openxmlformats-officedocument.wordprocessingml.template"],
  [".gif", "image/gif"],
  [".gz", "application/gzip"],
  [".htm", "text/html"],
  [".html", "text/html"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".json", "application/json"],
  [".jsonl", "application/x-ndjson"],
  [".md", "text/markdown"],
  [".odp", "application/vnd.oasis.opendocument.presentation"],
  [".ods", "application/vnd.oasis.opendocument.spreadsheet"],
  [".odt", "application/vnd.oasis.opendocument.text"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".potx", "application/vnd.openxmlformats-officedocument.presentationml.template"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptm", "application/vnd.ms-powerpoint.presentation.macroenabled.12"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".rtf", "application/rtf"],
  [".svg", SVG_MIME_TYPE],
  [".tar", "application/x-tar"],
  [".tgz", "application/gzip"],
  [".tsv", "text/tab-separated-values"],
  [".txt", "text/plain"],
  [".webp", "image/webp"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsm", "application/vnd.ms-excel.sheet.macroenabled.12"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".xltx", "application/vnd.openxmlformats-officedocument.spreadsheetml.template"],
  [".xml", "application/xml"],
  [".yaml", "application/yaml"],
  [".yml", "application/yaml"],
  [".zip", "application/zip"],
]);

export const PROMPT_ATTACHMENT_ACCEPT = [
  "image/*",
  "text/*",
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".jsonl",
  ".ndjson",
  ".yaml",
  ".yml",
  ".xml",
  ".svg",
  ".csv",
  ".tsv",
  ".log",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".rb",
  ".java",
  ".go",
  ".rs",
  ".sh",
  ".bash",
  ".zsh",
  ".ps1",
  ".css",
  ".scss",
  ".less",
  ".html",
  ".htm",
  ".sql",
  ".toml",
  ".ini",
  ".env",
  ".rtf",
  ".diff",
  ".patch",
  ".doc",
  ".docx",
  ".docm",
  ".xls",
  ".xlsx",
  ".xlsm",
  ".ppt",
  ".pptx",
  ".pptm",
  ".pdf",
  ".odt",
  ".ods",
  ".odp",
  ".zip",
  ".7z",
  ".rar",
  ".tar",
  ".tgz",
  ".gz",
  ".bz2",
  ".xz",
].join(",");

type ZipDirectoryEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

type ZipArchive = {
  entries: ZipDirectoryEntry[];
  getEntry(name: string): ZipDirectoryEntry | undefined;
  readText(entry: ZipDirectoryEntry): Promise<string>;
};

export function hasDraggedFiles(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;

  const types = Array.from(dataTransfer.types ?? []);
  if (types.some((type) => {
    const normalized = type.toLowerCase();
    return normalized === "files" || normalized === "application/x-moz-file";
  })) {
    return true;
  }

  if (Array.from(dataTransfer.items ?? []).some((item) => item.kind === "file")) {
    return true;
  }

  return (dataTransfer.files?.length ?? 0) > 0;
}

async function readFileAsDataUrl(file: Blob, mimeType: string): Promise<string> {
  const buffer = await readFileAsArrayBuffer(file);
  return `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`;
}

async function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return await file.arrayBuffer();
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

async function readFileAsText(file: Blob): Promise<string> {
  if (typeof file.text === "function") {
    return await file.text();
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function blobToDataUrl(blob: Blob, mimeType: string): Promise<string> {
  return await readFileAsDataUrl(blob, mimeType);
}

async function downscaleImageFile(file: File): Promise<{ dataUrl: string; mimeType: string; size: number }> {
  const sourceMimeType = resolveMimeType(file, "image/png");
  if (sourceMimeType === "image/gif") {
    const dataUrl = await readFileAsDataUrl(file, sourceMimeType);
    return { dataUrl, mimeType: sourceMimeType, size: file.size };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));

    if (scale >= 1) {
      const dataUrl = await readFileAsDataUrl(file, sourceMimeType);
      return { dataUrl, mimeType: sourceMimeType, size: file.size };
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      const dataUrl = await readFileAsDataUrl(file, sourceMimeType);
      return { dataUrl, mimeType: sourceMimeType, size: file.size };
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", IMAGE_JPEG_QUALITY);
    });

    if (!blob) {
      const dataUrl = await readFileAsDataUrl(file, sourceMimeType);
      return { dataUrl, mimeType: sourceMimeType, size: file.size };
    }

    return {
      dataUrl: await blobToDataUrl(blob, "image/jpeg"),
      mimeType: "image/jpeg",
      size: blob.size,
    };
  } finally {
    bitmap?.close();
  }
}

function isTextFile(file: File): boolean {
  const mimeType = resolveMimeType(file).toLowerCase();
  return mimeType.startsWith("text/")
    || TEXT_MIME_TYPES.has(mimeType)
    || TEXT_FILE_PATTERN.test(file.name);
}

function isOfficeOpenXmlFile(file: File): boolean {
  const mimeType = resolveMimeType(file).toLowerCase();
  return OFFICE_OPEN_XML_PATTERN.test(file.name)
    || mimeType.includes("officedocument.wordprocessingml.document")
    || mimeType.includes("officedocument.spreadsheetml.sheet")
    || mimeType.includes("officedocument.presentationml.presentation");
}

function isOpenDocumentFile(file: File): boolean {
  const mimeType = resolveMimeType(file).toLowerCase();
  return OPEN_DOCUMENT_PATTERN.test(file.name) || mimeType.includes("opendocument.");
}

export async function fileToAttachment(file: File): Promise<PromptAttachment> {
  const mimeType = resolveMimeType(file, "application/octet-stream");

  if (mimeType === SVG_MIME_TYPE || /\.svg$/i.test(file.name)) {
    const text = await readTextAttachment(file);
    return createTextAttachment(file, text, mimeType);
  }

  if (mimeType.startsWith("image/")) {
    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
      return await createFallbackTextAttachment(
        file,
        `Image format ${mimeType} is attached, but this build can only preview PNG, JPEG, GIF, and WebP image pixels.`,
      );
    }

    const normalizedImage = await downscaleImageFile(file);
    return {
      id: crypto.randomUUID(),
      kind: "image",
      name: file.name || `image-${Date.now()}.png`,
      mimeType: normalizedImage.mimeType,
      data: normalizedImage.dataUrl,
      preview: normalizedImage.dataUrl,
      size: normalizedImage.size,
    };
  }

  if (isTextFile(file)) {
    const text = await readTextAttachment(file);
    return createTextAttachment(file, text, mimeType);
  }

  if (isOfficeOpenXmlFile(file)) {
    if (file.size > MAX_OFFICE_ATTACHMENT_BYTES) {
      return await createFallbackTextAttachment(
        file,
        `Office attachment is ${formatBytes(file.size)}, above the ${formatBytes(MAX_OFFICE_ATTACHMENT_BYTES)} extraction limit.`,
      );
    }

    try {
      const text = await extractOfficeOpenXmlText(file);
      return createTextAttachment(file, text, mimeType);
    } catch (error) {
      return await createFallbackTextAttachment(file, `Office text extraction failed: ${formatError(error)}`);
    }
  }

  if (isOpenDocumentFile(file)) {
    if (file.size > MAX_OFFICE_ATTACHMENT_BYTES) {
      return await createFallbackTextAttachment(
        file,
        `OpenDocument attachment is ${formatBytes(file.size)}, above the ${formatBytes(MAX_OFFICE_ATTACHMENT_BYTES)} extraction limit.`,
      );
    }

    try {
      const text = await extractOpenDocumentText(file);
      return createTextAttachment(file, text, mimeType);
    } catch (error) {
      return await createFallbackTextAttachment(file, `OpenDocument text extraction failed: ${formatError(error)}`);
    }
  }

  return await createFallbackTextAttachment(file);
}

async function readTextAttachment(file: File): Promise<string> {
  if (file.size <= MAX_TEXT_ATTACHMENT_READ_BYTES) {
    return truncateAttachmentText(await readFileAsText(file));
  }

  const previewBlob = file.slice(0, MAX_TEXT_ATTACHMENT_READ_BYTES, resolveMimeType(file, "text/plain"));
  const preview = await readFileAsText(previewBlob);
  return truncateAttachmentText(
    `${preview}\n\n[Attachment preview truncated at ${formatBytes(MAX_TEXT_ATTACHMENT_READ_BYTES)}; original size ${formatBytes(file.size)}.]`,
  );
}

function createTextAttachment(file: File, text: string, mimeType = resolveMimeType(file, "text/plain")): PromptAttachment {
  const normalizedText = truncateAttachmentText(text.trim() || "[Attachment contains no extractable text.]");
  return {
    id: crypto.randomUUID(),
    kind: "text",
    name: file.name || `attachment-${Date.now()}`,
    mimeType,
    data: normalizedText,
    preview: normalizedText,
    size: file.size,
  };
}

async function createFallbackTextAttachment(file: File, reason?: string): Promise<PromptAttachment> {
  const mimeType = resolveMimeType(file, "application/octet-stream");
  const details = await buildGenericAttachmentSummary(file, mimeType, reason);
  return createTextAttachment(file, details, mimeType);
}

async function buildGenericAttachmentSummary(file: File, mimeType: string, reason?: string): Promise<string> {
  const lines = [
    `Attachment file: ${file.name || "unnamed attachment"}`,
    `Type: ${mimeType}`,
    `Size: ${formatBytes(file.size)}`,
    reason
      ? `Extraction note: ${reason}`
      : "Extraction note: No dedicated parser is available for this attachment type; metadata and best-effort text recovery are included.",
  ];

  if (ARCHIVE_FILE_PATTERN.test(file.name) || mimeType === "application/zip") {
    const archiveEntries = await tryListZipEntries(file);
    if (archiveEntries.length > 0) {
      lines.push("", "Archive entries:", ...archiveEntries.map((entry) => `- ${entry}`));
    }
  }

  const recoveredText = await recoverReadableBinaryText(file);
  if (recoveredText) {
    lines.push("", "Recovered readable text preview:", recoveredText);
  }

  return lines.join("\n");
}

async function extractOfficeOpenXmlText(file: File): Promise<string> {
  const archive = await readZipArchive(await readFileAsArrayBuffer(file));
  const extension = getFileExtension(file.name).toLowerCase();

  if (extension === ".xlsx" || extension === ".xlsm" || extension === ".xltx") {
    return truncateAttachmentText(await extractXlsxText(archive));
  }

  if (extension === ".docx" || extension === ".docm" || extension === ".dotx") {
    return truncateAttachmentText(await extractDocxText(archive));
  }

  if (extension === ".pptx" || extension === ".pptm" || extension === ".potx") {
    return truncateAttachmentText(await extractPptxText(archive));
  }

  const officeEntries = archive.entries
    .map((entry) => entry.name)
    .filter((name) => /\.(xml|rels)$/i.test(name))
    .sort(compareNatural)
    .slice(0, 80);

  const textParts: string[] = [];
  for (const name of officeEntries) {
    const entry = archive.getEntry(name);
    if (!entry) continue;
    const xml = await archive.readText(entry);
    const text = extractXmlText(xml);
    if (text.trim()) {
      textParts.push(`# ${name}\n${text.trim()}`);
    }
  }

  return textParts.join("\n\n") || "Office document contains no extractable text.";
}

async function extractOpenDocumentText(file: File): Promise<string> {
  const archive = await readZipArchive(await readFileAsArrayBuffer(file));
  const contentEntry = archive.getEntry("content.xml");
  if (!contentEntry) {
    return "OpenDocument file contains no content.xml text payload.";
  }

  const contentXml = await archive.readText(contentEntry);
  const tableRows = Array.from(contentXml.matchAll(/<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/gi), (rowMatch) => {
    const cells = Array.from((rowMatch[1] ?? "").matchAll(/<table:table-cell\b[^>]*>([\s\S]*?)<\/table:table-cell>/gi), (cellMatch) => (
      extractXmlText(cellMatch[1] ?? "").replace(/\s+/g, " ").trim()
    ));
    return cells.filter(Boolean).join("\t");
  }).filter(Boolean);

  if (tableRows.length > 0) {
    return truncateAttachmentText(tableRows.join("\n"));
  }

  return truncateAttachmentText(extractXmlText(contentXml) || "OpenDocument file contains no extractable text.");
}

async function extractXlsxText(archive: ZipArchive): Promise<string> {
  const sharedStrings = await readXlsxSharedStrings(archive);
  const sheetNames = await readXlsxSheetNames(archive);
  const worksheetEntries = archive.entries
    .map((entry) => entry.name)
    .filter((name) => /^xl\/worksheets\/[^/]+\.xml$/i.test(name))
    .sort(compareNatural);

  const sections: string[] = [];
  for (const name of worksheetEntries) {
    const entry = archive.getEntry(name);
    if (!entry) continue;
    const sheetXml = await archive.readText(entry);
    const rows = extractXlsxRows(sheetXml, sharedStrings);
    const sheetName = sheetNames.get(name) || name.replace(/^xl\/worksheets\//i, "").replace(/\.xml$/i, "");
    sections.push([`# Sheet: ${sheetName}`, rows || "[No visible cell values extracted.]"].join("\n"));
  }

  return sections.join("\n\n") || "Excel workbook contains no extractable worksheets.";
}

async function readXlsxSharedStrings(archive: ZipArchive): Promise<string[]> {
  const entry = archive.getEntry("xl/sharedStrings.xml");
  if (!entry) return [];

  const xml = await archive.readText(entry);
  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi), (match) => extractXmlText(match[1] ?? ""));
}

async function readXlsxSheetNames(archive: ZipArchive): Promise<Map<string, string>> {
  const workbookEntry = archive.getEntry("xl/workbook.xml");
  if (!workbookEntry) return new Map();

  const workbookXml = await archive.readText(workbookEntry);
  const relsEntry = archive.getEntry("xl/_rels/workbook.xml.rels");
  const relTargetById = relsEntry
    ? parseRelationships(await archive.readText(relsEntry), "xl")
    : new Map<string, string>();
  const sheetNames = new Map<string, string>();

  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?>/gi)) {
    const attrs = match[1] ?? "";
    const name = decodeXmlText(getXmlAttribute(attrs, "name") ?? "");
    const relId = getXmlAttribute(attrs, "r:id") ?? getXmlAttribute(attrs, "id");
    const target = relId ? relTargetById.get(relId) : undefined;
    if (target && name) {
      sheetNames.set(target, name);
    }
  }

  return sheetNames;
}

function parseRelationships(xml: string, baseDirectory: string): Map<string, string> {
  const relationships = new Map<string, string>();

  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?>/gi)) {
    const attrs = match[1] ?? "";
    const id = getXmlAttribute(attrs, "Id");
    const target = getXmlAttribute(attrs, "Target");
    if (!id || !target) continue;
    relationships.set(id, normalizeZipPath(target.startsWith("/") ? target.slice(1) : `${baseDirectory}/${target}`));
  }

  return relationships;
}

function extractXlsxRows(sheetXml: string, sharedStrings: string[]): string {
  const lines: string[] = [];
  const rowMatches = Array.from(sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi));
  const rowBodies = rowMatches.length > 0 ? rowMatches.map((match) => match[1] ?? "") : [sheetXml];

  for (const rowBody of rowBodies) {
    const cells: string[] = [];
    let nextColumnIndex = 0;

    for (const cellMatch of rowBody.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attrs = cellMatch[1] ?? "";
      const cellBody = cellMatch[2] ?? "";
      const ref = getXmlAttribute(attrs, "r");
      const columnIndex = ref ? columnIndexFromCellRef(ref) : nextColumnIndex;
      nextColumnIndex = Math.max(nextColumnIndex, columnIndex + 1);

      while (cells.length < columnIndex) {
        cells.push("");
      }

      cells[columnIndex] = extractXlsxCellValue(attrs, cellBody, sharedStrings);
    }

    while (cells.length > 0 && !cells[cells.length - 1]) {
      cells.pop();
    }

    if (cells.some((cell) => cell.trim())) {
      lines.push(cells.map((cell) => cell.replace(/\s+/g, " ").trim()).join("\t"));
    }
  }

  return lines.join("\n");
}

function extractXlsxCellValue(attrs: string, cellBody: string, sharedStrings: string[]): string {
  const type = getXmlAttribute(attrs, "t")?.toLowerCase();
  if (type === "inlinestr") {
    return extractXmlText(cellBody);
  }

  const rawValue = getXmlElementText(cellBody, "v");
  if (type === "s") {
    const sharedStringIndex = Number.parseInt(rawValue, 10);
    return Number.isFinite(sharedStringIndex) ? (sharedStrings[sharedStringIndex] ?? rawValue) : rawValue;
  }

  if (type === "b") {
    return rawValue === "1" ? "TRUE" : rawValue === "0" ? "FALSE" : rawValue;
  }

  if (type === "str") {
    return decodeXmlText(rawValue);
  }

  return decodeXmlText(rawValue);
}

async function extractDocxText(archive: ZipArchive): Promise<string> {
  const documentEntries = archive.entries
    .map((entry) => entry.name)
    .filter((name) => /^word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/i.test(name))
    .sort((a, b) => {
      if (a === "word/document.xml") return -1;
      if (b === "word/document.xml") return 1;
      return compareNatural(a, b);
    });

  const parts: string[] = [];
  for (const name of documentEntries) {
    const entry = archive.getEntry(name);
    if (!entry) continue;
    const xml = await archive.readText(entry);
    const paragraphs = Array.from(xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi), (match) => extractXmlText(match[1] ?? "").trim())
      .filter(Boolean);
    const text = paragraphs.length > 0 ? paragraphs.join("\n") : extractXmlText(xml).trim();
    if (text) {
      parts.push(name === "word/document.xml" ? text : `# ${name}\n${text}`);
    }
  }

  return parts.join("\n\n") || "Word document contains no extractable text.";
}

async function extractPptxText(archive: ZipArchive): Promise<string> {
  const slideEntries = archive.entries
    .map((entry) => entry.name)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort(compareNatural);

  const parts: string[] = [];
  for (const name of slideEntries) {
    const entry = archive.getEntry(name);
    if (!entry) continue;
    const text = extractXmlText(await archive.readText(entry)).trim();
    if (text) {
      parts.push(`# ${name.replace(/^ppt\/slides\//i, "").replace(/\.xml$/i, "")}\n${text}`);
    }
  }

  return parts.join("\n\n") || "PowerPoint deck contains no extractable slide text.";
}

async function readZipArchive(buffer: ArrayBuffer): Promise<ZipArchive> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    throw new Error("ZIP central directory not found");
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder("utf-8");
  const entries: ZipDirectoryEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory entry");
    }

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameStart = offset + 46;
    const name = normalizeZipPath(decoder.decode(bytes.slice(nameStart, nameStart + fileNameLength)));

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset = nameStart + fileNameLength + extraLength + commentLength;
  }

  const entryByName = new Map(entries.map((entry) => [entry.name.toLowerCase(), entry]));

  return {
    entries,
    getEntry(name: string) {
      return entryByName.get(normalizeZipPath(name).toLowerCase());
    },
    async readText(entry: ZipDirectoryEntry) {
      const entryBytes = await readZipEntryBytes(view, bytes, entry);
      return new TextDecoder("utf-8").decode(entryBytes);
    },
  };
}

function findEndOfCentralDirectory(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

async function readZipEntryBytes(view: DataView, bytes: Uint8Array, entry: ZipDirectoryEntry): Promise<Uint8Array> {
  const localOffset = entry.localHeaderOffset;
  if (view.getUint32(localOffset, true) !== 0x04034b50) {
    throw new Error(`Invalid ZIP local header for ${entry.name}`);
  }

  const fileNameLength = view.getUint16(localOffset + 26, true);
  const extraLength = view.getUint16(localOffset + 28, true);
  const dataOffset = localOffset + 30 + fileNameLength + extraLength;
  const compressedData = bytes.slice(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressedData;
  }

  if (entry.compressionMethod === 8) {
    return await inflateRaw(compressedData);
  }

  throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${entry.name}`);
}

async function inflateRaw(compressedData: Uint8Array): Promise<Uint8Array> {
  const DecompressionStreamCtor = globalThis.DecompressionStream;
  if (typeof DecompressionStreamCtor !== "function") {
    throw new Error("Deflate decompression is not available in this runtime");
  }

  const stream = new Blob([toArrayBuffer(compressedData)]).stream().pipeThrough(new DecompressionStreamCtor("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function tryListZipEntries(file: File): Promise<string[]> {
  if (file.size > MAX_OFFICE_ATTACHMENT_BYTES) return [];

  try {
    const archive = await readZipArchive(await readFileAsArrayBuffer(file));
    return archive.entries
      .map((entry) => entry.name)
      .filter((name) => !name.endsWith("/"))
      .sort(compareNatural)
      .slice(0, 120);
  } catch {
    return [];
  }
}

async function recoverReadableBinaryText(file: File): Promise<string> {
  if (file.size === 0) return "";

  const previewBlob = file.slice(0, Math.min(file.size, MAX_BINARY_TEXT_BYTES), resolveMimeType(file, "application/octet-stream"));
  const bytes = new Uint8Array(await readFileAsArrayBuffer(previewBlob));
  const candidates = [
    new TextDecoder("utf-8", { fatal: false }).decode(bytes),
    new TextDecoder("utf-16le", { fatal: false }).decode(bytes),
  ];
  const seen = new Set<string>();
  const lines: string[] = [];
  let totalChars = 0;

  for (const candidate of candidates) {
    for (const line of splitOnControlCharacters(candidate)) {
      const normalized = line.replace(/\s+/g, " ").trim();
      if (normalized.length < 4 || seen.has(normalized) || !/[0-9A-Za-z\u4e00-\u9fff]/u.test(normalized)) {
        continue;
      }

      seen.add(normalized);
      lines.push(normalized);
      totalChars += normalized.length;
      if (lines.length >= MAX_BINARY_RECOVERED_LINES || totalChars >= MAX_BINARY_RECOVERED_CHARS) {
        return lines.join("\n");
      }
    }
  }

  return lines.join("\n");
}

function splitOnControlCharacters(text: string): string[] {
  const parts: string[] = [];
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const isControl = code <= 8 || (code >= 11 && code <= 31) || code === 127;
    if (!isControl) continue;

    if (index > start) {
      parts.push(text.slice(start, index));
    }
    start = index + 1;
  }

  if (start < text.length) {
    parts.push(text.slice(start));
  }

  return parts;
}

function getXmlElementText(xml: string, elementName: string): string {
  const match = new RegExp(`<${elementName}\\b[^>]*>([\\s\\S]*?)<\\/${elementName}>`, "i").exec(xml);
  return match ? decodeXmlText(match[1] ?? "") : "";
}

function extractXmlText(xml: string): string {
  const textMatches = Array.from(xml.matchAll(/<(?:[A-Za-z0-9_]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/gi));
  const rawText = textMatches.length > 0
    ? textMatches.map((match) => match[1] ?? "").join("")
    : xml.replace(/<[^>]+>/g, " ");
  return decodeXmlText(rawText).replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

function getXmlAttribute(attrs: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\s)${escapedName}=(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs);
  return match?.[1] ?? match?.[2];
}

function decodeXmlText(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number.parseInt(value, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function columnIndexFromCellRef(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0]?.toUpperCase() ?? "";
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return Math.max(0, index - 1);
}

function normalizeZipPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function compareNatural(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function resolveMimeType(file: File, fallback = ""): string {
  const fromFile = file.type?.trim();
  const fromExtension = MIME_TYPE_BY_EXTENSION.get(getFileExtension(file.name).toLowerCase());
  const normalizedFileType = fromFile?.toLowerCase();
  if (fromExtension && (!normalizedFileType || isGenericMimeType(normalizedFileType))) {
    return fromExtension;
  }
  if (normalizedFileType) return normalizedFileType;
  return fromExtension ?? fallback;
}

function isGenericMimeType(mimeType: string): boolean {
  return mimeType === "application/octet-stream"
    || mimeType === "binary/octet-stream"
    || mimeType === "application/zip"
    || mimeType === "application/x-zip-compressed";
}

function getFileExtension(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".tar.gz")) return ".tar.gz";
  const match = /\.[^.\\/]+$/.exec(fileName);
  return match?.[0] ?? "";
}

function truncateAttachmentText(text: string): string {
  if (text.length <= MAX_TEXT_ATTACHMENT_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_TEXT_ATTACHMENT_LENGTH)}\n\n[Attachment truncated; original length ${text.length} characters.]`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const maybeBuffer = (globalThis as unknown as {
    Buffer?: { from(input: ArrayBuffer): { toString(encoding: string): string } };
  }).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(buffer).toString("base64");
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
