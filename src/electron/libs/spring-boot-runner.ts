import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  join,
  resolve,
} from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export type SpringBootBuildTool = "auto" | "maven" | "gradle";

export type SpringBootCommandPlan = {
  cwd: string;
  tool: Exclude<SpringBootBuildTool, "auto">;
  command: string;
  args: string[];
  commandLine: string;
};

export type SpringBootRunInput = {
  projectPath: string;
  buildTool?: SpringBootBuildTool;
  profile?: string;
  port?: number;
  waitMs?: number;
  env?: Record<string, string>;
};

export type SpringBootRunResult = {
  action: "idea_run";
  success: boolean;
  started: boolean;
  plan?: SpringBootCommandPlan;
  pid?: number;
  logPath?: string;
  waitMs?: number;
  exitedEarly?: boolean;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  tail?: string;
  verification?: {
    port?: number;
    healthUrl?: string;
    next: string[];
  };
  error?: string;
  note?: string;
};

type StartOptions = {
  action: "idea_run";
};

const DEFAULT_WAIT_MS = 4000;
const MAX_WAIT_MS = 30000;

export function buildSpringBootCommandPlan(
  input: Pick<SpringBootRunInput, "projectPath" | "buildTool">,
  platform: NodeJS.Platform = process.platform,
): SpringBootCommandPlan {
  const cwd = resolve(input.projectPath);
  const buildTool = input.buildTool ?? "auto";
  const isWindows = platform === "win32";
  const mavenWrapper = join(cwd, isWindows ? "mvnw.cmd" : "mvnw");
  const gradleWrapper = join(cwd, isWindows ? "gradlew.bat" : "gradlew");
  const hasMaven = existsSync(join(cwd, "pom.xml"));
  const hasGradle = existsSync(join(cwd, "build.gradle")) || existsSync(join(cwd, "build.gradle.kts"));

  if ((buildTool === "auto" || buildTool === "maven") && (existsSync(mavenWrapper) || hasMaven)) {
    const command = existsSync(mavenWrapper) ? mavenWrapper : (isWindows ? "mvn.cmd" : "mvn");
    return {
      cwd,
      tool: "maven",
      command,
      args: ["spring-boot:run"],
      commandLine: formatCommandLine(command, ["spring-boot:run"]),
    };
  }

  if ((buildTool === "auto" || buildTool === "gradle") && (existsSync(gradleWrapper) || hasGradle)) {
    const command = existsSync(gradleWrapper) ? gradleWrapper : (isWindows ? "gradle.bat" : "gradle");
    return {
      cwd,
      tool: "gradle",
      command,
      args: ["bootRun"],
      commandLine: formatCommandLine(command, ["bootRun"]),
    };
  }

  throw new Error("No Maven or Gradle Spring Boot project was detected. Provide a projectPath containing pom.xml, build.gradle, or a build-tool wrapper.");
}

export async function runSpringBoot(input: SpringBootRunInput): Promise<SpringBootRunResult> {
  return startSpringBoot(input, { action: "idea_run" });
}

async function startSpringBoot(input: SpringBootRunInput, options: StartOptions): Promise<SpringBootRunResult> {
  try {
    const waitMs = clampWaitMs(input.waitMs);
    const plan = buildSpringBootCommandPlan(input);
    const logPath = createLogPath(plan.cwd, options.action);
    const logFd = openSync(logPath, "a");
    const spawnSpec = toSpawnSpec(plan);
    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd: plan.cwd,
      detached: true,
      env: buildRunEnv(input),
      stdio: ["ignore", logFd, logFd],
      windowsHide: true,
    });
    closeSync(logFd);

    const exitRef: { current: { code: number | null; signal: NodeJS.Signals | null } | null } = { current: null };
    child.once("exit", (code, signal) => {
      exitRef.current = { code, signal };
    });
    child.unref();

    await delay(waitMs);
    const verification = buildVerification(input.port);

    const exit = exitRef.current;
    if (exit) {
      return {
        action: options.action,
        success: false,
        started: false,
        plan,
        pid: child.pid,
        logPath,
        waitMs,
        exitedEarly: true,
        exitCode: exit.code,
        signal: exit.signal,
        tail: readLogTail(logPath),
        verification,
        note: "Spring Boot command exited during the startup wait window; inspect the log before treating it as running.",
      };
    }

    return {
      action: options.action,
      success: true,
      started: true,
      plan,
      pid: child.pid,
      logPath,
      waitMs,
      exitedEarly: false,
      tail: readLogTail(logPath),
      verification,
      note: "Process was launched and stayed alive during the wait window. This is not readiness proof; verify the port and health endpoint.",
    };
  } catch (error) {
    return {
      action: options.action,
      success: false,
      started: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function toSpawnSpec(plan: SpringBootCommandPlan): { command: string; args: string[] } {
  const extension = plan.command.toLowerCase().split(".").pop();
  const isWindowsScript = process.platform === "win32" && (extension === "cmd" || extension === "bat");
  if (!isWindowsScript) {
    return { command: plan.command, args: plan.args };
  }

  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", formatCommandLine(plan.command, plan.args)],
  };
}

function buildRunEnv(input: SpringBootRunInput): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...input.env,
    ...(input.profile?.trim() ? { SPRING_PROFILES_ACTIVE: input.profile.trim() } : {}),
  };
}

function buildVerification(port?: number): SpringBootRunResult["verification"] {
  const next = [
    "Use diagnose_port to confirm the listener.",
    "Use http_ping against /actuator/health or the expected endpoint.",
    "Read the returned log tail/logPath for dependency failures.",
  ];
  if (!Number.isFinite(port)) {
    return { next };
  }

  const normalizedPort = Math.trunc(port as number);
  return {
    port: normalizedPort,
    healthUrl: `http://127.0.0.1:${normalizedPort}/actuator/health`,
    next,
  };
}

function createLogPath(projectPath: string, action: string): string {
  const root = join(tmpdir(), "tech-cc-hub", "spring-boot-runs");
  mkdirSync(root, { recursive: true });
  const hash = createHash("sha1").update(projectPath).digest("hex").slice(0, 8);
  const name = basename(projectPath).replace(/[^a-zA-Z0-9_.-]+/g, "-") || "project";
  return join(root, `${action}-${name}-${hash}-${Date.now()}.log`);
}

function readLogTail(logPath: string): string {
  try {
    return readFileSync(logPath, "utf8").slice(-12000);
  } catch {
    return "";
  }
}

function clampWaitMs(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_WAIT_MS;
  return Math.max(0, Math.min(Math.trunc(value ?? DEFAULT_WAIT_MS), MAX_WAIT_MS));
}

function formatCommandLine(command: string, args: string[]): string {
  return [quoteArg(command), ...args.map(quoteArg)].join(" ");
}

function quoteArg(value: string): string {
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}
