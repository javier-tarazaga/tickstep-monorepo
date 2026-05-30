import { app, BrowserWindow, shell, ipcMain, nativeImage } from "electron";
import { join } from "path";
import * as tokenStorage from "./tokenStorage";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 640,
    minHeight: 480,
    show: false,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // In development, load from the dev server
  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  // In dev the app isn't packaged, so macOS shows the default Electron dock
  // icon. Set it explicitly. (Packaged builds use build/icon.png via electron-builder.)
  if (process.platform === "darwin" && process.env["ELECTRON_RENDERER_URL"]) {
    const icon = nativeImage.createFromPath(join(__dirname, "../../build/icon.png"));
    if (!icon.isEmpty()) app.dock?.setIcon(icon);
  }

  // Auth IPC handlers — bridge between renderer and encrypted storage
  ipcMain.handle("auth:save", (_event, auth) => tokenStorage.saveAuth(auth));
  ipcMain.handle("auth:load", () => tokenStorage.loadAuth());
  ipcMain.handle("auth:clear", () => tokenStorage.clearAuth());

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
