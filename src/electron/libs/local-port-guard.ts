import { execFile } from "node:child_process";
import type { Server } from "node:net";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function findWindowsPortListenerPids(port: number, currentPid = process.pid): Promise<number[]> {
  const { stdout } = await execFileAsync("netstat.exe", ["-ano", "-p", "tcp"], {
    timeout: 5000,
    windowsHide: true,
  });
  const pids = new Set<number>();
  for (const line of String(stdout).split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (
      parts[0]?.toUpperCase() === "TCP" &&
      parts[1]?.endsWith(`:${port}`) &&
      parts[3]?.toUpperCase() === "LISTENING"
    ) {
      const pid = Number.parseInt(parts[4] ?? "", 10);
      if (Number.isFinite(pid) && pid > 0 && pid !== currentPid) {
        pids.add(pid);
      }
    }
  }
  return [...pids];
}

export async function killWindowsPortListeners(port: number, currentPid = process.pid): Promise<number[]> {
  if (process.platform !== "win32") {
    return [];
  }

  const pids = await findWindowsPortListenerPids(port, currentPid);
  for (const pid of pids) {
    await execFileAsync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      timeout: 5000,
      windowsHide: true,
    });
  }
  return pids;
}

export function listenWithWindowsPortOwnerKill(
  server: Server,
  options: {
    host: string;
    label: string;
    onError: (error: NodeJS.ErrnoException) => void;
    port: number;
    retryDelayMs?: number;
  },
): void {
  const { host, label, onError, port, retryDelayMs = 250 } = options;
  let killedPortOwner = false;

  const listen = () => {
    server.listen(port, host);
  };

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && !killedPortOwner) {
      killedPortOwner = true;
      void (async () => {
        try {
          const killedPids = await killWindowsPortListeners(port);
          if (killedPids.length === 0) {
            console.warn(`[${label}] Port ${port} is already in use, but no Windows listener PID could be killed.`);
            onError(error);
            return;
          }
          console.warn(`[${label}] Port ${port} was occupied by PID(s) ${killedPids.join(", ")}; killed and retrying startup.`);
          await sleep(retryDelayMs);
          listen();
        } catch (killError) {
          console.error(`[${label}] Failed to kill process occupying port ${port}:`, killError);
          onError(error);
        }
      })();
      return;
    }

    onError(error);
  });

  listen();
}
