import { app, nativeImage } from "electron";
import { appendFileSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const smokeLogPath = join(tmpdir(), "tech-cc-hub-design-smoke.log");

function logStep(message) {
  appendFileSync(smokeLogPath, `${new Date().toISOString()} ${message}\n`, "utf8");
}

const hardTimeout = setTimeout(() => {
  logStep("hard-timeout");
  app.exit(124);
}, 30_000);

function createBitmap(width, height, paint) {
  const bitmap = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const { r, g, b, a = 255 } = paint(x, y);
      bitmap[index] = b;
      bitmap[index + 1] = g;
      bitmap[index + 2] = r;
      bitmap[index + 3] = a;
    }
  }
  return bitmap;
}

function createPng(path, width, height, paint) {
  const image = nativeImage.createFromBitmap(createBitmap(width, height, paint), { width, height });
  writeFileSync(path, image.toPNG());
  return image;
}

function parseTextToolPayload(result) {
  const text = result?.content?.find((entry) => entry?.type === "text")?.text;
  if (!text) {
    throw new Error("Tool result did not include text content.");
  }
  return JSON.parse(text);
}

function getTool(server, name) {
  const tool = server?.instance?._registeredTools?.[name];
  if (!tool?.handler) {
    const available = Object.keys(server?.instance?._registeredTools ?? {});
    throw new Error(`Tool not registered: ${name}. Available: ${available.join(", ")}`);
  }
  return tool;
}

logStep("script-start");

try {
  const {
    getDesignMcpServer,
    setDesignToolHost,
  } = await import("../../dist-electron/electron/libs/mcp-tools/design.js");
  logStep("design-module-imported");

  const artifactDir = join(app.getPath("temp"), "tech-cc-hub-design-smoke");
  mkdirSync(artifactDir, { recursive: true });
  logStep(`artifact-dir=${artifactDir}`);

  const screenshotPath = join(artifactDir, "mock-browser-view.png");
  const referencePath = join(artifactDir, "mock-figma-reference.png");
  const targetBox = { x: 80, y: 60, width: 100, height: 50 };
  const padding = 4;
  const paddedSize = {
    width: targetBox.width + padding * 2,
    height: targetBox.height + padding * 2,
  };

  const browserScreenshot = createPng(screenshotPath, 300, 200, (x, y) => {
    const insideTarget =
      x >= targetBox.x &&
      x < targetBox.x + targetBox.width &&
      y >= targetBox.y &&
      y < targetBox.y + targetBox.height;
    if (!insideTarget) {
      return { r: 246, g: 247, b: 249 };
    }
    if (x >= targetBox.x + 72 && y >= targetBox.y + 14 && y < targetBox.y + 36) {
      return { r: 245, g: 167, b: 66 };
    }
    return { r: 38, g: 112, b: 214 };
  });

  createPng(referencePath, paddedSize.width, paddedSize.height, (x, y) => {
    const insideButton =
      x >= padding &&
      x < padding + targetBox.width &&
      y >= padding &&
      y < padding + targetBox.height;
    if (!insideButton) {
      return { r: 246, g: 247, b: 249 };
    }
    return { r: 38, g: 112, b: 214 };
  });

  setDesignToolHost({
    captureVisible: async () => ({
      success: true,
      dataUrl: browserScreenshot.toDataURL(),
    }),
    getElementInfo: async (_sessionId, input) => ({
      success: true,
      result: {
        found: true,
        target: input.target,
        strategy: input.strategy ?? "selector",
        index: input.index ?? 0,
        kind: input.kind,
        value: targetBox,
      },
    }),
    getState: () => ({
      url: "mock://design-element-smoke",
      title: "Design Element Smoke",
      canGoBack: false,
      canGoForward: false,
      isLoading: false,
    }),
  });

  const server = getDesignMcpServer("design-element-smoke");
  logStep("mcp-server-created");
  const captureTool = getTool(server, "design_capture_current_element");
  const compareTool = getTool(server, "design_compare_element_to_reference");

  const capturePayload = parseTextToolPayload(await captureTool.handler({
    target: "#loginButton",
    strategy: "selector",
    padding,
    label: "design-element-smoke-capture",
  }, {}));
  logStep("capture-tool-finished");

  const comparePayload = parseTextToolPayload(await compareTool.handler({
    referenceImagePath: referencePath,
    target: "#loginButton",
    strategy: "selector",
    padding,
    label: "design-element-smoke-compare",
    sensitivity: "strict",
    maxDifferenceRatio: 0.02,
  }, {}));
  logStep("compare-tool-finished");

  if (!capturePayload.success) {
    throw new Error(`Element capture failed: ${capturePayload.error}`);
  }
  if (!comparePayload.success) {
    throw new Error(`Element comparison failed: ${comparePayload.error}`);
  }
  if (capturePayload.capture.size.width !== paddedSize.width || capturePayload.capture.size.height !== paddedSize.height) {
    throw new Error(`Unexpected capture size: ${JSON.stringify(capturePayload.capture.size)}`);
  }
  if (!comparePayload.comparison.comparable || comparePayload.comparison.differenceRatio <= 0) {
    throw new Error(`Expected a positive comparable diff, got ${JSON.stringify(comparePayload.comparison)}`);
  }
  if (comparePayload.comparison.verdict.passed !== false) {
    throw new Error(`Expected maxDifferenceRatio gate to fail, got ${JSON.stringify(comparePayload.comparison.verdict)}`);
  }

  console.log(JSON.stringify({
    success: true,
    target: comparePayload.target,
    box: comparePayload.box,
    requestedRegion: comparePayload.requestedRegion,
    capturePath: comparePayload.capture.path,
    captureSize: comparePayload.capture.size,
    referencePath,
    differenceRatio: comparePayload.comparison.differenceRatio,
    diffBoundingBox: comparePayload.comparison.diffBoundingBox,
    reportPath: comparePayload.comparison.reportPath,
    verdict: comparePayload.comparison.verdict,
  }, null, 2));
} finally {
  clearTimeout(hardTimeout);
  logStep("app-quit");
  app.quit();
}
