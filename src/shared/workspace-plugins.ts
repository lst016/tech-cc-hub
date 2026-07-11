export const WORKSPACE_PLUGIN_PERMISSIONS = ["session.snapshot", "session.send", "session.images.receive", "session.images.generate"] as const;
export const WORKSPACE_PLUGIN_HOOKS = ["session.image.add"] as const;

export type WorkspacePluginPermission = typeof WORKSPACE_PLUGIN_PERMISSIONS[number];
export type WorkspacePluginHookName = typeof WORKSPACE_PLUGIN_HOOKS[number];

export type WorkspacePluginHook = {
  urlTemplate: string;
};

export type WorkspacePluginManifest = {
  id: string;
  label: string;
  surface: "browser-view";
  start: {
    command: string;
    args: string[];
    urlTemplate?: string;
    environment?: Record<string, string>;
  };
  hooks?: Partial<Record<WorkspacePluginHookName, WorkspacePluginHook>>;
  permissions: WorkspacePluginPermission[];
};

export type WorkspacePluginDescriptor = Pick<WorkspacePluginManifest, "id" | "label" | "surface" | "permissions">;

const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizePermissions(value: unknown): WorkspacePluginPermission[] | null {
  if (!Array.isArray(value)) return null;
  const normalized: WorkspacePluginPermission[] = [];
  for (const permission of value) {
    if (!WORKSPACE_PLUGIN_PERMISSIONS.includes(permission as WorkspacePluginPermission)) return null;
    if (!normalized.includes(permission as WorkspacePluginPermission)) {
      normalized.push(permission as WorkspacePluginPermission);
    }
  }
  return normalized;
}

function normalizeEnvironment(value: unknown): Record<string, string> | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;
  const environment: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || typeof item !== "string") return null;
    environment[key] = item;
  }
  return environment;
}

function normalizeHooks(value: unknown): Partial<Record<WorkspacePluginHookName, WorkspacePluginHook>> | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;
  const hooks: Partial<Record<WorkspacePluginHookName, WorkspacePluginHook>> = {};
  for (const [name, hook] of Object.entries(value)) {
    if (!WORKSPACE_PLUGIN_HOOKS.includes(name as WorkspacePluginHookName) || !isRecord(hook)) return null;
    const urlTemplate = normalizeString(hook.urlTemplate);
    if (!urlTemplate) return null;
    hooks[name as WorkspacePluginHookName] = { urlTemplate };
  }
  return hooks;
}

export function getWorkspacePluginTabId(id: string): `plugin:${string}` {
  return `plugin:${id}`;
}

export function getWorkspacePluginSurfaceId(pluginId: string, sessionId: string): string {
  return `workspace-plugin:${pluginId}:${sessionId}`;
}

export function normalizeWorkspacePluginManifest(value: unknown): WorkspacePluginManifest | null {
  if (!isRecord(value)) return null;

  const id = normalizeString(value.id);
  const label = normalizeString(value.label);
  if (!id || !PLUGIN_ID_PATTERN.test(id) || !label || value.surface !== "browser-view") return null;
  if (!isRecord(value.start)) return null;

  const command = normalizeString(value.start.command);
  if (!command || !Array.isArray(value.start.args) || !value.start.args.every((arg) => typeof arg === "string")) {
    return null;
  }
  const urlTemplate = value.start.urlTemplate === undefined
    ? undefined
    : normalizeString(value.start.urlTemplate);
  if (value.start.urlTemplate !== undefined && !urlTemplate) return null;
  const environment = normalizeEnvironment(value.start.environment);
  if (!environment) return null;
  const hooks = normalizeHooks(value.hooks);
  if (!hooks) return null;

  const permissions = normalizePermissions(value.permissions);
  if (!permissions) return null;

  return {
    id,
    label,
    surface: "browser-view",
    start: {
      command,
      args: [...value.start.args],
      ...(urlTemplate ? { urlTemplate } : {}),
      ...(Object.keys(environment).length > 0 ? { environment } : {}),
    },
    ...(Object.keys(hooks).length > 0 ? { hooks } : {}),
    permissions,
  };
}
