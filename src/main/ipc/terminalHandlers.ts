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

  registerHandlers({
    "terminal:create": (event, { cwd, profileId, sshHostId }: { cwd?: string; profileId?: string; sshHostId?: string }) => {
      const id = createTerminal({
        cwd: cwd || process.cwd(),
        profileId,
        sshHostId,
      });
      const win = BrowserWindow.fromWebContents(event.sender);
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
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        registerForwardTarget(id, win);
      }
    },
    "terminal:resize": (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
      resizeTerminal(id, cols, rows);
    },
    "terminal:destroy": (event, { id }: { id: string }) => {
      destroyTerminal(id);
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && windowTerminals.has(win.id)) {
        windowTerminals.get(win.id)!.delete(id);
      }
    },
    "terminal:get-history": (_event, { id }: { id: string }) => {
      return getHistory(id);
    },
    "terminal:detach-tab": (event, { tabId, terminalIds }: { tabId: string; terminalIds: string[] }) => {
      const senderWin = BrowserWindow.fromWebContents(event.sender);
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

      const senderWin = BrowserWindow.fromWebContents(event.sender);
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
    "terminal:get-info": async (_event, { id }: { id: string }) => {
      return await getTerminalInfo(id);
    },
    "terminal:set-foreground": (_event, { ids }: { ids: string[] }) => {
      setForegroundTerminals(ids);
    },
  });

  ipcMain.on(
    "terminal:write",
    (_event, { id, data }: { id: string; data: string }) => {
      writeToTerminal(id, data);
    },
  );
}
