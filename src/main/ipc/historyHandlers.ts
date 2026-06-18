import { registerHandlers } from "./ipcUtils";
import * as historyDb from "../historyDb";

/**
 * Registers session history database IPC handlers.
 */
export function registerHistoryHandlers() {
  registerHandlers({
    "history:search": (_event, query: string) => {
      return historyDb.searchHistory(query);
    },
    "history:get-sessions": () => {
      return historyDb.getHistorySessions();
    },
    "history:get-session-transcript": (_event, id: string) => {
      return historyDb.getSessionTranscript(id);
    },
    "history:get-scrollback-chunk": (
      _event,
      id: string,
      beforeTimestamp: number,
    ) => {
      return historyDb.getScrollbackChunk(id, beforeTimestamp);
    },
    "history:clear": () => {
      historyDb.clearHistory();
    },
    "history:delete-session": (_event, id: string) => {
      historyDb.deleteSession(id);
    },
    "history:add-browser-visit": (_event, url: string, title: string) => {
      historyDb.addBrowserVisit(url, title);
    },
    "history:get-browser-history": () => {
      return historyDb.getBrowserHistory();
    },
    "history:search-browser-history": (_event, query: string) => {
      return historyDb.searchBrowserHistory(query);
    },
    "history:delete-browser-visit": (_event, id: number) => {
      historyDb.deleteBrowserVisit(id);
    },
    "history:clear-browser-history": () => {
      historyDb.clearBrowserHistory();
    },
    "history:get-db-error": () => {
      return historyDb.getDbInitError();
    },
  });
}
