const { spawn, execFileSync } = require("node:child_process");
const { existsSync, mkdirSync, readFileSync, rmSync, statSync } = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const defaultExe = path.join(repoRoot, "dist", "win-unpacked", "tech-cc-hub.exe");
const packagedExe = path.resolve(process.env.TECH_CC_HUB_PACKAGED_EXE || defaultExe);
const smokeRoot = path.join(repoRoot, ".tmp", "packaged-smoke");
const timeoutMs = Number(process.env.TECH_CC_HUB_PACKAGED_SMOKE_TIMEOUT_MS || 30000);

const fatalLogPatterns = [
  /A JavaScript error occurred/i,
  /Uncaught Exception/i,
  /Cannot find (?:module|package)/i,
  /Cannot find module ['"].*web-tree-sitter/i,
];

function assertPackagedExe() {
  if (!existsSync(packagedExe)) {
    throw new Error(`Packaged executable not found: ${packagedExe}`);
  }
  if (!statSync(packagedExe).isFile()) {
    throw new Error(`Packaged executable is not a file: ${packagedExe}`);
  }
}

function assertInsideSmokeRoot(target) {
  const relative = path.relative(smokeRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove path outside smoke root: ${target}`);
  }
}

function removeSmokeDir(target, { bestEffort = false } = {}) {
  assertInsideSmokeRoot(target);
  try {
    rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 250,
    });
  } catch (error) {
    if (!bestEffort) {
      throw error;
    }
    console.warn(`[packaged-smoke] cleanup deferred for ${target}: ${error.message}`);
  }
}

function killProcessTree(child) {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // The process can exit between the liveness check and taskkill.
    }
    return;
  }

  child.kill("SIGTERM");
}

function readLog(logPath) {
  if (!existsSync(logPath)) {
    return "";
  }
  return readFileSync(logPath, "utf8");
}

function tail(text, lines = 80) {
  return text.split(/\r?\n/).slice(-lines).join("\n");
}

async function waitForStartup(child, logPath) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const logText = readLog(logPath);
    const fatalPattern = fatalLogPatterns.find((pattern) => pattern.test(logText));
    if (fatalPattern) {
      throw new Error(`Packaged app wrote fatal startup log matching ${fatalPattern}:\n${tail(logText)}`);
    }
    if (logText.includes("[startup] environment")) {
      return logText;
    }
    if (child.exitCode !== null) {
      throw new Error(`Packaged app exited before startup log was written (exit ${child.exitCode}):\n${tail(logText)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for packaged startup log after ${timeoutMs}ms:\n${tail(readLog(logPath))}`);
}

async function main() {
  assertPackagedExe();
  mkdirSync(smokeRoot, { recursive: true });

  const userDataDir = path.join(smokeRoot, `user-data-${Date.now()}`);
  removeSmokeDir(userDataDir);
  mkdirSync(userDataDir, { recursive: true });

  const child = spawn(packagedExe, [], {
    cwd: repoRoot,
    env: {
      ...process.env,
      TECH_CC_HUB_DISABLE_AUTO_UPDATE: "1",
      TECH_CC_HUB_PACKAGED_SMOKE: "1",
      TECH_CC_HUB_USER_DATA_DIR: userDataDir,
    },
    stdio: "ignore",
    windowsHide: true,
  });

  const logPath = path.join(userDataDir, "logs", "main.log");
  let startupLog = "";
  try {
    startupLog = await waitForStartup(child, logPath);
  } finally {
    killProcessTree(child);
  }

  const fatalPattern = fatalLogPatterns.find((pattern) => pattern.test(startupLog));
  if (fatalPattern) {
    throw new Error(`Packaged app wrote fatal startup log matching ${fatalPattern}:\n${tail(startupLog)}`);
  }

  removeSmokeDir(userDataDir, { bestEffort: true });
  console.log(`PACKAGED_SMOKE_OK ${packagedExe}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
