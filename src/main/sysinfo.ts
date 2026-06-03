import si from 'systeminformation'
import { ipcMain, BrowserWindow } from 'electron'

let intervalId: NodeJS.Timeout | null = null

export function initSysInfoManager(mainWindow: BrowserWindow) {
  ipcMain.handle('sysinfo:start', () => {
    if (intervalId) clearInterval(intervalId)
    intervalId = setInterval(async () => {
      try {
        const cpu = await si.currentLoad()
        const mem = await si.mem()
        
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sysinfo:update', {
            cpu: cpu.currentLoad,
            mem: {
              total: mem.total,
              used: mem.active
            }
          })
        }
      } catch (err) {
        console.error('Failed to get sysinfo', err)
      }
    }, 2000)
  })

  ipcMain.handle('sysinfo:stop', () => {
    if (intervalId) clearInterval(intervalId)
    intervalId = null
  })
}
