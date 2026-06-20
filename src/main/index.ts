import { app, BrowserWindow, ipcMain, webContents, shell } from "electron";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import JSON5 from "json5";
import { electronApp, is } from "@electron-toolkit/utils";
import { autoUpdater } from "electron-updater";
import { setForwardTarget, destroyTerminal } from "./pty";
import { registerWindowHandlers } from "./ipc/windowHandlers";
import { registerHistoryHandlers } from "./ipc/historyHandlers";
import { registerTerminalHandlers } from "./ipc/terminalHandlers";
import { registerUpdaterHandlers } from "./ipc/updaterHandlers";
import { registerAdblockerIpcHandlers } from "./adblocker";

import icon from "../../resources/icon.png?asset";

let mainWindow: BrowserWindow | null = null;
const windowTerminals = new Map<number, Set<string>>();

function registerForwardTarget(
  terminalId: string,
  window: BrowserWindow,
): void {
  setForwardTarget(terminalId, (event: string, ...args: unknown[]) => {
    if (!window.isDestroyed()) {
      window.webContents.send(event, ...args);
    }
  });
}

function createWindow(isTransparent = false): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 400,
    minHeight: 300,
    title: "Vet",
    ...(process.platform === "linux" ? { icon } : { icon }),
    frame: false,
    transparent: isTransparent,
    backgroundColor: isTransparent ? "#00000000" : "#1e1e2e",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      webSecurity: true,
    },
  });

  // Prevent default reload shortcuts (Ctrl+R, Cmd+R, F5)
  win.webContents.on("before-input-event", (event, input) => {
    if ((input.control || input.meta) && input.key.toLowerCase() === "r") {
      event.preventDefault();
    }
    if (input.key === "F5") {
      event.preventDefault();
    }
  });

  win.on("closed", () => {
    const terminals = windowTerminals.get(win.id);
    if (terminals) {
      for (const tId of terminals) {
        destroyTerminal(tId);
      }
      windowTerminals.delete(win.id);
    }

    if (win === mainWindow) {
      mainWindow = null;
    }
  });

  win.on("maximize", () => {
    win.webContents.send("win:maximize-change", true);
  });

  win.on("unmaximize", () => {
    win.webContents.send("win:maximize-change", false);
  });

  win.webContents.on("console-message", (_event, level, message) => {
    const prefix = ["VERB", "INFO", "WARN", "ERR"][level] ?? "LOG";
    console.log(`[renderer ${prefix}] ${message}`);
  });

  // Security: Block unauthorized new window creation
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url);
      const safeProtocols = ["http:", "https:", "mailto:"];
      if (safeProtocols.includes(parsedUrl.protocol)) {
        shell.openExternal(url);
      } else {
        console.warn(
          `[security] Blocked attempt to open new window with unsafe URL: ${url}`,
        );
      }
    } catch (e) {
      console.warn(
        `[security] Blocked attempt to open new window with invalid URL: ${url}`,
      );
    }
    return { action: "deny" };
  });

  // Security: Block unauthorized navigation
  win.webContents.on("will-navigate", (event, url) => {
    try {
      const parsedUrl = new URL(url);
      // Allow local file navigation in dev or to our specific index.html
      if (
        parsedUrl.protocol === "file:" ||
        (is.dev && parsedUrl.hostname === "localhost")
      ) {
        return;
      }

      console.warn(`[security] Blocked unauthorized navigation to: ${url}`);
      event.preventDefault();
    } catch (e) {
      console.warn(
        `[security] Blocked unauthorized navigation to invalid URL: ${url}`,
      );
      event.preventDefault();
    }
  });

  // Forward webview keyboard events for app hotkeys / shortcuts
  win.webContents.on("did-attach-webview", (_, guestWebContents) => {
    guestWebContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        const hasModifier = input.control || input.meta || input.alt;
        const isFunctionKey = /^F\d+$/.test(input.key);
        const isEscape = input.key === "Escape";

        if (hasModifier || isFunctionKey || isEscape) {
          const modifiers = [];
          if (input.control) modifiers.push("ctrl");
          if (input.meta) modifiers.push("cmd");
          if (input.shift) modifiers.push("shift");
          if (input.alt) modifiers.push("alt");

          const keyName = input.key.toLowerCase();
          modifiers.push(keyName);
          const shortcutString = modifiers.join("+");

          const currentConfig = getConfig();
          const action = currentConfig.keybindings?.[shortcutString];

          const isAppShortcut = action !== undefined || input.key === "Escape";

          if (isAppShortcut) {
            event.preventDefault();
            if (!win.isDestroyed()) {
              win.webContents.send("webview:keydown", {
                key: input.key,
                code: input.code,
                ctrlKey: input.control,
                shiftKey: input.shift,
                altKey: input.alt,
                metaKey: input.meta,
              });
            }
          }
        }
      }
    });
  });

  return win;
}

