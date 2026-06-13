import { ipcMain } from 'electron'
import * as historyDb from '../historyDb'

/**
 * Registers session history database IPC handlers.
 */
export function registerHistoryHandlers() {
  ipcMain.handle('history:search', async (_event, query: string) => {
    return historyDb.searchHistory(query)
  })
  
  ipcMain.handle('history:get-sessions', async () => {
    return historyDb.getHistorySessions()
  })

  ipcMain.handle('history:get-session-transcript', async (_event, id: string) => {
    return historyDb.getSessionTranscript(id)
  })

  ipcMain.handle('history:get-scrollback-chunk', async (_event, id: string, beforeTimestamp: number) => {
    return historyDb.getScrollbackChunk(id, beforeTimestamp)
  })

  ipcMain.handle('history:clear', async () => {
    historyDb.clearHistory()
  })

  ipcMain.handle('history:delete-session', async (_event, id: string) => {
    historyDb.deleteSession(id)
  })
}
