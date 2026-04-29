#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const cwd = process.cwd();
const distDir = path.join(cwd, "dist");
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const noSignEnv = {
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
  SIGNTOOL_PATH: "",
  WCT_CSC_KEY_PASSWORD: "",
};

function log(message) {
  console.log(`[tech-cc-hub-packager] ${message}`);
}

function run(cmd, args, options = {}) {
  log(`run: ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...options.env },
    shell: false,
  });
  if (result.error) {
    return { ok: false, error: result.error };
  }
  return { ok: result.status === 0, status: result.status };
}

function cleanOldArtifacts() {
  if (existsSync(distDir)) {
    for (const file of readdirSync(distDir)) {
      if (file === "win-unpacked" && existsSync(path.join(distDir, file))) {
        try {
          rmSync(path.join(distDir, file), { recursive: true, force: true });
        } catch (error) {
          log(`warn: failed to remove win-unpacked, keeping it for fallback: ${String(error?.message ?? error)}`);
        }
      }
      if (
        /^tech-cc-hub(?!-ui\b)/i.test(file) &&
        (file.endsWith(".exe") || file.endsWith(".zip"))
      ) {
        try {
          rmSync(path.join(distDir, file), { force: true });
        } catch (error) {
          log(`warn: failed to remove prior artifact, keeping it for fallback: ${String(error?.message ?? error)}`);
        }
      }
    }
  }
}

function findExeArtifact() {
  if (!existsSync(distDir)) return null;
  const candidates = readdirSync(distDir).filter((f) => f.endsWith(".exe"));
  const matched = candidates.find((f) => /^tech-cc-hub/i.test(f));
  return matched ? path.join(distDir, matched) : null;
}

function hasUnpackedArtifact() {
  return existsSync(path.join(distDir, "win-unpacked"));
}

function makeZipFromFile(sourcePath, targetPath) {
  const result = run("tar", ["-a", "-c", "-f", targetPath, "-C", path.dirname(sourcePath), path.basename(sourcePath)]);
  return result.ok;
}

function makeZipFromDir(sourceDir, targetPath) {
  const result = run("tar", ["-a", "-c", "-f", targetPath, "-C", sourceDir, "."]);
  return result.ok;
}

function createStableOutputs() {
  const exePath = findExeArtifact();
  const unpackedPath = path.join(distDir, "win-unpacked");
  const outputs = [];

  if (existsSync(distDir)) {
    const stableExe = path.join(distDir, `tech-cc-hub-win-x64-${stamp}.exe`);
    if (exePath && existsSync(exePath) && exePath !== stableExe) {
      copyFileSync(exePath, stableExe);
      outputs.push(stableExe);
    }

    const unpackedZip = path.join(distDir, `tech-cc-hub-win-unpacked-${stamp}.zip`);
    if (hasUnpackedArtifact()) {
      rmSync(unpackedZip, { force: true });
      if (makeZipFromDir(unpackedPath, unpackedZip)) {
        outputs.push(unpackedZip);
      }
      const portableZip = path.join(distDir, `tech-cc-hub-win-x64-${stamp}.zip`);
      if (exePath && makeZipFromFile(exePath, portableZip)) {
        outputs.push(portableZip);
      }
    }
  }

  if (outputs.length > 0) {
    log("outputs:");
    for (const output of outputs) {
      log(`- ${path.relative(cwd, output)}`);
    }
  } else {
    log("warning: no stable outputs were produced in this step");
  }
}

function runWithFallback(strategyLabel, command) {
  log(`strategy: ${strategyLabel}`);
  const result = run(command[0], command.slice(1), {
    env: {
      ...noSignEnv,
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
    },
  });
  if (result.ok) {
    log(`success: ${strategyLabel}`);
    return true;
  }

  log(`failed: ${strategyLabel} (status=${result.status ?? "n/a"})`);
  return false;
}

async function main() {
  cleanOldArtifacts();

  const preBuild = run("npm", ["run", "transpile:electron"]);
  if (!preBuild.ok) {
    log("transpile failed, stop.");
    process.exit(1);
  }

  const build = run("npm", ["run", "build"]);
  if (!build.ok) {
    log("build failed, stop.");
    process.exit(1);
  }

  const strategies = [
    ["Primary", ["npx", "electron-builder", "--win", "--x64", "--config.win.forceCodeSigning=false", "--config.win.signAndEditExecutable=false"]],
    ["Fallback-dir", ["npx", "electron-builder", "--win", "--x64", "--dir", "--config.win.forceCodeSigning=false", "--config.win.signAndEditExecutable=false"]],
    ["Fallback-no-sign-flag", ["npx", "electron-builder", "--win", "--x64", "--dir", "--config.asar=true"]],
  ];

  let built = false;
  for (const [label, cmd] of strategies) {
    if (runWithFallback(label, cmd)) {
      built = true;
      break;
    }
  }

  if (!built) {
    log("warning: all electron-builder strategies failed, checking for partial artifacts.");
  }

  const hasOutputs =
    findExeArtifact() !== null ||
    hasUnpackedArtifact();

  if (!hasOutputs) {
    log("packaging failed, no usable artifact found.");
    process.exit(1);
  }

  createStableOutputs();
  log("packaging done.");
}

main();
