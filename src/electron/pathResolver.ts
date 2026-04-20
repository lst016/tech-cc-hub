import { isDev } from "./util.js"
import path from "path"
import { app } from "electron"
import { resolveAppAssetPath } from "./pathResolverCore.js";

export function getPreloadPath() {
    return resolveAppAssetPath(app.getAppPath(), "dist-electron/electron/preload.cjs")
}

export function getUIPath() {
    return path.join(app.getAppPath(), '/dist-react/index.html');
}

export function getIconPath() {
    return resolveAppAssetPath(app.getAppPath(), "templateIcon.png")
}
