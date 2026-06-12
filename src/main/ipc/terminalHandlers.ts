import { ipcMain, BrowserWindow } from 'electron'
import {
  createTerminal,
  destroyTerminal,
  writeToTerminal,
  resizeTerminal,
  getTerminalInfo,
  getHistory
} from '../pty'

interface TerminalHandlersOptions {
  windowTerminals: Map<number, Set<string>>
  getMainWindow: () => BrowserWindow | null
  createWindow: () => BrowserWindow
  loadWindow: (win: BrowserWindow, extraParams?: string) => void
  registerForwardTarget: (terminalId: string, window: BrowserWindow) => void
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
    registerForwardTarget
  } = options

  ipcMain.handle('terminal:create', async (event, { cwd, profileId, sshHostId }: { cwd?: string, profileId?: string, sshHostId?: string }) => {
    const id = createTerminal({
      cwd: cwd || process.cwd(),
      profileId,
      sshHostId
    })
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      registerForwardTarget(id, win)
      if (!windowTerminals.has(win.id)) {
        windowTerminals.set(win.id, new Set())
      }
      windowTerminals.get(win.id)!.add(id)
    }
    return { id }
  })

  ipcMain.handle('terminal:enable-forwarding', async (event, { id }: { id: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      registerForwardTarget(id, win)
    }
  })

  ipcMain.on('terminal:write', (_event, { id, data }: { id: string; data: string }) => {
    writeToTerminal(id, data)
  })

  ipcMain.handle('terminal:resize', async (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    resizeTerminal(id, cols, rows)
  })

  ipcMain.handle('terminal:destroy', async (event, { id }: { id: string }) => {
    destroyTerminal(id)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && windowTerminals.has(win.id)) {
      windowTerminals.get(win.id)!.delete(id)
    }
  })

  ipcMain.handle('terminal:get-history', async (_event, { id }: { id: string }) => {
    return getHistory(id)
  })

  ipcMain.handle('terminal:detach-tab', async (event, { tabId, terminalIds }: { tabId: string; terminalIds: string[] }) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender)
    const detachedWin = createWindow()

    const params = new URLSearchParams()
    params.set('detached', tabId)
    params.set('terminals', terminalIds.join(','))
    loadWindow(detachedWin, params.toString())

    if (!windowTerminals.has(detachedWin.id)) {
      windowTerminals.set(detachedWin.id, new Set())
    }

    for (const terminalId of terminalIds) {
      registerForwardTarget(terminalId, detachedWin)
      windowTerminals.get(detachedWin.id)!.add(terminalId)
      if (senderWin && windowTerminals.has(senderWin.id)) {
        windowTerminals.get(senderWin.id)!.delete(terminalId)
      }
    }

    return { success: true }
  })

  ipcMain.handle('terminal:reattach-tab', async (event, { terminalIds }: { terminalIds: string[] }) => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      if (!windowTerminals.has(mainWindow.id)) {
        windowTerminals.set(mainWindow.id, new Set())
      }
      for (const terminalId of terminalIds) {
        registerForwardTarget(terminalId, mainWindow)
        windowTerminals.get(mainWindow.id)!.add(terminalId)
      }
    }

    const senderWin = BrowserWindow.fromWebContents(event.sender)
    if (senderWin && windowTerminals.has(senderWin.id)) {
      for (const terminalId of terminalIds) {
        windowTerminals.get(senderWin.id)!.delete(terminalId)
      }
    }
    senderWin?.close()

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:reattach-tab', { terminalIds })
    }

    return { success: true }
  })

  ipcMain.handle('terminal:get-info', async (_event, { id }: { id: string }) => {
    return await getTerminalInfo(id)
  })
}