function loadWindow(win: BrowserWindow, extraParams?: string): void {
  let baseUrl: string;
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    baseUrl = process.env["ELECTRON_RENDERER_URL"];
  } else {
    baseUrl = `file://${join(__dirname, "../renderer/index.html")}`;
  }

  const url = extraParams ? `${baseUrl}?${extraParams}` : baseUrl;
  win.loadURL(url);
}

function registerIpcHandlers(): void {
  registerWindowHandlers();
  registerHistoryHandlers();
  registerTerminalHandlers({
    windowTerminals,
    getMainWindow: () => mainWindow,
    createWindow,
    loadWindow,
    registerForwardTarget,
  });
  registerAdblockerIpcHandlers();
  registerUpdaterHandlers(() => mainWindow);
}

import { initConfigManager, getConfig, cleanupConfigManager } from "./config";
import { initSessionManager, getSessionData } from "./session";
import { initSysInfoManager, cleanupSysInfo } from "./sysinfo";
import { initPortsManager } from "./ports";
import { initWorkspaceManager } from "./workspace";
import { initConnectionsManager } from "./connections";
import { initSftpManager, cleanupSftpSessions } from "./sftp";
import { initClipboardHistoryManager } from "./clipboardHistory";
import * as historyDb from "./historyDb";
import { cleanupAdblocker } from "./adblocker";
import { cleanupUpdaterSimulation } from "./ipc/updaterHandlers";

if (process.platform === "linux" && app.commandLine) {
  app.commandLine.appendSwitch("disable-accelerated-video-decode");
}

process.on("unhandledRejection", (reason) => {
  if (
    reason instanceof Error &&
    reason.message.includes("Script failed to execute")
  ) {
    return;
  }
  console.error("[unhandledRejection]", reason);
});

import { EventEmitter } from "events";
EventEmitter.defaultMaxListeners = 50;
// Note: Prefer setting .setMaxListeners() on specific emitters that need it,
// rather than raising the global default. This global override is kept as a
// safety net since Electron's webContents/ipcMain can accumulate many listeners
// when multiple BrowserViews are created.

app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.vet");

  registerIpcHandlers();

  let isTransparent = false;
  const configPath = join(app.getPath("home"), ".config", "vet", "config.json5");
  try {
    if (existsSync(configPath)) {
      const parsed = JSON5.parse(readFileSync(configPath, "utf-8"));
      const opacity = typeof parsed.opacity === "number" ? parsed.opacity : 1.0;
      isTransparent = opacity < 1.0;
    }
  } catch {
    // Config file may not exist yet on first launch
  }

  mainWindow = createWindow(isTransparent);

  await initConfigManager(mainWindow);

  const config = getConfig();
  if (config.vibrancy && config.vibrancy !== "none") {
    mainWindow.setVibrancy(config.vibrancy);
  }

  initSessionManager();
  initClipboardHistoryManager();
  initSysInfoManager(mainWindow);
  initPortsManager();
  initWorkspaceManager();
  initConnectionsManager();
  initSftpManager();

  loadWindow(mainWindow);

  // Defer heavy init to after the window is visible
  setTimeout(() => {
    historyDb.initHistoryDb();
  }, 100);

  // Adblocker engine loads lazily on first browser tab — IPC handlers registered above

  // Start update check in background after 5s
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(console.error);
  }, 5000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const conf = getConfig();
      const activateTransparent = conf.opacity < 1.0;
      mainWindow = createWindow(activateTransparent);
      if (conf.vibrancy && conf.vibrancy !== "none") {
        mainWindow.setVibrancy(conf.vibrancy);
      }
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  try {
    historyDb.cleanupHistoryDb();
  } catch (err) {
    console.error("Error during history DB cleanup:", err);
  }
  try {
    cleanupConfigManager();
  } catch (err) {
    console.error("Error during config manager cleanup:", err);
  }
  try {
    cleanupSysInfo();
  } catch (err) {
    console.error("Error during sysinfo cleanup:", err);
  }
  try {
    cleanupAdblocker();
  } catch (err) {
    console.error("Error during adblocker cleanup:", err);
  }
  try {
    cleanupUpdaterSimulation();
  } catch (err) {
    console.error("Error during updater simulation cleanup:", err);
  }
  try {
    cleanupSftpSessions();
  } catch (err) {
    console.error("Error during SFTP sessions cleanup:", err);
  }
});
