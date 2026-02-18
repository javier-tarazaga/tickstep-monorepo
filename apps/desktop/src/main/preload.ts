import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  onDeepLink: (callback: (url: string) => void) => {
    ipcRenderer.on("deep-link", (_event, url: string) => callback(url));
  },
  auth: {
    save: (auth: {
      user: { id: string; email: string };
      tokens: { accessToken: string; refreshToken: string };
    }) => ipcRenderer.invoke("auth:save", auth),

    load: () =>
      ipcRenderer.invoke("auth:load") as Promise<{
        user: { id: string; email: string };
        tokens: { accessToken: string; refreshToken: string };
      } | null>,

    clear: () => ipcRenderer.invoke("auth:clear"),
  },
});
