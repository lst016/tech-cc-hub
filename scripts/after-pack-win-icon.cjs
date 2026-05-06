const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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
    console.warn("[after-pack-win-icon] skipped: missing exe, icon, or rcedit");
    return;
  }

  const result = spawnSync(rceditPath, [exePath, "--set-icon", iconPath], {
    cwd: projectDir,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`rcedit failed with status ${result.status}`);
  }
};
