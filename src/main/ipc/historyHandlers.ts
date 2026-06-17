import { ipcMain } from "electron";
import * as historyDb from "../historyDb";

/**
 * Registers session history database IPC handlers.
 */
export function registerHistoryHandlers() {
  ipcMain.handle("history:search", async (_event, query: string) => {
    return historyDb.searchHistory(query);
  });

  ipcMain.handle("history:get-sessions", async () => {
    return historyDb.getHistorySessions();
  });

  ipcMain.handle(
    "history:get-session-transcript",
    async (_event, id: string) => {
      return historyDb.getSessionTranscript(id);
    },
  );

  ipcMain.handle(
    "history:get-scrollback-chunk",
    async (_event, id: string, beforeTimestamp: number) => {
      return historyDb.getScrollbackChunk(id, beforeTimestamp);
    },
  );

  ipcMain.handle("history:clear", async () => {
    historyDb.clearHistory();
  });

  ipcMain.handle("history:delete-session", async (_event, id: string) => {
    historyDb.deleteSession(id);
  });

  ipcMain.handle(
    "history:add-browser-visit",
    async (_event, url: string, title: string) => {
      historyDb.addBrowserVisit(url, title);
    },
  );

  ipcMain.handle("history:get-browser-history", async () => {
    return historyDb.getBrowserHistory();
  });

  ipcMain.handle(
    "history:search-browser-history",
    async (_event, query: string) => {
      return historyDb.searchBrowserHistory(query);
    },
  );

  ipcMain.handle("history:delete-browser-visit", async (_event, id: number) => {
    historyDb.deleteBrowserVisit(id);
  });

  ipcMain.handle("history:clear-browser-history", async () => {
    historyDb.clearBrowserHistory();
  });
}
