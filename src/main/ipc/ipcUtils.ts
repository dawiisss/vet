import { ipcMain, BrowserWindow } from "electron";

/**
 * True only when the IPC sender is a real app window's webContents.
 * Webview guest pages (browser tabs) and other untrusted senders fail this
 * check because BrowserWindow.fromWebContents returns null for them.
 */
export function isTrustedSender(event?: {
  sender?: Electron.WebContents;
}): boolean {
  if (typeof BrowserWindow?.fromWebContents !== "function") {
    return false;
  }
  if (!event || !event.sender) {
    try {
      return (
        BrowserWindow.fromWebContents(
          undefined as unknown as Electron.WebContents,
        ) !== null
      );
    } catch {
      return false;
    }
  }
  return BrowserWindow.fromWebContents(event.sender) !== null;
}

/**
 * Registers a map of IPC handlers dynamically, wrapping each execution
 * in a try/catch block for centralized error monitoring and propagation.
 */
export function registerHandlers(
  handlers: Record<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown
  >,
): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!isTrustedSender(event)) {
        console.warn(`[security] Blocked IPC "${channel}" from untrusted sender`);
        throw new Error("Access denied");
      }
      try {
        return await handler(event, ...args);
      } catch (err: unknown) {
        console.error(`Error in IPC handler for "${channel}":`, err);
        throw err;
      }
    });
  }
}
