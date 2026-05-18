import { spawn, execFile } from "node:child_process";
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
export type SpringBootRestartStrategy = "kill-and-run" | "devtools-compile";

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

export type SpringBootRestartInput = SpringBootRunInput & {
  pid?: number;
  strategy?: SpringBootRestartStrategy;
};

export type SpringBootRunResult = {
  action: "idea_run" | "idea_restart";
  success: boolean;
  started: boolean;
  plan?: SpringBootCommandPlan;
  pid?: number;
  logPath?: string;
  waitMs?: number;
  exitedEarly?: boolean;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  killedPids?: number[];
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
  action: "idea_run" | "idea_restart";
  goal: "run" | "compile";
};

const DEFAULT_WAIT_MS = 4000;
const MAX_WAIT_MS = 30000;

export function buildSpringBootCommandPlan(
  input: Pick<SpringBootRunInput, "projectPath" | "buildTool">,
  goal: "run" | "compile" = "run",
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
      args: goal === "run" ? ["spring-boot:run"] : ["-DskipTests", "compile"],
      commandLine: formatCommandLine(command, goal === "run" ? ["spring-boot:run"] : ["-DskipTests", "compile"]),
    };
  }

  if ((buildTool === "auto" || buildTool === "gradle") && (existsSync(gradleWrapper) || hasGradle)) {
    const command = existsSync(gradleWrapper) ? gradleWrapper : (isWindows ? "gradle.bat" : "gradle");
    return {
      cwd,
      tool: "gradle",
      command,
      args: goal === "run" ? ["bootRun"] : ["classes"],
      commandLine: formatCommandLine(command, goal === "run" ? ["bootRun"] : ["classes"]),
    };
  }

  throw new Error("No Maven or Gradle Spring Boot project was detected. Provide a projectPath containing pom.xml, build.gradle, or a build-tool wrapper.");
}

export async function runSpringBoot(input: SpringBootRunInput): Promise<SpringBootRunResult> {
  return startSpringBoot(input, { action: "idea_run", goal: "run" });
}

export async function restartSpringBoot(input: SpringBootRestartInput): Promise<SpringBootRunResult> {
  const strategy = input.strategy ?? "kill-and-run";
  if (strategy === "devtools-compile") {
    return startSpringBoot(input, { action: "idea_restart", goal: "compile" });
  }

  if (!Number.isFinite(input.pid) && !Number.isFinite(input.port)) {
    return {
      action: "idea_restart",
      success: false,
      started: false,
      error: "idea_restart with kill-and-run requires a pid or port. Use strategy=devtools-compile to trigger Spring Boot DevTools without killing a process.",
    };
  }

  const killedPids = await killRequestedTargets(input);
  const result = await startSpringBoot(input, { action: "idea_restart", goal: "run" });
  return {
    ...result,
    killedPids,
  };
}

async function startSpringBoot(input: SpringBootRunInput, options: StartOptions): Promise<SpringBootRunResult> {
  try {
    const waitMs = clampWaitMs(input.waitMs);
    const plan = buildSpringBootCommandPlan(input, options.goal);
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
        success: options.goal === "compile" && exit.code === 0,
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
        note: options.goal === "compile"
          ? "DevTools restart compile finished; verify the already-running app separately."
          : "Spring Boot command exited during the startup wait window; inspect the log before treating it as running.",
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

async function killRequestedTargets(input: SpringBootRestartInput): Promise<number[]> {
  const pids = new Set<number>();
  if (Number.isFinite(input.pid)) {
    pids.add(Math.trunc(input.pid as number));
  }
  if (process.platform === "win32" && Number.isFinite(input.port)) {
    for (const pid of await findWindowsPortPids(Math.trunc(input.port as number))) {
      pids.add(pid);
    }
  }
  if (pids.size === 0) {
    return [];
  }

  for (const pid of pids) {
    if (process.platform === "win32") {
      await execFileText("taskkill.exe", ["/PID", String(pid), "/T", "/F"], 10000).catch(() => "");
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // best effort
        }
      }
    }
  }
  return [...pids];
}

async function findWindowsPortPids(port: number): Promise<number[]> {
  const output = await execFileText("netstat.exe", ["-ano", "-p", "tcp"], 5000).catch(() => "");
  return Array.from(new Set(output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[0]?.toUpperCase() === "TCP"
      && parts[1]?.endsWith(`:${port}`)
      && parts[3]?.toUpperCase() === "LISTENING")
    .map((parts) => Number.parseInt(parts[4] ?? "", 10))
    .filter(Number.isFinite)));
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

function execFileText(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile(command, args, { windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolvePromise(stdout);
    });
  });
}
