const {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MAX_ICON_APPLY_ATTEMPTS = 5;
const CODEX_OAUTH_PROTOCOL_SCHEME = "tech-cc-hub";
const CODEGRAPH_RUNTIME_PATCH_MARKER = "tech-cc-hub-codegraph-vendor-runtime";

function resolveMacCodeGraphArch(arch) {
  if (arch === 3 || arch === "arm64") {
    return "arm64";
  }
  if (arch === 1 || arch === "x64") {
    return "x64";
  }
  throw new Error(`[after-pack-mac-codegraph] unsupported macOS architecture: ${String(arch)}`);
}

function createCodeGraphRuntimeBootstrap(runtimePackageName) {
  return `\n// ${CODEGRAPH_RUNTIME_PATCH_MARKER}\nconst __codegraphModule = require("node:module");\nconst __codegraphPath = require("node:path");\nconst __codegraphVendorModules = __codegraphPath.join(\n  process.resourcesPath,\n  "app.asar.unpacked",\n  "node_modules",\n  "@colbymchenry",\n  "${runtimePackageName}",\n  "lib",\n  "vendor-node-modules",\n);\nprocess.env.NODE_PATH = process.env.NODE_PATH\n  ? \`\${__codegraphVendorModules}\${__codegraphPath.delimiter}\${process.env.NODE_PATH}\`\n  : __codegraphVendorModules;\n__codegraphModule._initPaths();\n`;
}

function syncMacCodeGraphRuntime(context) {
  const projectDir = context.packager.projectDir;
  const productFilename = context.packager.appInfo.productFilename || "tech-cc-hub";
  const codeGraphArch = resolveMacCodeGraphArch(context.arch);
  const runtimePackageName = `codegraph-darwin-${codeGraphArch}`;
  const sourceRuntimeRoot = path.join(
    projectDir,
    "node_modules",
    "@colbymchenry",
    runtimePackageName,
    "lib",
  );
  const sourceDependencies = path.join(sourceRuntimeRoot, "node_modules");
  const packagedRuntimeRoot = path.join(
    context.appOutDir,
    `${productFilename}.app`,
    "Contents",
    "Resources",
    "app.asar.unpacked",
    "node_modules",
    "@colbymchenry",
    runtimePackageName,
    "lib",
  );
  const packagedEntry = path.join(packagedRuntimeRoot, "dist", "index.js");
  const packagedDependencies = path.join(packagedRuntimeRoot, "vendor-node-modules");

  if (!existsSync(sourceDependencies)) {
    throw new Error(`[after-pack-mac-codegraph] missing bundled runtime dependencies: ${sourceDependencies}`);
  }
  if (!existsSync(packagedEntry)) {
    throw new Error(`[after-pack-mac-codegraph] missing packaged runtime entry: ${packagedEntry}`);
  }

  mkdirSync(packagedRuntimeRoot, { recursive: true });
  rmSync(packagedDependencies, { recursive: true, force: true });
  cpSync(sourceDependencies, packagedDependencies, { recursive: true });

  const entrySource = readFileSync(packagedEntry, "utf8");
  if (!entrySource.includes(CODEGRAPH_RUNTIME_PATCH_MARKER)) {
    const strictDirective = '"use strict";';
    if (!entrySource.startsWith(strictDirective)) {
      throw new Error(`[after-pack-mac-codegraph] unexpected packaged runtime entry: ${packagedEntry}`);
    }
    writeFileSync(
      packagedEntry,
      `${strictDirective}${createCodeGraphRuntimeBootstrap(runtimePackageName)}${entrySource.slice(strictDirective.length)}`,
    );
  }

  for (const requiredPath of [
    path.join(packagedDependencies, "web-tree-sitter", "tree-sitter.cjs"),
    path.join(packagedDependencies, "tree-sitter-wasms", "package.json"),
    path.join(packagedDependencies, "picomatch", "index.js"),
  ]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`[after-pack-mac-codegraph] missing copied runtime dependency: ${requiredPath}`);
    }
  }

  console.log(`[after-pack-mac-codegraph] bundled ${runtimePackageName} runtime dependencies`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function verifyMacProtocolAfterPack(context) {
  const productFilename = context.packager.appInfo.productFilename || "tech-cc-hub";
  const infoPlistPath = path.join(context.appOutDir, `${productFilename}.app`, "Contents", "Info.plist");
  if (!existsSync(infoPlistPath)) {
    throw new Error(`[after-pack-mac-protocol] missing Info.plist: ${infoPlistPath}`);
  }

  const result = spawnSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", infoPlistPath], {
    encoding: "utf8",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    const failure = result.error?.message || result.stderr?.trim() || `plutil failed with status ${result.status ?? "unknown"}`;
    throw new Error(`[after-pack-mac-protocol] ${failure}`);
  }

  let infoPlist;
  try {
    infoPlist = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`[after-pack-mac-protocol] invalid Info.plist JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const protocolRegistered = infoPlist.CFBundleURLTypes?.some((entry) => (
    entry.CFBundleURLSchemes?.includes(CODEX_OAUTH_PROTOCOL_SCHEME)
  ));
  if (!protocolRegistered) {
    throw new Error(`[after-pack-mac-protocol] ${CODEX_OAUTH_PROTOCOL_SCHEME} is missing from CFBundleURLTypes`);
  }
  console.log(`[after-pack-mac-protocol] verified ${CODEX_OAUTH_PROTOCOL_SCHEME} in ${infoPlistPath}`);
}

module.exports = async function applyPlatformAfterPack(context) {
  if (context.electronPlatformName === "darwin") {
    syncMacCodeGraphRuntime(context);
    verifyMacProtocolAfterPack(context);
    return;
  }
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const projectDir = context.packager.projectDir;
  const productFilename = context.packager.appInfo.productFilename || "tech-cc-hub";
  const appOutDir = context.appOutDir;
  const iconPath = path.join(projectDir, "build", "icon.ico");
  const rceditPath = path.join(projectDir, "node_modules", "electron-winstaller", "vendor", "rcedit.exe");
  const candidates = [
    path.join(appOutDir, `${productFilename}.exe`),
    path.join(appOutDir, "tech-cc-hub.exe"),
    path.join(appOutDir, "electron.exe"),
  ];
  const exePath = candidates.find((candidate) => existsSync(candidate));

  if (!exePath || !existsSync(iconPath) || !existsSync(rceditPath)) {
    throw new Error("[after-pack-win-icon] missing exe, icon, or rcedit");
  }

  let lastFailure = "";
  for (let attempt = 1; attempt <= MAX_ICON_APPLY_ATTEMPTS; attempt += 1) {
    const result = spawnSync(rceditPath, [exePath, "--set-icon", iconPath], {
      cwd: projectDir,
      stdio: "inherit",
      shell: false,
    });

    if (!result.error && result.status === 0) {
      console.log(`[after-pack-win-icon] applied ${iconPath} to ${exePath} (attempt ${attempt})`);
      return;
    }

    lastFailure = result.error?.message ?? `rcedit failed with status ${result.status ?? "unknown"}`;
    if (attempt < MAX_ICON_APPLY_ATTEMPTS) {
      await wait(250 * attempt);
    }
  }

  throw new Error(`[after-pack-win-icon] ${lastFailure}`);
};

module.exports.syncMacCodeGraphRuntime = syncMacCodeGraphRuntime;
