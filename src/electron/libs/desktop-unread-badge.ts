import { deflateSync } from "node:zlib";

const BADGE_SIZE = 16;
const MAX_VISIBLE_UNREAD_COUNT = 99;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BADGE_COLOR = [218, 62, 65] as const;

const DIGIT_GLYPHS: Readonly<Record<string, readonly string[]>> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
};

export function normalizeUnreadBadgeCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.floor(count);
}

export function formatUnreadBadgeCount(count: number): string {
  const normalizedCount = normalizeUnreadBadgeCount(count);
  if (normalizedCount === 0) return "";
  if (normalizedCount > MAX_VISIBLE_UNREAD_COUNT) return `${MAX_VISIBLE_UNREAD_COUNT}+`;
  return String(normalizedCount);
}

export function createUnreadBadgePng(count: number): Buffer {
  const normalizedCount = normalizeUnreadBadgeCount(count);
  if (normalizedCount === 0) {
    throw new RangeError("Unread badge count must be greater than zero.");
  }

  const rgba = Buffer.alloc(BADGE_SIZE * BADGE_SIZE * 4);
  drawBadgeBackground(rgba);
  drawBadgeLabel(rgba, String(Math.min(normalizedCount, MAX_VISIBLE_UNREAD_COUNT)));

  const scanlines = Buffer.alloc(BADGE_SIZE * (1 + BADGE_SIZE * 4));
  for (let y = 0; y < BADGE_SIZE; y += 1) {
    const scanlineOffset = y * (1 + BADGE_SIZE * 4);
    scanlines[scanlineOffset] = 0;
    rgba.copy(
      scanlines,
      scanlineOffset + 1,
      y * BADGE_SIZE * 4,
      (y + 1) * BADGE_SIZE * 4,
    );
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(BADGE_SIZE, 0);
  header.writeUInt32BE(BADGE_SIZE, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    createPngChunk("IHDR", header),
    createPngChunk("IDAT", deflateSync(scanlines)),
    createPngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function drawBadgeBackground(rgba: Buffer): void {
  const center = (BADGE_SIZE - 1) / 2;
  const radius = BADGE_SIZE / 2 - 0.5;

  for (let y = 0; y < BADGE_SIZE; y += 1) {
    for (let x = 0; x < BADGE_SIZE; x += 1) {
      const distance = Math.hypot(x - center, y - center);
      const coverage = Math.max(0, Math.min(1, radius + 0.5 - distance));
      if (coverage === 0) continue;
      setPixel(rgba, x, y, BADGE_COLOR[0], BADGE_COLOR[1], BADGE_COLOR[2], Math.round(coverage * 255));
    }
  }
}

function drawBadgeLabel(rgba: Buffer, label: string): void {
  const glyphWidth = 5;
  const glyphHeight = 7;
  const glyphGap = 1;
  const labelWidth = label.length * glyphWidth + (label.length - 1) * glyphGap;
  const startX = Math.floor((BADGE_SIZE - labelWidth) / 2);
  const startY = Math.floor((BADGE_SIZE - glyphHeight) / 2);

  for (let index = 0; index < label.length; index += 1) {
    const glyph = DIGIT_GLYPHS[label[index]];
    if (!glyph) continue;
    const glyphX = startX + index * (glyphWidth + glyphGap);
    for (let y = 0; y < glyph.length; y += 1) {
      for (let x = 0; x < glyph[y].length; x += 1) {
        if (glyph[y][x] !== "1") continue;
        setPixel(rgba, glyphX + x, startY + y, 255, 255, 255, 255);
      }
    }
  }
}

function setPixel(
  rgba: Buffer,
  x: number,
  y: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
): void {
  const offset = (y * BADGE_SIZE + x) * 4;
  rgba[offset] = red;
  rgba[offset + 1] = green;
  rgba[offset + 2] = blue;
  rgba[offset + 3] = alpha;
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(calculateCrc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function calculateCrc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
