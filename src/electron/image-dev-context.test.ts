import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  buildImageDevContextAnalysisFromSummary,
  buildImageDevContextPromptNote,
  createImageDevContextArtifacts,
  shouldCreateImageDevContext,
} from "./libs/image-dev-context.js";
import type { PromptAttachment } from "./types.js";

test("shouldCreateImageDevContext only triggers for development tasks with images", () => {
  assert.equal(shouldCreateImageDevContext({ taskKind: "development", attachments: [imageAttachment("image-1")] }), true);
  assert.equal(shouldCreateImageDevContext({ taskKind: "frontend", attachments: [imageAttachment("image-1")] }), true);
  assert.equal(shouldCreateImageDevContext({ taskKind: "visual", attachments: [imageAttachment("image-1")] }), true);
  assert.equal(shouldCreateImageDevContext({ taskKind: "electron", attachments: [imageAttachment("image-1")] }), true);
  assert.equal(shouldCreateImageDevContext({ taskKind: "chat", attachments: [imageAttachment("image-1")] }), false);
  assert.equal(shouldCreateImageDevContext({ taskKind: "docs", attachments: [imageAttachment("image-1")] }), false);
  assert.equal(shouldCreateImageDevContext({ taskKind: "development", attachments: [] }), false);
  assert.equal(shouldCreateImageDevContext({
    taskKind: "development",
    attachments: [{
      id: "text-1",
      kind: "text",
      name: "notes.txt",
      mimeType: "text/plain",
      data: "hello",
    }],
  }), false);
});

test("buildImageDevContextAnalysisFromSummary converts summary text into markdown and spec fields", () => {
  const analysis = buildImageDevContextAnalysisFromSummary({
    attachment: imageAttachment("image-1", "screen.png"),
    prompt: "按截图修复右侧面板遮挡",
    taskKind: "frontend",
    summaryText: "截图显示右侧 Prompt Ledger 面板遮挡了 prompt 分布区域，需要检查 ActivityRail 布局和 overflow。",
  });

  assert.match(analysis.markdown, /screen\.png/);
  assert.match(analysis.markdown, /Prompt Ledger/);
  assert.equal(analysis.spec.role, "ui_mock");
  assert.match(analysis.spec.summary, /右侧 Prompt Ledger/);
  assert.deepEqual(analysis.spec.devHints?.probableTargets, ["ActivityRail"]);
  assert.deepEqual(analysis.spec.devHints?.suggestedFocus, ["layout", "overflow", "visual fidelity"]);
  assert.equal(analysis.spec.confidence, 0.72);
});

test("buildImageDevContextPromptNote points the agent at generated documents", () => {
  const note = buildImageDevContextPromptNote({
    manifestPath: "D:\\tmp\\manifest.json",
    groupSummaryPath: "D:\\tmp\\group-summary.md",
    groupSpecPath: "D:\\tmp\\group-spec.json",
    imageCount: 2,
    images: [
      {
        imageId: "image-1",
        fileName: "screen-a.png",
        summaryPath: "D:\\tmp\\images\\image-1\\summary.md",
        specPath: "D:\\tmp\\images\\image-1\\spec.json",
        sourceMetaPath: "D:\\tmp\\images\\image-1\\source-meta.json",
      },
    ],
    rootPath: "D:\\tmp",
    fallbackUsed: false,
  });

  assert.match(note, /Image Dev Context/);
  assert.match(note, /group-summary\.md/);
  assert.match(note, /group-spec\.json/);
  assert.match(note, /screen-a\.png/);
  assert.match(note, /Do not request raw image payloads by default/);
});


test("createImageDevContextArtifacts writes per-image and group documents", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "image-dev-context-"));

  try {
    const result = await createImageDevContextArtifacts({
      rootDir,
      sessionId: "session-1",
      batchId: "batch-1",
      prompt: "请根据截图修复前端布局",
      taskKind: "development",
      attachments: [
        imageAttachment("image-1", "screen-a.png"),
        imageAttachment("image-2", "screen-b.png"),
      ],
      analyzeImage: async ({ attachment, index }: { attachment: PromptAttachment; index: number }) => ({
        markdown: [
          `# ${attachment.name}`,
          "",
          `这是一张前端开发截图，序号 ${index + 1}。`,
          "重点关注布局、按钮和溢出区域。",
        ].join("\n"),
        spec: {
          role: "ui_mock",
          summary: `${attachment.name} describes a layout issue`,
          layout: {
            pageType: "dashboard",
            regions: [{ name: "right rail", description: "analysis rail", elements: ["tabs", "cards"] }],
          },
          components: [{ type: "tab", label: "Prompt Ledger", text: "Prompt Ledger", locationHint: "top", importance: "high" }],
          texts: [{ value: "Prompt Ledger", kind: "heading" }],
          visualConstraints: { styleHints: ["dense"], issues: ["panel is occluded"] },
          devHints: { probableTargets: ["ActivityRail"], suggestedFocus: ["overflow"] },
          confidence: 0.87,
        },
      }),
    });

    assert.equal(result.imageCount, 2);
    assert.equal(result.fallbackUsed, false);
    assert.equal(existsSync(result.manifestPath), true);
    assert.equal(existsSync(result.groupSummaryPath), true);
    assert.equal(existsSync(result.groupSpecPath), true);
    assert.equal(result.images.length, 2);

    for (const image of result.images) {
      assert.equal(existsSync(image.summaryPath), true);
      assert.equal(existsSync(image.specPath), true);
      assert.equal(existsSync(image.sourceMetaPath), true);
    }

    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8")) as {
      version: number;
      sessionId: string;
      batchId: string;
      triggerReason: string;
      imageCount: number;
      images: Array<{ imageId: string; summaryPath: string; specPath: string }>;
    };

    assert.equal(manifest.version, 1);
    assert.equal(manifest.sessionId, "session-1");
    assert.equal(manifest.batchId, "batch-1");
    assert.equal(manifest.triggerReason, "development_with_images");
    assert.equal(manifest.imageCount, 2);
    assert.deepEqual(manifest.images.map((image) => image.imageId), ["image-1", "image-2"]);

    const groupSummary = await readFile(result.groupSummaryPath, "utf8");
    assert.match(groupSummary, /请根据截图修复前端布局/);
    assert.match(groupSummary, /screen-a\.png/);
    assert.match(groupSummary, /screen-b\.png/);

    const spec = JSON.parse(await readFile(result.images[0].specPath, "utf8")) as {
      version: number;
      imageId: string;
      taskContext: { prompt: string; intent: string };
      layout: { pageType: string };
      confidence: number;
    };
    assert.equal(spec.version, 1);
    assert.equal(spec.imageId, "image-1");
    assert.equal(spec.taskContext.prompt, "请根据截图修复前端布局");
    assert.equal(spec.taskContext.intent, "development");
    assert.equal(spec.layout.pageType, "dashboard");
    assert.equal(spec.confidence, 0.87);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

function imageAttachment(id: string, name = "screen.png"): PromptAttachment {
  return {
    id,
    kind: "image",
    name,
    mimeType: "image/png",
    data: `file:///tmp/${name}`,
    storagePath: `D:\\tmp\\${name}`,
    storageUri: `file:///D:/tmp/${name}`,
    size: 1024,
  };
}
