import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import type {
  BrowserWorkbenchRecordingPackage,
  BrowserWorkbenchRecordingRunAttachments,
  BrowserWorkbenchRecordingRunEvent,
  BrowserWorkbenchRecordingRunResult,
  BrowserWorkbenchRecordingRunStatus,
} from "./types.js";

type RunBrowserWorkbenchRecordingPackageInput = {
  workspaceRoot: string;
  recordingPackage: BrowserWorkbenchRecordingPackage;
  savedRootPath?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  onEvent?: (event: BrowserWorkbenchRecordingRunEvent) => void;
};

const DEFAULT_RUN_TIMEOUT_MS = 90_000;
const MAX_RUN_OUTPUT_CHARS = 80_000;

function truncateOutput(value: string): string {
  if (value.length <= MAX_RUN_OUTPUT_CHARS) return value;
  return value.slice(value.length - MAX_RUN_OUTPUT_CHARS);
}

function resolvePlaywrightCommand(workspaceRoot: string): string {
  const executableName = process.platform === "win32" ? "playwright.cmd" : "playwright";
  const candidates = [
    join(resolve(workspaceRoot), "node_modules", ".bin", executableName),
    join(process.cwd(), "node_modules", ".bin", executableName),
  ];
  const command = candidates.find((candidate) => existsSync(candidate));
  if (!command) {
    throw new Error("Playwright CLI not found. Install @playwright/test in the workspace or app root.");
  }
  return command;
}

function pathInside(root: string, target: string): boolean {
  const relativePath = relative(root, target);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function resolveRecordingRootPath(workspaceRoot: string, recordingPackage: BrowserWorkbenchRecordingPackage, savedRootPath?: string): string {
  const root = resolve(workspaceRoot);
  const rootPath = resolve(savedRootPath || join(root, recordingPackage.rootPathHint));
  if (!pathInside(root, rootPath)) {
    throw new Error(`Recording root escapes workspace: ${rootPath}`);
  }
  return rootPath;
}

function resolveGeneratedSpecPath(recordingPackage: BrowserWorkbenchRecordingPackage, rootPath: string): string {
  const prefix = `${recordingPackage.rootPathHint}/`;
  if (!recordingPackage.generatedSpecPath.startsWith(prefix)) {
    throw new Error(`Generated spec path is outside recording package: ${recordingPackage.generatedSpecPath}`);
  }
  const relativeSpecPath = recordingPackage.generatedSpecPath.slice(prefix.length);
  const specPath = resolve(rootPath, relativeSpecPath);
  if (!pathInside(rootPath, specPath)) {
    throw new Error(`Generated spec path escapes recording root: ${recordingPackage.generatedSpecPath}`);
  }
  return specPath;
}

function statusFromExit(exitCode: number | undefined, timedOut: boolean, cancelled: boolean): BrowserWorkbenchRecordingRunStatus {
  if (cancelled) return "cancelled";
  if (timedOut) return "timed-out";
  if (exitCode === 0) return "passed";
  if (typeof exitCode === "number") return "failed";
  return "error";
}

function emptyAttachments(): BrowserWorkbenchRecordingRunAttachments {
  return {
    traceFiles: [],
    screenshotFiles: [],
    videoFiles: [],
    otherFiles: [],
  };
}

function collectRunAttachments(outputDir: string): BrowserWorkbenchRecordingRunAttachments {
  const attachments = emptyAttachments();
  if (!existsSync(outputDir)) return attachments;
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const filePath = join(directory, entry);
      const stats = statSync(filePath);
      if (stats.isDirectory()) {
        visit(filePath);
        continue;
      }
      const lower = entry.toLowerCase();
      if (lower === "trace.zip" || lower.endsWith(".trace.zip")) {
        attachments.traceFiles.push(filePath);
      } else if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
        attachments.screenshotFiles.push(filePath);
      } else if (lower.endsWith(".webm") || lower.endsWith(".mp4")) {
        attachments.videoFiles.push(filePath);
      } else {
        attachments.otherFiles.push(filePath);
      }
    }
  };
  visit(outputDir);
  return attachments;
}

function makeRunEvent(
  input: {
    sequence: number;
    type: BrowserWorkbenchRecordingRunEvent["type"];
    recordingId: string;
    message?: string;
    status?: BrowserWorkbenchRecordingRunStatus;
  },
): BrowserWorkbenchRecordingRunEvent {
  return {
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `run-event-${Date.now()}-${input.sequence}`,
    type: input.type,
    timestamp: Date.now(),
    sequence: input.sequence,
    recordingId: input.recordingId,
    message: input.message,
    status: input.status,
  };
}

