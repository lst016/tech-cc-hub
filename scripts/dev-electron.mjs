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

const electronCli = path.join(repoRoot, "node_modules", "electron", "cli.js");
const electronArgs = process.argv.slice(2);
if (electronArgs.length === 0) {
    electronArgs.push(".");
}

const child = spawn(process.execPath, [electronCli, ...electronArgs], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 0);
});

child.on("error", (error) => {
    console.error("[dev:electron] failed to start Electron:", error);
    process.exit(1);
});
