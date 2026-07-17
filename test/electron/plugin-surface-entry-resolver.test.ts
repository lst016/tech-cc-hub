import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { resolveInstalledPluginSurfaceEntry } from "../../src/electron/libs/plugin-platform/plugin-surface-entry-resolver.js";

async function writeSurfacePlugin(
  pluginsRoot: string,
  options: {
    pluginId: string;
    surfaceId?: string;
    placement?: "composer" | "activity-rail" | "settings";
    entry?: string;
    writeEntry?: boolean;
  },
): Promise<string> {
  const packageRoot = join(pluginsRoot, "installed-package");
  const entry = options.entry ?? "./ui/index.html";
  await mkdir(join(packageRoot, ".codex-plugin"), { recursive: true });
  await writeFile(
    join(packageRoot, ".codex-plugin", "plugin.json"),
    JSON.stringify({ name: options.pluginId, version: "1.0.0" }),
    "utf8",
  );
  await writeFile(
    join(packageRoot, "tech-cc-hub.json"),
    JSON.stringify({
      schemaVersion: 1,
      contributes: {
        surfaces: [{
          id: options.surfaceId ?? "workspace",
          placement: options.placement ?? "activity-rail",
          entry,
        }],
      },
    }),
    "utf8",
  );
  if (options.writeEntry !== false) {
    const entryPath = join(packageRoot, ...entry.replace(/^\.\//, "").split("/"));
    await mkdir(join(entryPath, ".."), { recursive: true });
    await writeFile(entryPath, "<!doctype html><title>Plugin</title>", "utf8");
  }
  return packageRoot;
}

test("resolves a declared installed surface to a main-process-only file URL", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-surface-"));
  const packageRoot = await writeSurfacePlugin(pluginsRoot, {
    pluginId: "surface-plugin",
    surfaceId: "quick-action",
    placement: "composer",
    entry: "./ui/action.html",
  });

  try {
    const entryPath = await realpath(join(packageRoot, "ui", "action.html"));
    assert.deepEqual(await resolveInstalledPluginSurfaceEntry({
      pluginsPath: pluginsRoot,
      pluginId: "surface-plugin",
      surfaceId: "quick-action",
    }), {
      ok: true,
      pluginId: "surface-plugin",
      surfaceId: "quick-action",
      placement: "composer",
      entryPath,
      entryUrl: pathToFileURL(entryPath).toString(),
    });
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("does not resolve undeclared plugins, surfaces, or missing entry files", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-surface-"));
  await writeSurfacePlugin(pluginsRoot, {
    pluginId: "surface-plugin",
    surfaceId: "workspace",
    writeEntry: false,
  });

  try {
    assert.deepEqual(await resolveInstalledPluginSurfaceEntry({
      pluginsPath: pluginsRoot,
      pluginId: "missing-plugin",
      surfaceId: "workspace",
    }), {
      ok: false,
      code: "PLUGIN_NOT_INSTALLED",
      pluginId: "missing-plugin",
      surfaceId: "workspace",
    });
    assert.deepEqual(await resolveInstalledPluginSurfaceEntry({
      pluginsPath: pluginsRoot,
      pluginId: "surface-plugin",
      surfaceId: "missing-surface",
    }), {
      ok: false,
      code: "SURFACE_NOT_DECLARED",
      pluginId: "surface-plugin",
      surfaceId: "missing-surface",
    });
    assert.deepEqual(await resolveInstalledPluginSurfaceEntry({
      pluginsPath: pluginsRoot,
      pluginId: "surface-plugin",
      surfaceId: "workspace",
    }), {
      ok: false,
      code: "SURFACE_ENTRY_UNAVAILABLE",
      pluginId: "surface-plugin",
      surfaceId: "workspace",
    });
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("rejects a surface entry whose filesystem alias escapes the package", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-surface-"));
  const pluginsRoot = join(tempRoot, "plugins");
  const externalRoot = join(tempRoot, "external-ui");
  await mkdir(pluginsRoot, { recursive: true });
  await mkdir(externalRoot, { recursive: true });
  await writeFile(join(externalRoot, "index.html"), "<h1>outside</h1>", "utf8");
  const packageRoot = await writeSurfacePlugin(pluginsRoot, {
    pluginId: "escape-plugin",
    entry: "./ui/index.html",
    writeEntry: false,
  });

  try {
    try {
      await symlink(externalRoot, join(packageRoot, "ui"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") {
        t.skip(`symbolic links are unavailable on this host (${code})`);
        return;
      }
      throw error;
    }

    assert.deepEqual(await resolveInstalledPluginSurfaceEntry({
      pluginsPath: pluginsRoot,
      pluginId: "escape-plugin",
      surfaceId: "workspace",
    }), {
      ok: false,
      code: "SURFACE_PATH_ESCAPE",
      pluginId: "escape-plugin",
      surfaceId: "workspace",
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("rejects a hard-linked surface entry that aliases a file outside the package", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-surface-"));
  const pluginsRoot = join(tempRoot, "plugins");
  await mkdir(pluginsRoot, { recursive: true });
  const outsideEntry = join(tempRoot, "outside.html");
  await writeFile(outsideEntry, "<h1>outside</h1>", "utf8");
  const packageRoot = await writeSurfacePlugin(pluginsRoot, {
    pluginId: "hard-link-plugin",
    entry: "./ui/index.html",
    writeEntry: false,
  });
  await mkdir(join(packageRoot, "ui"), { recursive: true });

  try {
    try {
      await link(outsideEntry, join(packageRoot, "ui", "index.html"));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") {
        t.skip(`hard links are unavailable on this host (${code})`);
        return;
      }
      throw error;
    }

    assert.deepEqual(await resolveInstalledPluginSurfaceEntry({
      pluginsPath: pluginsRoot,
      pluginId: "hard-link-plugin",
      surfaceId: "workspace",
    }), {
      ok: false,
      code: "SURFACE_ENTRY_UNSAFE",
      pluginId: "hard-link-plugin",
      surfaceId: "workspace",
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
