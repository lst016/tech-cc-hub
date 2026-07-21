import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const distDir = path.join(repoRoot, "dist");
const stagingRoot = path.join(distDir, ".mac-fast-building");
const stagingAppDir = path.join(stagingRoot, "mac-arm64");
const finalAppDir = path.join(distDir, "mac-arm64");
const expectedAppName = "tech-cc-hub.app";
const expectedExecutableName = "tech-cc-hub";
const expectedApp = path.join(finalAppDir, expectedAppName);

function cleanupStaging() {
  rmSync(stagingRoot, { recursive: true, force: true });
}

function fail(message) {
  cleanupStaging();
  console.error(`[package-mac-fast] ${message}`);
  process.exit(1);
}

function readPlist(appPath) {
  const infoPlist = path.join(appPath, "Contents", "Info.plist");
  const result = spawnSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", infoPlist], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr.trim() || `plutil failed with status ${result.status ?? "unknown"}`;
    fail(`failed to read Info.plist: ${detail}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`invalid Info.plist JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function verifyPackagedName(appPath) {
  const appName = path.basename(appPath);
  if (appName !== expectedAppName) {
    fail(`unexpected app bundle name: ${appName}`);
  }

  const plist = readPlist(appPath);
  for (const key of ["CFBundleName", "CFBundleDisplayName", "CFBundleExecutable"]) {
    if (plist[key] !== expectedExecutableName) {
      fail(`unexpected ${key}: ${String(plist[key] ?? "")}`);
    }
  }

  const executablePath = path.join(appPath, "Contents", "MacOS", expectedExecutableName);
  if (!existsSync(executablePath)) {
    fail(`missing packaged executable: ${executablePath}`);
  }
}

function runBuilder() {
  cleanupStaging();
  mkdirSync(distDir, { recursive: true });

  const builder = path.join(repoRoot, "node_modules", ".bin", "electron-builder");
  const child = spawn(builder, [
    "--mac",
    "dir",
    "--arm64",
    "--publish",
    "never",
    "--config.directories.output=dist/.mac-fast-building",
    "--config.mac.identity=-",
    "--config.mac.notarize=false",
  ], {
    cwd: repoRoot,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
    },
    stdio: "inherit",
  });

  let stopping = false;
  const stop = (signal) => {
    if (stopping) return;
    stopping = true;
    if (process.platform !== "win32") {
      try {
        process.kill(-child.pid, signal);
      } catch {
        child.kill(signal);
      }
    } else {
      child.kill(signal);
    }
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
      cleanupStaging();
      process.exit(1);
    }, 3000).unref();
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  child.on("error", (error) => fail(`failed to start electron-builder: ${error.message}`));
  child.on("exit", (code, signal) => {
    if (signal) {
      cleanupStaging();
      process.exit(1);
    }
    if (code !== 0) {
      fail(`electron-builder exited with code ${code ?? "unknown"}`);
    }

    const stagedApp = path.join(stagingAppDir, expectedAppName);
    verifyPackagedName(stagedApp);

    rmSync(finalAppDir, { recursive: true, force: true });
    renameSync(stagingAppDir, finalAppDir);
    cleanupStaging();
    verifyPackagedName(expectedApp);
    console.log(`[package-mac-fast] PACKAGED_MAC_FAST_OK ${expectedApp}`);
  });
}

runBuilder();
