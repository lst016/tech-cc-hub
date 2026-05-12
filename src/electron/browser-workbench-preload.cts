import { contextBridge, ipcRenderer } from "electron";

const BROWSER_WORKBENCH_ANNOTATION_CHANNEL = "browser-workbench-annotation";

contextBridge.exposeInMainWorld("__techCcHubAnnotation", {
    emit: (payload: unknown) => {
        const text = typeof payload === "string" ? payload : JSON.stringify(payload);
        ipcRenderer.send(BROWSER_WORKBENCH_ANNOTATION_CHANNEL, text);
    },
});
