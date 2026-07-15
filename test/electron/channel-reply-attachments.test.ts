import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  collectSafeChannelReplyAttachments,
  removeUploadedAttachmentReferences,
} from "../../src/electron/libs/channel/channel-reply-attachments.js";

test("channel reply attachments stay inside the channel workspace", () => {
  const root = mkdtempSync(join(tmpdir(), "tech-cc-hub-channel-files-"));
  const outside = join(dirname(root), `outside-${Date.now()}.txt`);
  try {
    const nested = join(root, "artifacts");
    mkdirSync(nested, { recursive: true });
    const image = join(nested, "preview.png");
    const file = join(nested, "report.pdf");
    writeFileSync(image, "image");
    writeFileSync(file, "pdf");
    writeFileSync(outside, "secret");

    const text = `完成：[预览](artifacts/preview.png)\n报告：${file}\n不要上传：${outside}`;
    const attachments = collectSafeChannelReplyAttachments(text, root);

    assert.deepEqual(attachments.map((item) => ({ kind: item.kind, relativePath: item.relativePath })), [
      { kind: "image", relativePath: join("artifacts", "preview.png") },
      { kind: "file", relativePath: join("artifacts", "report.pdf") },
    ]);
    assert.equal(removeUploadedAttachmentReferences(text, attachments).includes(outside), true);
    assert.equal(removeUploadedAttachmentReferences(text, attachments).includes("artifacts/preview.png"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { force: true });
  }
});

test("channel reply attachment limits reject oversized files and cap item count", () => {
  const root = mkdtempSync(join(tmpdir(), "tech-cc-hub-channel-limits-"));
  try {
    for (let index = 0; index < 4; index += 1) {
      writeFileSync(join(root, `file-${index}.txt`), "12345");
    }
    const text = [0, 1, 2, 3].map((index) => `[${index}](file-${index}.txt)`).join(" ");
    const attachments = collectSafeChannelReplyAttachments(text, root, {
      maxAttachments: 2,
      maxFileBytes: 5,
    });
    assert.deepEqual(attachments.map((item) => item.relativePath), ["file-0.txt", "file-1.txt"]);

    writeFileSync(join(root, "too-big.txt"), "123456");
    assert.equal(collectSafeChannelReplyAttachments("[big](too-big.txt)", root, { maxFileBytes: 5 }).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("channel reply attachments reject symlinks that escape the workspace", (t) => {
  const root = mkdtempSync(join(tmpdir(), "tech-cc-hub-channel-symlink-"));
  const outside = join(dirname(root), `symlink-secret-${Date.now()}.txt`);
  try {
    writeFileSync(outside, "secret");
    const link = join(root, "secret-link.txt");
    try {
      symlinkSync(outside, link, "file");
    } catch (error) {
      t.skip(`symlink unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    assert.equal(collectSafeChannelReplyAttachments("[secret](secret-link.txt)", root).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { force: true });
  }
});
