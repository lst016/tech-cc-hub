import { createHash } from "node:crypto";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { isAbsolute, join, posix, relative, resolve, sep, win32 } from "node:path";
import { TextDecoder } from "node:util";

const VISUALIZATIONS_DIRECTORY = "visualizations";
const HTML_MIME_TYPE = "text/html; charset=utf-8";
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export const MAX_VISUALIZATION_ARTIFACT_BYTES = 2 * 1024 * 1024;

export type VisualizationArtifactErrorCode =
  | "INVALID_SESSION_ID"
  | "INVALID_FILE_NAME"
  | "FILE_NOT_FOUND"
  | "PATH_ESCAPE"
  | "SYMBOLIC_LINK"
  | "HARD_LINK"
  | "FILE_CHANGED"
  | "NOT_FILE"
  | "FILE_TOO_LARGE"
  | "INVALID_UTF8"
  | "READ_FAILED";

export class VisualizationArtifactError extends Error {
  readonly code: VisualizationArtifactErrorCode;

  constructor(code: VisualizationArtifactErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "VisualizationArtifactError";
    this.code = code;
  }
}

export type VisualizationArtifact = {
  content: string;
  sha256: string;
  absolutePath: string;
  metadata: {
    sessionId: string;
    fileName: string;
    sizeBytes: number;
    mimeType: typeof HTML_MIME_TYPE;
    modifiedAtMs: number;
  };
};

export type VisualizationArtifactLocation = {
  rootDir: string;
  sessionId: string;
};

export type VisualizationArtifactRequest = VisualizationArtifactLocation & {
  fileName: string;
};

function validateSessionId(sessionId: string): void {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new VisualizationArtifactError(
      "INVALID_SESSION_ID",
      "Visualization sessionId must contain only letters, numbers, underscores, or hyphens.",
    );
  }
}

function validateFileName(fileName: string): void {
  const isUnsafe =
    fileName.length === 0
    || fileName.length > 255
    || fileName !== fileName.trim()
    || fileName.includes("\0")
    || fileName.includes("/")
    || fileName.includes("\\")
    || isAbsolute(fileName)
    || posix.isAbsolute(fileName)
    || win32.isAbsolute(fileName)
    || !fileName.toLowerCase().endsWith(".html");

  if (isUnsafe) {
    throw new VisualizationArtifactError(
      "INVALID_FILE_NAME",
      "Visualization fileName must be a local .html file name without directories.",
    );
  }
}

function isPathWithin(rootPath: string, targetPath: string): boolean {
  const pathFromRoot = relative(rootPath, targetPath);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== ".." && !isAbsolute(pathFromRoot));
}

function asArtifactError(error: unknown, fallbackMessage: string): VisualizationArtifactError {
  if (error instanceof VisualizationArtifactError) return error;
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "ENOENT" || code === "ENOTDIR") {
    return new VisualizationArtifactError("FILE_NOT_FOUND", fallbackMessage, { cause: error });
  }
  return new VisualizationArtifactError("READ_FAILED", fallbackMessage, { cause: error });
}

function getPaths(input: VisualizationArtifactLocation): {
  visualizationRoot: string;
  sessionDir: string;
} {
  validateSessionId(input.sessionId);
  const visualizationRoot = resolve(input.rootDir, VISUALIZATIONS_DIRECTORY);
  return {
    visualizationRoot,
    sessionDir: join(visualizationRoot, input.sessionId),
  };
}

export async function ensureVisualizationSessionDir(input: VisualizationArtifactLocation): Promise<string> {
  const { visualizationRoot, sessionDir } = getPaths(input);
  try {
    await mkdir(sessionDir, { recursive: true });
    const [realVisualizationRoot, realSessionDir] = await Promise.all([
      realpath(visualizationRoot),
      realpath(sessionDir),
    ]);
    if (!isPathWithin(realVisualizationRoot, realSessionDir)) {
      throw new VisualizationArtifactError(
        "PATH_ESCAPE",
        "Visualization session directory resolves outside the visualization root.",
      );
    }
    const sessionStat = await lstat(sessionDir);
    if (sessionStat.isSymbolicLink()) {
      throw new VisualizationArtifactError(
        "SYMBOLIC_LINK",
        "Visualization session directories cannot be symbolic links.",
      );
    }
    return sessionDir;
  } catch (error) {
    throw asArtifactError(error, "Unable to create the visualization session directory.");
  }
}

