import { ipcMain, BrowserWindow, shell, app } from 'electron'

/**
 * Registers window control and app lifecycle IPC handlers.
 */
export function registerWindowHandlers() {
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

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
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
}
