import type {
  CallbackResponse,
  OnBeforeRequestListenerDetails,
  WebContents,
} from "electron";

import type { PluginCapabilityGrantRegistry } from "./plugin-capability-grant-registry.js";
import { authorizePluginSurfaceRequest } from "./plugin-surface-request-policy.js";

export type BuildPluginSurfaceWebPreferencesInput = {
  pluginId: string;
  surfaceId: string;
  instanceId: string;
};

export type PluginSurfaceWebPreferences = {
  partition: string;
  nodeIntegration: false;
  nodeIntegrationInWorker: false;
  nodeIntegrationInSubFrames: false;
  contextIsolation: true;
  sandbox: true;
  webSecurity: true;
  allowRunningInsecureContent: false;
  webviewTag: false;
  spellcheck: false;
  navigateOnDragDrop: false;
  safeDialogs: true;
};

export function buildPluginSurfaceWebPreferences(
  input: BuildPluginSurfaceWebPreferencesInput,
): PluginSurfaceWebPreferences {
  const partitionParts = [input.pluginId, input.surfaceId, input.instanceId]
    .map((part) => encodeURIComponent(part));
  return {
    partition: `plugin-surface:${partitionParts.join(":")}`,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    spellcheck: false,
    navigateOnDragDrop: false,
    safeDialogs: true,
  };
}

export type InstallPluginSurfaceSessionGuardInput = {
  webContents: WebContents;
  registry: PluginCapabilityGrantRegistry;
  pluginId: string;
  packageRoot: string;
};

function preventDefault(...args: unknown[]): void {
  const event = args[0];
  if (
    typeof event === "object"
    && event !== null
    && "preventDefault" in event
    && typeof event.preventDefault === "function"
  ) {
    event.preventDefault();
  }
}

export function installPluginSurfaceSessionGuard(
  input: InstallPluginSurfaceSessionGuardInput,
): () => void {
  let disposed = false;
  const requestListener = (
    details: OnBeforeRequestListenerDetails,
    callback: (response: CallbackResponse) => void,
  ): void => {
    void authorizePluginSurfaceRequest({
      registry: input.registry,
      pluginId: input.pluginId,
      packageRoot: input.packageRoot,
      requestUrl: details.url,
    }).then(
      (authorization) => callback({ cancel: disposed || !authorization.ok }),
      () => callback({ cancel: true }),
    );
  };

  input.webContents.session.webRequest.onBeforeRequest(
    { urls: ["<all_urls>"] },
    requestListener,
  );
  input.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  input.webContents.on("will-attach-webview", preventDefault);
  input.webContents.on("will-navigate", preventDefault);

  return () => {
    if (disposed) return;
    disposed = true;
    input.webContents.session.webRequest.onBeforeRequest(null);
    input.webContents.removeListener("will-attach-webview", preventDefault);
    input.webContents.removeListener("will-navigate", preventDefault);
  };
}
