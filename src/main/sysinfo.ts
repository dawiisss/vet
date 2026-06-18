import si from "systeminformation";
import { ipcMain, BrowserWindow } from "electron";

let timeoutId: NodeJS.Timeout | null = null;
let running = false;

function scheduleNext(mainWindow: BrowserWindow) {
  if (!running) return;
  timeoutId = setTimeout(async () => {
    try {
      const cpu = await si.currentLoad();
      const mem = await si.mem();

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("sysinfo:update", {
          cpu: cpu.currentLoad,
          mem: {
            total: mem.total,
            used: mem.active,
          },
        });
      }
    } catch (err) {
      console.error("Failed to get sysinfo", err);
    }
    scheduleNext(mainWindow);
  }, 2000);
}

export function initSysInfoManager(mainWindow: BrowserWindow) {
  ipcMain.handle("sysinfo:start", () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    running = true;
    scheduleNext(mainWindow);
  });

  ipcMain.handle("sysinfo:stop", () => {
    running = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  });
}
