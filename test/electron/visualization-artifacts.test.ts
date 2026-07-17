import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MAX_VISUALIZATION_ARTIFACT_BYTES,
  VisualizationArtifactError,
  ensureVisualizationSessionDir,
  readVisualizationArtifact,
} from "../../src/electron/libs/visualization-artifacts.js";

async function withTempRoot<T>(run: (rootDir: string) => Promise<T>): Promise<T> {
  const rootDir = await mkdtemp(join(tmpdir(), "techcc-visualization-artifacts-"));
  try {
    return await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

async function expectArtifactError(
  action: () => Promise<unknown>,
  code: VisualizationArtifactError["code"],
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    if (!(error instanceof VisualizationArtifactError)) return false;
    assert.equal(error.code, code);
    return true;
  });
}

test("creates the techcc session directory under <root>/visualizations/<sessionId>", async () => {
  await withTempRoot(async (rootDir) => {
    const sessionDir = await ensureVisualizationSessionDir({ rootDir, sessionId: "session-42" });

    assert.equal(sessionDir, join(rootDir, "visualizations", "session-42"));
  });
});

test("reads a UTF-8 HTML artifact and returns stable integrity metadata", async () => {
  await withTempRoot(async (rootDir) => {
    const sessionId = "session-42";
    const fileName = "sales-overview.html";
    const content = "<!doctype html><meta charset=\"utf-8\"><h1>销售概览</h1>";
    const sessionDir = await ensureVisualizationSessionDir({ rootDir, sessionId });
    await writeFile(join(sessionDir, fileName), content, "utf8");

    const artifact = await readVisualizationArtifact({ rootDir, sessionId, fileName });

    assert.equal(artifact.content, content);
    assert.equal(artifact.sha256, createHash("sha256").update(Buffer.from(content)).digest("hex"));
    assert.equal(artifact.absolutePath, await realpath(join(sessionDir, fileName)));
    assert.deepEqual(
      {
        sessionId: artifact.metadata.sessionId,
        fileName: artifact.metadata.fileName,
        sizeBytes: artifact.metadata.sizeBytes,
        mimeType: artifact.metadata.mimeType,
      },
      {
        sessionId,
        fileName,
        sizeBytes: Buffer.byteLength(content),
        mimeType: "text/html; charset=utf-8",
      },
    );
    assert.ok(Number.isFinite(artifact.metadata.modifiedAtMs));
  });
});

test("rejects unsafe session identifiers before touching the filesystem", async () => {
  await withTempRoot(async (rootDir) => {
    for (const sessionId of ["", ".", "..", "../escape", "nested/session", "nested\\session", " session "]) {
      await expectArtifactError(
        () => ensureVisualizationSessionDir({ rootDir, sessionId }),
        "INVALID_SESSION_ID",
      );
    }
  });
});

test("rejects absolute, traversing, nested, and non-HTML file names", async () => {
  await withTempRoot(async (rootDir) => {
    const sessionId = "session-42";
    await ensureVisualizationSessionDir({ rootDir, sessionId });

    const invalidCases: Array<[string, VisualizationArtifactError["code"]]> = [
      ["../outside.html", "INVALID_FILE_NAME"],
      ["nested/chart.html", "INVALID_FILE_NAME"],
      ["nested\\chart.html", "INVALID_FILE_NAME"],
      ["C:\\outside.html", "INVALID_FILE_NAME"],
      ["/tmp/outside.html", "INVALID_FILE_NAME"],
      ["chart.txt", "INVALID_FILE_NAME"],
      ["chart.html.txt", "INVALID_FILE_NAME"],
    ];

    for (const [fileName, code] of invalidCases) {
      await expectArtifactError(
        () => readVisualizationArtifact({ rootDir, sessionId, fileName }),
        code,
      );
    }
  });
});

test("rejects artifacts larger than 2 MiB", async () => {
  await withTempRoot(async (rootDir) => {
    const sessionId = "session-42";
    const fileName = "oversized.html";
    const sessionDir = await ensureVisualizationSessionDir({ rootDir, sessionId });
    await writeFile(join(sessionDir, fileName), Buffer.alloc(MAX_VISUALIZATION_ARTIFACT_BYTES + 1, 0x20));

    await expectArtifactError(
      () => readVisualizationArtifact({ rootDir, sessionId, fileName }),
      "FILE_TOO_LARGE",
    );
  });
});

test("rejects HTML files that are not valid UTF-8", async () => {
  await withTempRoot(async (rootDir) => {
    const sessionId = "session-42";
    const fileName = "invalid-utf8.html";
    const sessionDir = await ensureVisualizationSessionDir({ rootDir, sessionId });
    await writeFile(join(sessionDir, fileName), Buffer.from([0xc3, 0x28]));

    await expectArtifactError(
      () => readVisualizationArtifact({ rootDir, sessionId, fileName }),
      "INVALID_UTF8",
    );
  });
});

test("rejects a session-directory symbolic link that escapes the visualization root", async (t) => {
  await withTempRoot(async (rootDir) => {
    const externalDir = join(rootDir, "external");
    const visualizationRoot = join(rootDir, "visualizations");
    const linkedSessionDir = join(visualizationRoot, "linked-session");
    await mkdir(externalDir, { recursive: true });
    await mkdir(visualizationRoot, { recursive: true });
    await writeFile(join(externalDir, "outside.html"), "<h1>outside</h1>", "utf8");

    try {
      await symlink(externalDir, linkedSessionDir, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") {
        t.skip(`symbolic links are unavailable on this host (${code})`);
        return;
      }
      throw error;
    }

    await expectArtifactError(
      () => readVisualizationArtifact({
        rootDir,
        sessionId: "linked-session",
        fileName: "outside.html",
      }),
      "PATH_ESCAPE",
    );
  });
});

test("rejects a hard-linked artifact so the host cannot proxy-read files outside the session", async (t) => {
  await withTempRoot(async (rootDir) => {
    const sessionId = "session-42";
    const sessionDir = await ensureVisualizationSessionDir({ rootDir, sessionId });
    const outsidePath = join(rootDir, "outside-secret.html");
    const linkedPath = join(sessionDir, "linked-secret.html");
    await writeFile(outsidePath, "<h1>outside secret</h1>", "utf8");

    try {
      await link(outsidePath, linkedPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") {
        t.skip(`hard links are unavailable on this host (${code})`);
        return;
      }
      throw error;
    }

    await expectArtifactError(
      () => readVisualizationArtifact({ rootDir, sessionId, fileName: "linked-secret.html" }),
      "HARD_LINK",
    );
  });
});

test("rejects a session-directory alias to another session inside the visualization root", async (t) => {
  await withTempRoot(async (rootDir) => {
    const sourceSessionDir = await ensureVisualizationSessionDir({ rootDir, sessionId: "source-session" });
    const aliasSessionDir = join(rootDir, "visualizations", "alias-session");
    await writeFile(join(sourceSessionDir, "private.html"), "<h1>private session</h1>", "utf8");

    try {
      await symlink(sourceSessionDir, aliasSessionDir, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") {
        t.skip(`symbolic links are unavailable on this host (${code})`);
        return;
      }
      throw error;
    }

    await expectArtifactError(
      () => readVisualizationArtifact({ rootDir, sessionId: "alias-session", fileName: "private.html" }),
      "SYMBOLIC_LINK",
    );
  });
});
