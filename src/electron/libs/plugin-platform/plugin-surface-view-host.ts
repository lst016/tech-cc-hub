import type { Rectangle, WebContents, WebPreferences } from "electron";

import type { PluginSurfacePlacement } from "../../../shared/plugin-platform/types.js";
import type { PluginCapabilityGrantRegistry } from "./plugin-capability-grant-registry.js";
import {
  resolveInstalledPluginSurfaceEntry,
  type ResolveInstalledPluginSurfaceEntryResult,
} from "./plugin-surface-entry-resolver.js";
import {
  buildPluginSurfaceWebPreferences,
  installPluginSurfaceSessionGuard,
} from "./plugin-surface-session-guard.js";

export type PluginSurfaceViewLike = {
  webContents: WebContents;
  setBounds: (bounds: Rectangle) => void;
};

export type PluginSurfaceViewHostOptions = {
  pluginsPath: string;
  grants: PluginCapabilityGrantRegistry;
  createInstanceId: () => string;
  createView: (preferences: WebPreferences) => PluginSurfaceViewLike;
  attachView: (view: PluginSurfaceViewLike) => void;
  detachView: (view: PluginSurfaceViewLike) => void;
  destroyView: (view: PluginSurfaceViewLike) => void;
};

export type OpenPluginSurfaceViewInput = {
  pluginId: string;
  surfaceId: string;
  bounds: Rectangle;
};

type ResolverFailureCode = Extract<
  ResolveInstalledPluginSurfaceEntryResult,
  { ok: false }
>["code"];

export type OpenPluginSurfaceViewResult =
  | {
      ok: true;
      pluginId: string;
      surfaceId: string;
      placement: PluginSurfacePlacement;
    }
  | {
      ok: false;
      code:
        | ResolverFailureCode
        | "PLUGIN_NOT_ACTIVE"
        | "INVALID_BOUNDS"
        | "SURFACE_LOAD_FAILED";
      pluginId: string;
      surfaceId: string;
    };

type OpenView = {
  view: PluginSurfaceViewLike;
  disposeGuard: () => void;
  attached: boolean;
};

function viewKey(pluginId: string, surfaceId: string): string {
  return `${pluginId}\0${surfaceId}`;
}

function normalizeBounds(bounds: Rectangle): Rectangle | null {
  const values = [bounds.x, bounds.y, bounds.width, bounds.height];
  if (!values.every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return null;
  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  };
}

export class PluginSurfaceViewHost {
  readonly #options: PluginSurfaceViewHostOptions;
  readonly #views = new Map<string, OpenView>();

  constructor(options: PluginSurfaceViewHostOptions) {
    this.#options = options;
  }

  async open(input: OpenPluginSurfaceViewInput): Promise<OpenPluginSurfaceViewResult> {
    const bounds = normalizeBounds(input.bounds);
    if (!bounds) return this.#failed(input, "INVALID_BOUNDS");

    this.close(input.pluginId, input.surfaceId);
    if (!this.#options.grants.isActive(input.pluginId)) {
      return this.#failed(input, "PLUGIN_NOT_ACTIVE");
    }

    const resolved = await resolveInstalledPluginSurfaceEntry({
      pluginsPath: this.#options.pluginsPath,
      pluginId: input.pluginId,
      surfaceId: input.surfaceId,
    });
    if (!resolved.ok) return resolved;
    if (!this.#options.grants.isActive(input.pluginId)) {
      return this.#failed(input, "PLUGIN_NOT_ACTIVE");
    }

    let view: PluginSurfaceViewLike;
    try {
      view = this.#options.createView(buildPluginSurfaceWebPreferences({
        pluginId: input.pluginId,
        surfaceId: input.surfaceId,
        instanceId: this.#options.createInstanceId(),
      }));
    } catch {
      return this.#failed(input, "SURFACE_LOAD_FAILED");
    }

    const disposeGuard = installPluginSurfaceSessionGuard({
      webContents: view.webContents,
      registry: this.#options.grants,
      pluginId: input.pluginId,
      packageRoot: resolved.packageRoot,
    });
    let attachAttempted = false;
    try {
      view.setBounds(bounds);
      await view.webContents.loadURL(resolved.entryUrl);
      if (!this.#options.grants.isActive(input.pluginId)) {
        disposeGuard();
        this.#options.destroyView(view);
        return this.#failed(input, "PLUGIN_NOT_ACTIVE");
      }
      attachAttempted = true;
      this.#options.attachView(view);
      this.#views.set(viewKey(input.pluginId, input.surfaceId), {
        view,
        disposeGuard,
        attached: true,
      });
    } catch {
      disposeGuard();
      if (attachAttempted) {
        try {
          this.#options.detachView(view);
        } catch {
          // Destruction below remains the final cleanup path.
        }
      }
      this.#options.destroyView(view);
      return this.#failed(input, "SURFACE_LOAD_FAILED");
    }

    return {
      ok: true,
      pluginId: input.pluginId,
      surfaceId: input.surfaceId,
      placement: resolved.placement,
    };
  }

  isOpen(pluginId: string, surfaceId: string): boolean {
    return this.#views.has(viewKey(pluginId, surfaceId));
  }

  setBounds(pluginId: string, surfaceId: string, nextBounds: Rectangle): boolean {
    const bounds = normalizeBounds(nextBounds);
    const openView = this.#views.get(viewKey(pluginId, surfaceId));
    if (!bounds || !openView) return false;
    openView.view.setBounds(bounds);
    return true;
  }

  hide(pluginId: string, surfaceId: string): boolean {
    const openView = this.#views.get(viewKey(pluginId, surfaceId));
    if (!openView) return false;
    if (openView.attached) {
      this.#options.detachView(openView.view);
      openView.attached = false;
    }
    return true;
  }

  show(pluginId: string, surfaceId: string): boolean {
    const key = viewKey(pluginId, surfaceId);
    const openView = this.#views.get(key);
    if (!openView) return false;
    if (!this.#options.grants.isActive(pluginId)) {
      this.close(pluginId, surfaceId);
      return false;
    }
    if (!openView.attached) {
      this.#options.attachView(openView.view);
      openView.attached = true;
    }
    return true;
  }

  close(pluginId: string, surfaceId: string): boolean {
    const key = viewKey(pluginId, surfaceId);
    const openView = this.#views.get(key);
    if (!openView) return false;
    this.#views.delete(key);
    if (openView.attached) this.#options.detachView(openView.view);
    openView.disposeGuard();
    this.#options.destroyView(openView.view);
    return true;
  }

  closeAll(): void {
    for (const key of [...this.#views.keys()]) {
      const separator = key.indexOf("\0");
      this.close(key.slice(0, separator), key.slice(separator + 1));
    }
  }

  #failed(
    input: Pick<OpenPluginSurfaceViewInput, "pluginId" | "surfaceId">,
    code: Extract<OpenPluginSurfaceViewResult, { ok: false }>["code"],
  ): OpenPluginSurfaceViewResult {
    return {
      ok: false,
      code,
      pluginId: input.pluginId,
      surfaceId: input.surfaceId,
    };
  }
}
