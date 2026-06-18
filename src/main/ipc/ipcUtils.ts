import { ipcMain } from "electron";

/**
 * Registers a map of IPC handlers dynamically, wrapping each execution
 * in a try/catch block for centralized error monitoring and propagation.
 */
export function registerHandlers(
  handlers: Record<
    string,
    (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any
  >,
): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (err: any) {
        console.error(`Error in IPC handler for "${channel}":`, err);
        throw err;
      }
    });
  }
}
