import { spawn } from "node:child_process";

const children = new Map();
let shuttingDown = false;

function stopAll(exitCode = 0) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    for (const child of children.values()) {
        if (!child.killed) {
            child.kill();
        }
    }

    setTimeout(() => process.exit(exitCode), 500).unref();
}

function startTask(name, args) {
    const command = `npm ${args.join(" ")}`;
    const child = process.platform === "win32"
        ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], {
            stdio: "inherit",
            env: process.env,
            windowsHide: true,
        })
        : spawn("npm", args, {
            stdio: "inherit",
            env: process.env,
        });

    children.set(name, child);

    child.on("exit", (code, signal) => {
        children.delete(name);

        if (shuttingDown) {
            return;
        }

        if (code === 0) {
            stopAll(0);
            return;
        }

        const reason = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
        console.error(`[dev] ${name} exited with ${reason}`);
        stopAll(typeof code === "number" && code !== 0 ? code : 1);
    });

    child.on("error", (error) => {
        console.error(`[dev] failed to start ${name}:`, error);
        stopAll(1);
    });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

console.log("[dev] starting React and Electron...");
startTask("react", ["run", "dev:react"]);
startTask("electron", ["run", "dev:electron"]);
