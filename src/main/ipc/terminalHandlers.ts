import { BrowserWindow, ipcMain } from "electron";
import { registerHandlers } from "./ipcUtils";
import {
  createTerminal,
  destroyTerminal,
  writeToTerminal,
  resizeTerminal,
  getTerminalInfo,
  getHistory,
  setForegroundTerminals,
} from "../pty";
import { getConfig } from "../config";

interface TerminalHandlersOptions {
  windowTerminals: Map<number, Set<string>>;
  getMainWindow: () => BrowserWindow | null;
  createWindow: () => BrowserWindow;
  loadWindow: (win: BrowserWindow, extraParams?: string) => void;
  registerForwardTarget: (terminalId: string, window: BrowserWindow) => void;
}

/**
 * Registers terminal and PTY control IPC handlers.
 */
export function registerTerminalHandlers(options: TerminalHandlersOptions) {
  const {
    windowTerminals,
    getMainWindow,
    createWindow,
    loadWindow,
    registerForwardTarget,
  } = options;

  const isTerminalOwnedBySender = (
    event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent,
    id: string
  ): boolean => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    const owned = windowTerminals.get(win.id);
    return !!(owned && owned.has(id));
  };

  registerHandlers({
    "terminal:create": (event, { cwd, profileId, sshHostId }: { cwd?: string; profileId?: string; sshHostId?: string }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      let cols = 80;
      let rows = 24;
      if (win) {
        try {
          const config = getConfig();
          const fontSize = config.fontSize || 13;
          const size = win.getSize();
          const width = size[0] ?? 1000;
          const height = size[1] ?? 800;

          const charWidth = Math.max(5, fontSize * 0.6);
          const charHeight = Math.max(10, fontSize * 1.35);

          const sidebarWidth = config.sidebarOpen ? (config.sidebarWidth || 250) : 0;
          const usableWidth = width - sidebarWidth - 40;
          const usableHeight = height - 100;

          cols = Math.max(40, Math.floor(usableWidth / charWidth));
          rows = Math.max(10, Math.floor(usableHeight / charHeight));
        } catch (e) {
          console.warn("Failed to calculate initial terminal cols/rows, using fallback:", e);
        }
      }

      const id = createTerminal({
        cwd: cwd || process.cwd(),
        profileId,
        sshHostId,
        cols,
        rows,
      });

      if (win) {
        registerForwardTarget(id, win);
        if (!windowTerminals.has(win.id)) {
          windowTerminals.set(win.id, new Set());
        }
        windowTerminals.get(win.id)!.add(id);
      }
      return { id };
    },
    "terminal:enable-forwarding": (event, { id }: { id: string }) => {
      if (!isTerminalOwnedBySender(event, id)) {
        console.warn(`Blocked unauthorized terminal:enable-forwarding attempt for terminal ${id}`);
        return;
      }
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        registerForwardTarget(id, win);
      }
    },
    "terminal:resize": (event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
      if (!isTerminalOwnedBySender(event, id)) {
        console.warn(`Blocked unauthorized terminal:resize attempt for terminal ${id}`);
        return;
      }
      resizeTerminal(id, cols, rows);
    },
    "terminal:destroy": (event, { id }: { id: string }) => {
      if (!isTerminalOwnedBySender(event, id)) {
        console.warn(`Blocked unauthorized terminal:destroy attempt for terminal ${id}`);
        return;
      }
      destroyTerminal(id);
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && windowTerminals.has(win.id)) {
        windowTerminals.get(win.id)!.delete(id);
      }
    },
    "terminal:get-history": (event, { id }: { id: string }) => {
      if (!isTerminalOwnedBySender(event, id)) {
        console.warn(`Blocked unauthorized terminal:get-history attempt for terminal ${id}`);
        return [];
      }
      return getHistory(id);
    },
    "terminal:detach-tab": (event, { tabId, terminalIds }: { tabId: string; terminalIds: string[] }) => {
      const senderWin = BrowserWindow.fromWebContents(event.sender);
      if (!senderWin) return { success: false };

      for (const terminalId of terminalIds) {
        if (!isTerminalOwnedBySender(event, terminalId)) {
          console.warn(`Blocked unauthorized terminal:detach-tab attempt for terminal ${terminalId}`);
          return { success: false };
        }
      }

      const detachedWin = createWindow();

      const params = new URLSearchParams();
      params.set("detached", tabId);
      params.set("terminals", terminalIds.join(","));
      loadWindow(detachedWin, params.toString());

      if (!windowTerminals.has(detachedWin.id)) {
        windowTerminals.set(detachedWin.id, new Set());
      }

      for (const terminalId of terminalIds) {
        registerForwardTarget(terminalId, detachedWin);
        windowTerminals.get(detachedWin.id)!.add(terminalId);
        if (senderWin && windowTerminals.has(senderWin.id)) {
          windowTerminals.get(senderWin.id)!.delete(terminalId);
        }
      }

      return { success: true };
    },
    "terminal:reattach-tab": (event, { terminalIds }: { terminalIds: string[] }) => {
      const senderWin = BrowserWindow.fromWebContents(event.sender);
      if (!senderWin) return { success: false };

      for (const terminalId of terminalIds) {
        if (!isTerminalOwnedBySender(event, terminalId)) {
          console.warn(`Blocked unauthorized terminal:reattach-tab attempt for terminal ${terminalId}`);
          return { success: false };
        }
      }

      const mainWindow = getMainWindow();
      if (mainWindow) {
        if (!windowTerminals.has(mainWindow.id)) {
          windowTerminals.set(mainWindow.id, new Set());
        }
        for (const terminalId of terminalIds) {
          registerForwardTarget(terminalId, mainWindow);
          windowTerminals.get(mainWindow.id)!.add(terminalId);
        }
      }

      if (senderWin && windowTerminals.has(senderWin.id)) {
        for (const terminalId of terminalIds) {
          windowTerminals.get(senderWin.id)!.delete(terminalId);
        }
      }
      senderWin?.close();

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("terminal:reattach-tab", { terminalIds });
      }

      return { success: true };
    },
    "terminal:get-info": async (event, { id }: { id: string }) => {
      if (!isTerminalOwnedBySender(event, id)) {
        console.warn(`Blocked unauthorized terminal:get-info attempt for terminal ${id}`);
        return null;
      }
      return await getTerminalInfo(id);
    },
    "terminal:set-foreground": (_event, { ids }: { ids: string[] }) => {
      // Allow setting foreground without strict single ownership check as it's an array of IDs
      // but let's filter to only verify sender owns them if we want maximum security.
      // Since it's only used for rendering optimization, we keep it as is.
      setForegroundTerminals(ids);
    },
  });

  ipcMain.on(
    "terminal:write",
    (event, { id, data }: { id: string; data: string }) => {
      if (!isTerminalOwnedBySender(event, id)) {
        console.warn(`Blocked unauthorized terminal:write attempt for terminal ${id}`);
        return;
      }
      writeToTerminal(id, data);
    },
  );
}
