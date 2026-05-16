# scripts/dev-electron.mjs

> 模块：`scripts` · 语言：`javascript` · 行数：150

## 文件职责

准备macOS签名Electron运行时缓存并启动electron进程

## 关键符号

- `prepareMacElectronDist@0 - 检查或创建Electron.app签名缓存，包括codesign验证和xattr清理`
- `verifyCodesign@0 - 使用codesign --verify --deep验证应用签名状态`
- `cleanMacExtendedAttributes@0 - 清除Finder Info、provenance等macOS扩展属性`
- `electronVersionLabel@0 - 从package.json提取electron版本号`

## 依赖输入

- `node:child_process`
- `node:fs`
- `node:os`
- `node:path`
- `node:url`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: "pipe",
        ...options,
    });

    if (result.status !== 0) {
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        throw new Error(`${command} ${args.join(" ")} failed${output ? `:\n${output}` : ""}`);
    }

    return result;
}

function runOptional(command, args) {
    spawnSync(command, args, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: "ignore",
    });
}

function verifyCodesign(appPath) {
    const result = spawnSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: "pipe",
    });
    return result.status === 0;
}

function shellQuote(value) {
    return `'${value.replaceAll("'", "'\\''")}'`;
}

function electronVersionLabel() {
    const packageJsonPath = path.join(repoRoot, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const declaredVersion = packageJson.devDependencies?.electron ?? packageJson.dependencies?.electron ?? "unknown";
    const normalized = String(declaredVersion).replace(/^[^\d]*/, "").replace(/[^\d.].*$/, "");
    return normalized || "unknown";
}

function cleanMacExtendedAttributes(appPath) {
    runOptional("xattr", ["-cr", appPath]);
    for (const attr of [
        "com.apple.FinderInfo",
        "com.apple.provenance",
        "com.apple.fileprovider.fpfs#P",
        "com.apple.quarantine",
    ]) {
        runOptional("xattr", ["-dr", attr, appPath]);
    }

    run("/bin/sh", [
        "-c",
        `find ${shellQuote(appPath)} -xattr -exec sh -c 'xattr -d com.apple.FinderInfo "$1" 2>/dev/null || true' sh {} \\;`,
    ]);
}

function prepareMacElectronDist() {
    if (process.platform !== "darwin") {
        return null;
    }

    const existingOverride = process.env.ELECTRON_OVERRIDE_DIST_PATH;
    if (existingOverride && verifyCodesign(path.join(existingOverride, "Electron.app"))) {
        return existingOverride;
    }

    const version = electronVersionLabel();
    const sourceDist = path.join(repoRoot, "node_modules", "electron", "dist");
    const sourceApp = path.join(sourceDist, "Electron.app");
    if (!existsSync(sourceApp)) {
        throw new Error(`Electron.app not found at ${sourceApp}. Run npm install first.`);
    }

    const cacheDist = path.join(homedir(), "Library", "Caches", "tech-cc-hub", `electron-${version}-dist`);
    const cacheApp = path.join(cacheDist, "Electron.app");
    if (existsSync(cacheApp) && verifyCodesign(cacheApp)) {
        console.log(`[dev:electron] using cached signed Electron.app: ${cacheApp}`);
        return cacheDist;
    }

    console.log(`[dev:electron] preparing signed Electron.app cache: ${cacheApp}`);
    rmSync(cacheDist, { recursive: true, force: true });
    mkdirSync(path.dirname(cacheDist), { recursive: true });
    run("ditto", ["--norsrc", sourceDist, cacheDist]);
    cleanMacExtendedAttributes(cacheApp);
    run("codesign", ["--force", "--deep", "--sign", "-", cacheApp]);

    if (!verifyCodesign(cacheApp)) {
        throw new Error(`Prepared Electron.app did not pass codesign verification: ${cacheApp}`);
    }

    return cacheDist;
}

const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? "development",
};

try {
    const overrideDistPath = prepareMacElectronDist();
    if (overrideDistPath) {
        env.ELECTRON_OVERRIDE_DIST_PATH = overrideDistPath;
    }
} catch (error) {
    console.error("[dev:electron] failed to prepare Electron runtime");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}

const electronCli = path.join(repoRoot, "node_modules", "electron", "cli.js")
... (truncated)
```
