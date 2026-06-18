import { BrowserWindow, shell, app } from "electron";
import { registerHandlers } from "./ipcUtils";

/**
 * Registers window control and app lifecycle IPC handlers.
 */
export function registerWindowHandlers() {
  registerHandlers({
    "win:minimize": (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.minimize();
    },
    "win:maximize": (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win?.isMaximized()) {
        win.unmaximize();
      } else {
        win?.maximize();
      }
    },
    "win:toggle-fullscreen": (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        win.setFullScreen(!win.isFullScreen());
      }
    },
    "win:close": (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.close();
    },
    "app:quit": () => {
      app.quit();
    },
    "app:getVersion": () => {
      return app.getVersion();
    },
    "win:is-maximized": (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return win?.isMaximized() ?? false;
    },
    "win:open-external": async (_event, url: string) => {
      try {
        const parsedUrl = new URL(url);
        const safeProtocols = ["http:", "https:", "mailto:"];
        if (safeProtocols.includes(parsedUrl.protocol)) {
          await shell.openExternal(url);
        } else {
          console.warn(
            `[security] Blocked attempt to open external URL with unsafe protocol: ${url}`,
          );
        }
      } catch (e) {
        console.warn(
          `[security] Blocked attempt to open invalid external URL: ${url}`,
        );
      }
    },
  });
}
