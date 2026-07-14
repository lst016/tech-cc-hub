const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MAX_ICON_APPLY_ATTEMPTS = 5;
const CODEX_OAUTH_PROTOCOL_SCHEME = "tech-cc-hub";

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
