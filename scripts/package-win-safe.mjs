#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
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

function failPackaging(message) {
  log(`error: ${message}`);
  process.exit(1);
}

function run(cmd, args, options = {}) {
  const useShell = shouldUseShellForCommand(cmd);
  log(`run: ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...options.env },
    shell: useShell,
  });
  if (result.error) {
    log(`failed to start ${cmd}: ${result.error.message}`);
    return { ok: false, error: result.error };
  }
  return { ok: result.status === 0, status: result.status };
}

function shouldUseShellForCommand(cmd) {
  return process.platform === "win32" && (cmd === "npm" || cmd === "npx");
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
      if (file === ".icon-ico" && existsSync(path.join(distDir, file))) {
        try {
          rmSync(path.join(distDir, file), { recursive: true, force: true });
        } catch (error) {
          log(`warn: failed to remove cached Windows icons, keeping existing cache: ${String(error?.message ?? error)}`);
        }
      }
      if (
        /^tech-cc-hub(?!-ui\b)/i.test(file) &&
        (file.endsWith(".exe") || file.endsWith(".zip") || file.endsWith(".blockmap"))
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

function normalizeLatestArtifactName(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let artifactName = trimmed;
  try {
    const parsedUrl = new URL(trimmed);
    artifactName = decodeURIComponent(path.basename(parsedUrl.pathname));
  } catch {
    artifactName = path.basename(decodeURIComponent(trimmed));
  }

  if (!artifactName || artifactName === "." || artifactName === "..") return null;
  if (path.isAbsolute(artifactName) || artifactName.includes("/") || artifactName.includes("\\") || artifactName.includes("..")) {
    failPackaging(`latest.yml declares an unsafe artifact path: ${value}`);
  }
  return artifactName;
}

function readLatestInstallerName() {
  const latestPath = path.join(distDir, "latest.yml");
  if (!existsSync(latestPath)) return null;
  const latestContent = readFileSync(latestPath, "utf8");
  const pathMatch = latestContent.match(/^path:\s*['"]?(.+?)['"]?\s*$/m);
  return normalizeLatestArtifactName(pathMatch?.[1]);
}

function readLatestInstallerUrls() {
  const latestPath = path.join(distDir, "latest.yml");
  if (!existsSync(latestPath)) return [];
  const latestContent = readFileSync(latestPath, "utf8");
  return [...latestContent.matchAll(/^\s*-\s+url:\s*['"]?(.+?)['"]?\s*$/gm)]
    .map((match) => normalizeLatestArtifactName(match[1]))
    .filter(Boolean);
}

function assertNonEmptyFile(filePath, label) {
  if (!existsSync(filePath)) {
    failPackaging(`${label} is missing: ${path.relative(cwd, filePath)}`);
  }
  const size = statSync(filePath).size;
  if (size <= 0) {
    failPackaging(`${label} is empty: ${path.relative(cwd, filePath)}`);
  }
}

function normalizeArtifactName(name) {
  return name.toLowerCase().replace(/[\s-]+/g, "");
}

function findSourceInstallerForAlias(aliasName) {
  if (!existsSync(distDir)) return null;
  const normalizedAlias = normalizeArtifactName(aliasName);
  const candidates = readdirSync(distDir)
    .filter((file) => file.endsWith(".exe"))
    .filter((file) => !file.includes("__uninstaller"))
    .filter((file) => !/^tech-cc-hub-win-x64-/i.test(file));
  const matched = candidates.find((file) => normalizeArtifactName(file) === normalizedAlias)
    ?? candidates.find((file) => /^tech-cc-hub/i.test(file) && /Setup/i.test(file));
  return matched ? path.join(distDir, matched) : null;
}

function ensureUpdaterMetadataAliases() {
  const latestInstallerName = readLatestInstallerName();
  if (!latestInstallerName) return;

  const aliasExePath = path.join(distDir, latestInstallerName);
  const sourceExePath = existsSync(aliasExePath)
    ? aliasExePath
    : findSourceInstallerForAlias(latestInstallerName);
  if (!sourceExePath || !existsSync(sourceExePath)) {
    failPackaging(`latest.yml points to ${latestInstallerName}, but no matching installer was found`);
  }

  if (sourceExePath !== aliasExePath) {
    copyFileSync(sourceExePath, aliasExePath);
    log(`created updater installer alias: ${path.relative(cwd, aliasExePath)}`);
  }

  const sourceBlockmapPath = `${sourceExePath}.blockmap`;
  const aliasBlockmapPath = `${aliasExePath}.blockmap`;
  if (existsSync(sourceBlockmapPath) && sourceBlockmapPath !== aliasBlockmapPath) {
    copyFileSync(sourceBlockmapPath, aliasBlockmapPath);
    log(`created updater blockmap alias: ${path.relative(cwd, aliasBlockmapPath)}`);
  }
}

function validateUpdaterArtifacts() {
  const latestPath = path.join(distDir, "latest.yml");
  assertNonEmptyFile(latestPath, "updater metadata");

  const latestInstallerName = readLatestInstallerName();
  if (!latestInstallerName) {
    failPackaging("latest.yml does not declare an installer path");
  }

  const latestUrls = readLatestInstallerUrls();
  const installerNames = [...new Set([latestInstallerName, ...latestUrls].filter(Boolean))];
  for (const installerName of installerNames) {
    assertNonEmptyFile(path.join(distDir, installerName), `updater installer asset ${installerName}`);
  }

  assertNonEmptyFile(path.join(distDir, `${latestInstallerName}.blockmap`), "updater blockmap asset");
}

function validatePackagedCodeGraphRuntime() {
  const codegraphRuntimeRoot = path.join(
    distDir,
    "win-unpacked",
    "resources",
    "app.asar.unpacked",
    "node_modules",
    "@colbymchenry",
    "codegraph-win32-x64",
  );

  assertNonEmptyFile(path.join(codegraphRuntimeRoot, "node.exe"), "CodeGraph bundled Node runtime");
  assertNonEmptyFile(path.join(codegraphRuntimeRoot, "lib", "dist", "index.js"), "CodeGraph library entry");
  assertNonEmptyFile(
    path.join(codegraphRuntimeRoot, "lib", "node_modules", "web-tree-sitter", "tree-sitter.cjs"),
    "CodeGraph web-tree-sitter runtime dependency",
  );
  assertNonEmptyFile(
    path.join(codegraphRuntimeRoot, "lib", "node_modules", "tree-sitter-wasms", "package.json"),
    "CodeGraph tree-sitter-wasms runtime dependency",
  );
}

function syncPackagedCodeGraphRuntimeDeps() {
  const sourceDeps = path.join(
    cwd,
    "node_modules",
    "@colbymchenry",
    "codegraph-win32-x64",
    "lib",
    "node_modules",
  );
  const targetDeps = path.join(
    distDir,
    "win-unpacked",
    "resources",
    "app.asar.unpacked",
    "node_modules",
    "@colbymchenry",
    "codegraph-win32-x64",
    "lib",
    "node_modules",
  );

  if (!existsSync(sourceDeps)) {
    failPackaging(`CodeGraph bundled runtime dependencies are missing from node_modules: ${path.relative(cwd, sourceDeps)}`);
  }

  mkdirSync(path.dirname(targetDeps), { recursive: true });
  rmSync(targetDeps, { recursive: true, force: true });
  cpSync(sourceDeps, targetDeps, { recursive: true });
  log(`synced CodeGraph bundled runtime deps: ${path.relative(cwd, targetDeps)}`);
}

function ensureWindowsAppUpdateConfig() {
  const resourcesDir = path.join(distDir, "win-unpacked", "resources");
  if (!existsSync(resourcesDir)) return;

  const appUpdatePath = path.join(resourcesDir, "app-update.yml");
  const content = [
    "provider: generic",
    "url: https://lushengtao.public.pookgitlab.com/tech-cc-hub/releases",
    "updaterCacheDirName: tech-cc-hub-updater",
    "",
  ].join("\n");
  mkdirSync(resourcesDir, { recursive: true });
  writeFileSync(appUpdatePath, content, "utf8");
  log(`wrote updater app config: ${path.relative(cwd, appUpdatePath)}`);
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

function runWithFallback(strategyLabel, commands) {
  log(`strategy: ${strategyLabel}`);
  for (const command of commands) {
    const result = run(command[0], command.slice(1), {
      env: {
        ...noSignEnv,
        ...process.env,
        CSC_IDENTITY_AUTO_DISCOVERY: "false",
      },
    });
    if (!result.ok) {
      log(`failed: ${strategyLabel} (status=${result.status ?? "n/a"})`);
      return false;
    }
    if (command.includes("--dir")) {
      ensureWindowsAppUpdateConfig();
      syncPackagedCodeGraphRuntimeDeps();
      validatePackagedCodeGraphRuntime();
    }
  }

  log(`success: ${strategyLabel}`);
  return true;
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
    [
      "Primary-dir-prepackaged",
      [
        ["npx", "electron-builder", "--win", "--x64", "--dir", "--config.win.forceCodeSigning=false", "--config.win.signAndEditExecutable=false"],
        ["npx", "electron-builder", "--win", "--x64", "--prepackaged", path.join("dist", "win-unpacked"), "--config.win.forceCodeSigning=false", "--config.win.signAndEditExecutable=false"],
      ],
    ],
    ["Fallback-dir", [["npx", "electron-builder", "--win", "--x64", "--dir", "--config.win.forceCodeSigning=false", "--config.win.signAndEditExecutable=false"]]],
    ["Fallback-no-sign-flag", [["npx", "electron-builder", "--win", "--x64", "--dir", "--config.asar=true"]]],
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
  ensureUpdaterMetadataAliases();
  validateUpdaterArtifacts();
  validatePackagedCodeGraphRuntime();
  log("packaging done.");
}

main();
