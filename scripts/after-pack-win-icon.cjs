const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MAX_ICON_APPLY_ATTEMPTS = 5;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = async function applyWindowsIconAfterPack(context) {
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