type VisualizationFileIdentity = {
  dev: number;
  ino: number;
  nlink: number;
};

async function readBoundedFile(
  filePath: string,
  expectedIdentity: VisualizationFileIdentity,
): Promise<{ buffer: Buffer; modifiedAtMs: number }> {
  const fileHandle = await open(filePath, "r");
  try {
    const fileStat = await fileHandle.stat();
    if (fileStat.nlink !== 1 || expectedIdentity.nlink !== 1) {
      throw new VisualizationArtifactError(
        "HARD_LINK",
        "Visualization artifacts cannot be hard links.",
      );
    }
    if (fileStat.dev !== expectedIdentity.dev || fileStat.ino !== expectedIdentity.ino) {
      throw new VisualizationArtifactError(
        "FILE_CHANGED",
        "Visualization artifact changed while it was being opened.",
      );
    }
    if (!fileStat.isFile()) {
      throw new VisualizationArtifactError("NOT_FILE", "Visualization artifact is not a regular file.");
    }
    if (fileStat.size > MAX_VISUALIZATION_ARTIFACT_BYTES) {
      throw new VisualizationArtifactError(
        "FILE_TOO_LARGE",
        `Visualization artifact exceeds ${MAX_VISUALIZATION_ARTIFACT_BYTES} bytes.`,
      );
    }

    const boundedBuffer = Buffer.allocUnsafe(MAX_VISUALIZATION_ARTIFACT_BYTES + 1);
    let offset = 0;
    while (offset < boundedBuffer.length) {
      const { bytesRead } = await fileHandle.read(
        boundedBuffer,
        offset,
        boundedBuffer.length - offset,
        null,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > MAX_VISUALIZATION_ARTIFACT_BYTES) {
      throw new VisualizationArtifactError(
        "FILE_TOO_LARGE",
        `Visualization artifact exceeds ${MAX_VISUALIZATION_ARTIFACT_BYTES} bytes.`,
      );
    }
    return { buffer: boundedBuffer.subarray(0, offset), modifiedAtMs: fileStat.mtimeMs };
  } finally {
    await fileHandle.close();
  }
}

export async function readVisualizationArtifact(input: VisualizationArtifactRequest): Promise<VisualizationArtifact> {
  const { visualizationRoot, sessionDir } = getPaths(input);
  validateFileName(input.fileName);

  try {
    const [realVisualizationRoot, realSessionDir] = await Promise.all([
      realpath(visualizationRoot),
      realpath(sessionDir),
    ]);
    if (!isPathWithin(realVisualizationRoot, realSessionDir)) {
      throw new VisualizationArtifactError(
        "PATH_ESCAPE",
        "Visualization session directory resolves outside the visualization root.",
      );
    }
    const sessionStat = await lstat(sessionDir);
    if (sessionStat.isSymbolicLink()) {
      throw new VisualizationArtifactError(
        "SYMBOLIC_LINK",
        "Visualization session directories cannot be symbolic links.",
      );
    }

    const requestedPath = join(realSessionDir, input.fileName);
    const requestedStat = await lstat(requestedPath);
    if (requestedStat.isSymbolicLink()) {
      throw new VisualizationArtifactError(
        "SYMBOLIC_LINK",
        "Visualization artifacts cannot be symbolic links.",
      );
    }

    const absolutePath = await realpath(requestedPath);
    if (!isPathWithin(realSessionDir, absolutePath)) {
      throw new VisualizationArtifactError(
        "PATH_ESCAPE",
        "Visualization artifact resolves outside its session directory.",
      );
    }

    const { buffer, modifiedAtMs } = await readBoundedFile(absolutePath, {
      dev: requestedStat.dev,
      ino: requestedStat.ino,
      nlink: requestedStat.nlink,
    });
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch (error) {
      throw new VisualizationArtifactError(
        "INVALID_UTF8",
        "Visualization artifact is not valid UTF-8.",
        { cause: error },
      );
    }

    return {
      content,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      absolutePath,
      metadata: {
        sessionId: input.sessionId,
        fileName: input.fileName,
        sizeBytes: buffer.byteLength,
        mimeType: HTML_MIME_TYPE,
        modifiedAtMs,
      },
    };
  } catch (error) {
    throw asArtifactError(error, "Unable to read the visualization artifact.");
  }
}
