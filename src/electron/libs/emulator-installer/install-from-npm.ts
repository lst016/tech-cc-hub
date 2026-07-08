// src/electron/libs/emulator-installer/install-from-npm.ts
// -----------------------------------------------------------------------------
// Phase 8: device-emulator-plugin npm registry install layer.
// Drives `npm view` and `npm install -g` to pull packages like
// @mobilenext/mobile-mcp and report the on-disk install state. Wrapped in
// child_process.execFile so we never go through a shell, which keeps Windows
// path quoting and .cmd shimming sane.
// -----------------------------------------------------------------------------

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export type NpmInstallOptions = {
  packageName: string;
};

export async function fetchLatestNpmVersion(packageName: string): Promise<string | null> {
  try {
    const { stdout } = await withTimeout(
      execFileAsync(npmCommand(), ["view", packageName, "version"], {
        timeout: 30_000,
        maxBuffer: 1024 * 256,
      }),
      35_000,
      "npm view",
    );
    const version = stdout.trim();
    return version || null;
  } catch {
    return null;
  }
}

export async function isPackageInstalledGlobally(
  packageName: string,
): Promise<{ installed: boolean; version?: string }> {
  try {
    const { stdout } = await withTimeout(
      execFileAsync(npmCommand(), ["list", "-g", packageName, "--depth=0", "--json"], {
        timeout: 30_000,
        maxBuffer: 1024 * 256,
      }),
      35_000,
      "npm list",
    );
    const parsed = JSON.parse(stdout) as {
      dependencies?: Record<string, { version?: string }>;
    };
    const entry = parsed.dependencies?.[packageName];
    if (entry?.version) return { installed: true, version: entry.version };
    return { installed: false };
  } catch {
    return { installed: false };
  }
}

export async function installNpmPackageGlobal(
  options: NpmInstallOptions,
): Promise<{ success: boolean; version?: string; error?: string }> {
  try {
    await withTimeout(
      execFileAsync(npmCommand(), ["install", "-g", options.packageName], {
        timeout: 300_000,
        maxBuffer: 1024 * 1024,
      }),
      320_000,
      "npm install -g",
    );
    const { version } = await isPackageInstalledGlobally(options.packageName);
    return version
      ? { success: true, version }
      : {
          success: false,
          error: "npm install reported success but the package is not visible on the global prefix.",
        };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
