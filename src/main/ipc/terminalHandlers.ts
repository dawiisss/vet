import { BrowserWindow, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { registerHandlers, isTrustedSender } from "./ipcUtils";
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

function getTransferredTerminalIds(root: unknown): string[] {
  if (!root || typeof root !== "object") return [];
  const node = root as { terminalId?: unknown; children?: unknown };
  const ids = typeof node.terminalId === "string" ? [node.terminalId] : [];
  if (Array.isArray(node.children)) {
    for (const child of node.children) ids.push(...getTransferredTerminalIds(child));
  }
  return ids;
}

function transferMatchesTerminalIds(root: unknown, terminalIds: string[]): boolean {
  const expected = getTransferredTerminalIds(root).sort();
  const supplied = [...terminalIds].sort();
  return expected.length === supplied.length && expected.every((id, index) => id === supplied[index]);
}

function validTransfer(tab: TabTransferState): boolean {
  return !!tab && typeof tab.label === "string" && !!tab.root &&
    Array.isArray(tab.focusedPath) && Array.isArray(tab.editorDocuments) &&
    tab.editorDocuments.every((document) => !!document &&
      typeof document.editorId === "string" && typeof document.filePath === "string" &&
      (document.sshHostId == null || typeof document.sshHostId === "string") &&
      typeof document.content === "string" && typeof document.isDirty === "boolean");
}

interface PendingTabTransfer {
  source: BrowserWindow;
  destination: BrowserWindow;
  terminalIds: string[];
  tab: TabTransferState;
  finish: (success: boolean) => void;
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
  const pendingTransfers = new Map<string, PendingTabTransfer>();

  // The source keeps its panes and PTY ownership until the destination has
  // hydrated the editor buffers and acknowledges the transfer over IPC.
  const beginTransfer = (
    source: BrowserWindow,
    destination: BrowserWindow,
    terminalIds: string[],
    tab: TabTransferState,
    reattaching: boolean,
    notify: (transferId: string) => void,
  ): Promise<{ success: boolean }> => new Promise((resolve) => {
    const transferId = randomUUID();
    const onClosed = () => finish(false);
    const timer = setTimeout(() => finish(false), 30000);
    const finish = (success: boolean) => {
      if (!pendingTransfers.delete(transferId)) return;
      clearTimeout(timer);
      source.removeListener("closed", onClosed);
      destination.removeListener("closed", onClosed);
      if (!success && !reattaching && !destination.isDestroyed()) destination.destroy();
      resolve({ success });
    };
    pendingTransfers.set(transferId, { source, destination, terminalIds, tab, finish });
    source.once("closed", onClosed);
    destination.once("closed", onClosed);
    try {
      notify(transferId);
    } catch {
      finish(false);
    }
  });

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
      if (!isTrustedSender(event)) {
        console.warn("[security] Blocked terminal:create from untrusted sender");
        return { error: "Access denied" };
      }
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) {
        return { error: "Access denied" };
      }
      if (cwd !== undefined && (typeof cwd !== "string" || cwd.length > 4096)) {
        return { error: "Invalid cwd" };
      }
      if (profileId !== undefined && (typeof profileId !== "string" || profileId.length > 256)) {
        return { error: "Invalid profileId" };
      }
      if (sshHostId !== undefined && (typeof sshHostId !== "string" || sshHostId.length > 256)) {
        return { error: "Invalid sshHostId" };
      }
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
        cwd,
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
    "terminal:detach-tab": (event, { tabId, terminalIds, tab }: {
      tabId: string;
      terminalIds: string[];
      tab: TabTransferState;
    }) => {
      const senderWin = BrowserWindow.fromWebContents(event.sender);
      if (!senderWin || !Array.isArray(terminalIds) || terminalIds.some((id) => typeof id !== "string") || !validTransfer(tab) || !transferMatchesTerminalIds(tab.root, terminalIds)) return { success: false };
      if ([...pendingTransfers.values()].some((pending) => pending.source === senderWin)) return { success: false };

      for (const terminalId of terminalIds) {
        if (!isTerminalOwnedBySender(event, terminalId)) {
          console.warn(`Blocked unauthorized terminal:detach-tab attempt for terminal ${terminalId}`);
          return { success: false };
        }
      }

      const detachedWin = createWindow();

      return beginTransfer(senderWin, detachedWin, terminalIds, tab, false, (transferId) => {
        const params = new URLSearchParams();
        params.set("detached", tabId);
        params.set("terminals", terminalIds.join(","));
        params.set("transfer", transferId);
        loadWindow(detachedWin, params.toString());
      });
    },
    "terminal:reattach-tab": (event, { terminalIds, tab }: {
      terminalIds: string[];
      tab: TabTransferState;
    }) => {
      const senderWin = BrowserWindow.fromWebContents(event.sender);
      if (!senderWin || !Array.isArray(terminalIds) || terminalIds.some((id) => typeof id !== "string") || !validTransfer(tab) || !transferMatchesTerminalIds(tab.root, terminalIds)) return { success: false };
      if ([...pendingTransfers.values()].some((pending) => pending.source === senderWin)) return { success: false };

      for (const terminalId of terminalIds) {
        if (!isTerminalOwnedBySender(event, terminalId)) {
          console.warn(`Blocked unauthorized terminal:reattach-tab attempt for terminal ${terminalId}`);
          return { success: false };
        }
      }

      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed() || mainWindow === senderWin) return { success: false };
      return beginTransfer(senderWin, mainWindow, terminalIds, tab, true, (transferId) => {
        mainWindow.webContents.send("terminal:reattach-tab", { transferId });
      });
    },
    "terminal:get-tab-transfer": (event, { transferId }: { transferId: string }) => {
      const transfer = pendingTransfers.get(transferId);
      const win = BrowserWindow.fromWebContents(event.sender);
      return transfer && transfer.destination === win ? transfer.tab : null;
    },
    "terminal:complete-tab-transfer": (event, { transferId }: { transferId: string }) => {
      const transfer = pendingTransfers.get(transferId);
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!transfer || transfer.destination !== win) return { success: false };
      const { source, destination, terminalIds } = transfer;
      if (source.isDestroyed() || destination.isDestroyed() ||
          terminalIds.some((id) => !windowTerminals.get(source.id)?.has(id))) {
        transfer.finish(false);
        return { success: false };
      }
      if (!windowTerminals.has(destination.id)) windowTerminals.set(destination.id, new Set());
      for (const id of terminalIds) {
        registerForwardTarget(id, destination);
        windowTerminals.get(destination.id)!.add(id);
        windowTerminals.get(source.id)?.delete(id);
      }
      transfer.finish(true);
      // The source renderer removes the moved tab and closes itself only if
      // no other tabs remain. Closing here would discard those other tabs.
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
