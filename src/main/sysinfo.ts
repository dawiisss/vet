import si from "systeminformation";
import { ipcMain, BrowserWindow } from "electron";
import os from "os";

let timeoutId: NodeJS.Timeout | null = null;
let running = false;

function scheduleNext(mainWindow: BrowserWindow) {
  if (!running) return;
  timeoutId = setTimeout(async () => {
    try {
      const [cpu, mem, disks, temp, net, battery, graphics, fsStats] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.cpuTemperature(),
        si.networkStats(),
        si.battery(),
        si.graphics(),
        si.fsStats(),
      ]);

      const seenDevices = new Set<string>();
      const disksList = Array.isArray(disks)
        ? disks
            .filter((d) => {
              if (!d.fs || typeof d.fs !== "string") return false;
              const isPhysical =
                d.fs.startsWith("/dev/") ||
                (process.platform === "win32" && (d.fs.includes(":") || d.fs.startsWith("\\\\")));
              if (!isPhysical) return false;
              if (seenDevices.has(d.fs)) return false;
              seenDevices.add(d.fs);
              return true;
            })
            .map((d) => ({
              mount: d.mount,
              total: d.size,
              used: d.used,
              use: d.use,
            }))
        : [];

      const mainDisk = Array.isArray(disks)
        ? disks.find((d) => d.mount === "/" || d.mount === "C:") || disks[0]
        : null;
      const diskInfo = mainDisk
        ? {
            total: mainDisk.size,
            used: mainDisk.used,
            use: mainDisk.use,
          }
        : null;

      const load = os.loadavg();
      const uptime = os.uptime();

      let rx_sec = 0;
      let tx_sec = 0;
      if (Array.isArray(net)) {
        for (const iface of net) {
          if (iface.operstate === "up") {
            if (typeof iface.rx_sec === "number" && iface.rx_sec > 0) {
              rx_sec += iface.rx_sec;
            }
            if (typeof iface.tx_sec === "number" && iface.tx_sec > 0) {
              tx_sec += iface.tx_sec;
            }
          }
        }
      }
      const networkInfo = { rx_sec, tx_sec };

      const batteryInfo = battery && battery.hasBattery
        ? {
            hasBattery: true,
            percent: battery.percent,
            isCharging: battery.isCharging,
            acConnected: battery.acConnected,
          }
        : {
            hasBattery: false,
            percent: 0,
            isCharging: false,
            acConnected: true,
          };

      const graphicsInfo = graphics && Array.isArray(graphics.controllers)
        ? {
            controllers: graphics.controllers.map((c) => ({
              model: c.model || "Unknown GPU",
              vram: c.vram || c.memoryTotal || 0,
              memoryTotal: c.memoryTotal || 0,
              memoryUsed: c.memoryUsed || 0,
              temperatureGpu: c.temperatureGpu ?? null,
              utilizationGpu: c.utilizationGpu ?? null,
            })),
          }
        : null;

      const diskIoInfo = fsStats
        ? {
            rx_sec: typeof fsStats.rx_sec === "number" && fsStats.rx_sec > 0 ? fsStats.rx_sec : 0,
            wx_sec: typeof fsStats.wx_sec === "number" && fsStats.wx_sec > 0 ? fsStats.wx_sec : 0,
          }
        : null;

      const appCpu = process.getCPUUsage().percentCPUUsage;
      const appMem = process.memoryUsage().rss;
      const appResources = { cpu: appCpu, mem: appMem };

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("sysinfo:update", {
          cpu: cpu.currentLoad,
          mem: {
            total: mem.total,
            used: mem.active,
          },
          disk: diskInfo,
          disks: disksList,
          uptime,
          load,
          temp: temp && temp.main > 0 ? temp.main : null,
          network: networkInfo,
          battery: batteryInfo,
          graphics: graphicsInfo,
          diskIo: diskIoInfo,
          appResources,
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

export function cleanupSysInfo() {
  running = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}
