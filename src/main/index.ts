import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import {
  createTerminal,
  destroyTerminal,
  writeToTerminal,
  resizeTerminal,
  setForwardTarget,
  getTerminalInfo,
  getHistory
} from './pty'

import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null
const windowTerminals = new Map<number, Set<string>>()

function registerForwardTarget(terminalId: string, window: BrowserWindow): void {
  setForwardTarget(terminalId, (event: string, ...args: unknown[]) => {
    if (!window.isDestroyed()) {
      window.webContents.send(event, ...args)
    }
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 400,
    minHeight: 300,
    title: 'Vet',
    ...(process.platform === 'linux' ? { icon } : { icon }),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('closed', () => {
    const terminals = windowTerminals.get(win.id)
    if (terminals) {
      for (const tId of terminals) {
        destroyTerminal(tId)
      }
      windowTerminals.delete(win.id)
    }

    if (win === mainWindow) {
      mainWindow = null
    }
  })

  win.on('maximize', () => {
    win.webContents.send('win:maximize-change', true)
  })

  win.on('unmaximize', () => {
    win.webContents.send('win:maximize-change', false)
  })

  win.webContents.on('console-message', (_event, level, message) => {
    const prefix = ['VERB', 'INFO', 'WARN', 'ERR'][level] ?? 'LOG'
    console.log(`[renderer ${prefix}] ${message}`)
  })

  // Security: Block unauthorized new window creation
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url)
      const safeProtocols = ['http:', 'https:', 'mailto:']
      if (safeProtocols.includes(parsedUrl.protocol)) {
        shell.openExternal(url)
      } else {
        console.warn(`[security] Blocked attempt to open new window with unsafe URL: ${url}`)
      }
    } catch (e) {
      console.warn(`[security] Blocked attempt to open new window with invalid URL: ${url}`)
    }
    return { action: 'deny' }
  })

  // Security: Block unauthorized navigation
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const parsedUrl = new URL(url)
      // Allow local file navigation in dev or to our specific index.html
      if (parsedUrl.protocol === 'file:' || (is.dev && parsedUrl.hostname === 'localhost')) {
         return
      }

      console.warn(`[security] Blocked unauthorized navigation to: ${url}`)
      event.preventDefault()
    } catch (e) {
      console.warn(`[security] Blocked unauthorized navigation to invalid URL: ${url}`)
      event.preventDefault()
    }
  })

  return win
}

function loadWindow(win: BrowserWindow, extraParams?: string): void {
  let baseUrl: string
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    baseUrl = process.env['ELECTRON_RENDERER_URL']
  } else {
    baseUrl = `file://${join(__dirname, '../renderer/index.html')}`
  }

  const url = extraParams ? `${baseUrl}?${extraParams}` : baseUrl
  win.loadURL(url)
}

function registerIpcHandlers(): void {
  // Window control
  ipcMain.handle('win:minimize', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.handle('win:maximize', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.handle('win:toggle-fullscreen', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.setFullScreen(!win.isFullScreen())
    }
  })

  ipcMain.handle('win:close', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.handle('app:quit', () => {
    app.quit()
  })

  ipcMain.handle('win:is-maximized', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  ipcMain.handle('win:open-external', async (_event, url: string) => {
    try {
      const parsedUrl = new URL(url)
      const safeProtocols = ['http:', 'https:', 'mailto:']
      if (safeProtocols.includes(parsedUrl.protocol)) {
        await shell.openExternal(url)
      } else {
        console.warn(`[security] Blocked attempt to open external URL with unsafe protocol: ${url}`)
      }
    } catch (e) {
      console.warn(`[security] Blocked attempt to open invalid external URL: ${url}`)
    }
  })

  // Terminal
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

    detachedWin.webContents.once('did-finish-load', () => {
    })

    return { success: true }
  })

  ipcMain.handle('terminal:reattach-tab', async (event, { terminalIds }: { terminalIds: string[] }) => {
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

import { initConfigManager, getConfig } from './config'
import { initSessionManager, getSessionData } from './session'
import { initSysInfoManager } from './sysinfo'
import { initPortsManager } from './ports'
import { initWorkspaceManager } from './workspace'
import { initConnectionsManager } from './connections'
import { initSftpManager } from './sftp'
import * as historyDb from './historyDb'

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.vet')

  registerIpcHandlers()
  mainWindow = createWindow()
  
  await initConfigManager(mainWindow)
  const config = getConfig()
  if (config.vibrancy && config.vibrancy !== 'none') {
    mainWindow.setVibrancy(config.vibrancy)
  }
  
  initSessionManager()
  initSysInfoManager(mainWindow)
  initPortsManager()
  initWorkspaceManager()
  initConnectionsManager()
  initSftpManager()
  historyDb.initHistoryDb()

  loadWindow(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      const conf = getConfig()
      if (conf.vibrancy && conf.vibrancy !== 'none') {
        mainWindow.setVibrancy(conf.vibrancy)
      }
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
