# scripts/after-pack-win-icon.cjs

> 模块：`scripts` · 语言：`javascript` · 行数：40

## 文件职责

electron-builder的afterPack钩子，在打包后为Windows exe嵌入icon

## 关键符号

- `applyWindowsIconAfterPack@0 - main导出函数，使用rcedit.exe为exe设置图标文件`

## 依赖输入

- `node:fs`
- `node:path`
- `node:child_process`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
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

```