export async function runBrowserWorkbenchRecordingPackage(
  input: RunBrowserWorkbenchRecordingPackageInput,
): Promise<BrowserWorkbenchRecordingRunResult> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const startedAt = Date.now();
  const rootPath = resolveRecordingRootPath(workspaceRoot, input.recordingPackage, input.savedRootPath);
  const specPath = resolveGeneratedSpecPath(input.recordingPackage, rootPath);
  const outputDir = join(rootPath, "run-results", `${new Date(startedAt).toISOString().replace(/[-:.]/g, "")}-${basename(specPath, ".ts")}`);
  const command = resolvePlaywrightCommand(workspaceRoot);
  const args = [
    "test",
    specPath,
    "--reporter=list",
    "--trace=on",
    "--workers=1",
    "--output",
    outputDir,
  ];

  if (!existsSync(specPath)) {
    const endedAt = Date.now();
    const event = makeRunEvent({
      sequence: 1,
      type: "error",
      recordingId: input.recordingPackage.id,
      message: `Generated spec not found: ${specPath}`,
      status: "error",
    });
    input.onEvent?.(event);
    return {
      success: false,
      status: "error",
      recordingId: input.recordingPackage.id,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      workspaceRoot,
      rootPath,
      specPath,
      outputDir,
      command,
      args,
      stdout: "",
      stderr: "",
      events: [event],
      attachments: emptyAttachments(),
      error: `Generated spec not found: ${specPath}`,
    };
  }

  mkdirSync(outputDir, { recursive: true });

  return await new Promise<BrowserWorkbenchRecordingRunResult>((resolveResult) => {
    const events: BrowserWorkbenchRecordingRunEvent[] = [];
    let sequence = 0;
    const emitEvent = (type: BrowserWorkbenchRecordingRunEvent["type"], message?: string, status?: BrowserWorkbenchRecordingRunStatus) => {
      sequence += 1;
      const event = makeRunEvent({
        sequence,
        type,
        recordingId: input.recordingPackage.id,
        message,
        status,
      });
      events.push(event);
      input.onEvent?.(event);
    };
    emitEvent("started", `${command} ${args.join(" ")}`);

    const child = spawn(command, args, {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        CI: process.env.CI ?? "1",
      },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let cancelled = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, Math.max(1_000, input.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS));
    const abortRun = () => {
      cancelled = true;
      child.kill("SIGTERM");
    };
    if (input.signal?.aborted) {
      abortRun();
    } else {
      input.signal?.addEventListener("abort", abortRun, { once: true });
    }

    child.stdout.on("data", (chunk) => {
      const message = chunk.toString("utf8");
      stdout = truncateOutput(`${stdout}${message}`);
      emitEvent("stdout", message);
    });
    child.stderr.on("data", (chunk) => {
      const message = chunk.toString("utf8");
      stderr = truncateOutput(`${stderr}${message}`);
      emitEvent("stderr", message);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abortRun);
      const endedAt = Date.now();
      emitEvent("error", error.message, "error");
      resolveResult({
        success: false,
        status: "error",
        recordingId: input.recordingPackage.id,
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        workspaceRoot,
        rootPath,
        specPath,
        outputDir,
        command,
        args,
        stdout,
        stderr,
        events,
        attachments: collectRunAttachments(outputDir),
        error: error.message,
      });
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abortRun);
      const endedAt = Date.now();
      const status = statusFromExit(exitCode ?? undefined, timedOut, cancelled);
      const attachments = collectRunAttachments(outputDir);
      emitEvent("finished", status, status);
      resolveResult({
        success: status === "passed",
        status,
        recordingId: input.recordingPackage.id,
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        workspaceRoot,
        rootPath,
        specPath,
        outputDir,
        command,
        args,
        exitCode: exitCode ?? undefined,
        signal: signal ?? undefined,
        stdout,
        stderr,
        events,
        attachments,
        traceViewerCommand: attachments.traceFiles[0] ? `${command} show-trace ${attachments.traceFiles[0]}` : undefined,
        error: status === "timed-out" ? "Playwright run timed out." : status === "cancelled" ? "Playwright run was cancelled." : undefined,
      });
    });
  });
}
