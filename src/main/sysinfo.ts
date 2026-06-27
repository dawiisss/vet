import { app, ipcMain, BrowserWindow } from "electron";
import { readFile, readdir, statfs, access } from "fs/promises";
import os from "os";
import { constants } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { getPtyPids } from "./pty";

const execFileAsync = promisify(execFile);

let timeoutId: NodeJS.Timeout | null = null;
let running = false;
let lastDisks: any = null;
let lastBattery: any = null;
let lastGraphics: any = null;
let slowPollCounter = 0;

// CPU Load Calculation State
let prevCpuTicks: { idle: number; total: number } | null = null;

function getCpuLoad(): number {
  const cpus = os.cpus();
  let totalMs = 0;
  let idleMs = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalMs += cpu.times[type as keyof typeof cpu.times];
    }
    idleMs += cpu.times.idle;
  }

  if (!prevCpuTicks) {
    prevCpuTicks = { idle: idleMs, total: totalMs };
    return 0;
  }

  const deltaIdle = idleMs - prevCpuTicks.idle;
  const deltaTotal = totalMs - prevCpuTicks.total;
  prevCpuTicks = { idle: idleMs, total: totalMs };

  if (deltaTotal === 0) return 0;
  const percentage = (1 - deltaIdle / deltaTotal) * 100;
  return Math.min(100, Math.max(0, percentage));
}

// Disk Partitions
interface MountInfo {
  device: string;
  mount: string;
}

async function getMounts(): Promise<MountInfo[]> {
  if (process.platform === "linux") {
    try {
      const content = await readFile("/proc/mounts", "utf-8");
      const lines = content.split("\n");
      const mounts: MountInfo[] = [];
      const seenDevices = new Set<string>();
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const device = parts[0];
          const mount = parts[1];
          if (device.startsWith("/dev/")) {
            if (!seenDevices.has(device)) {
              seenDevices.add(device);
              mounts.push({ device, mount });
            }
          }
        }
      }
      return mounts;
    } catch {
      return [{ device: "/dev/root", mount: "/" }];
    }
  } else if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("/bin/df", ["-P"]);
      const lines = stdout.split("\n");
      const mounts: MountInfo[] = [];
      const seenDevices = new Set<string>();
      for (const line of lines.slice(1)) {
        const parts = line.split(/\s+/);
        if (parts.length >= 6) {
          const device = parts[0];
          const mount = parts[5];
          if (device.startsWith("/dev/") && mount) {
            if (!seenDevices.has(device)) {
              seenDevices.add(device);
              mounts.push({ device, mount });
            }
          }
        }
      }
      return mounts;
    } catch {
      return [{ device: "/dev/disk1s1s1", mount: "/" }];
    }
  } else if (process.platform === "win32") {
    const mounts: MountInfo[] = [];
    for (let charCode = 67; charCode <= 90; charCode++) {
      const drive = String.fromCharCode(charCode) + ":";
      try {
        await access(drive + "\\", constants.R_OK);
        mounts.push({ device: drive, mount: drive });
      } catch {
        // Drive not accessible
      }
    }
    return mounts;
  }
  return [{ device: "/dev/root", mount: "/" }];
}

interface DiskInfo {
  mount: string;
  total: number;
  used: number;
  use: number;
}

async function getDisksList(): Promise<DiskInfo[]> {
  const mounts = await getMounts();
  const list: DiskInfo[] = [];
  for (const m of mounts) {
    try {
      const stats = await statfs(m.mount);
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;
      const use = total > 0 ? (used / total) * 100 : 0;
      list.push({
        mount: m.mount,
        total,
        used,
        use,
      });
    } catch {
      // Ignore un-statable disks
    }
  }
  return list;
}

// CPU Temperature
async function getCpuTemp(): Promise<number | null> {
  if (process.platform === "linux") {
    try {
      const rawTemp = await readFile("/sys/class/thermal/thermal_zone0/temp", "utf-8");
      return parseInt(rawTemp.trim(), 10) / 1000;
    } catch {
      try {
        const rawTemp = await readFile("/sys/class/thermal/thermal_zone1/temp", "utf-8");
        return parseInt(rawTemp.trim(), 10) / 1000;
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Network Stats
interface NetDevBytes {
  rx: number;
  tx: number;
  timestamp: number;
}
let prevNetBytes: NetDevBytes | null = null;

async function getNetworkStats(): Promise<{ rx_sec: number; tx_sec: number }> {
  if (process.platform === "linux") {
    try {
      const content = await readFile("/proc/net/dev", "utf-8");
      const lines = content.split("\n");
      let totalRx = 0;
      let totalTx = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.includes("|") || trimmed.startsWith("Inter-")) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 10) {
          const iface = parts[0].replace(":", "");
          if (iface === "lo") continue;
          const rx = parseInt(parts[1], 10);
          const tx = parseInt(parts[9], 10);
          if (!isNaN(rx)) totalRx += rx;
          if (!isNaN(tx)) totalTx += tx;
        }
      }

      const now = Date.now();
      if (!prevNetBytes) {
        prevNetBytes = { rx: totalRx, tx: totalTx, timestamp: now };
        return { rx_sec: 0, tx_sec: 0 };
      }

      const elapsedSec = (now - prevNetBytes.timestamp) / 1000;
      if (elapsedSec <= 0) return { rx_sec: 0, tx_sec: 0 };

      const rxRate = Math.max(0, (totalRx - prevNetBytes.rx) / elapsedSec);
      const txRate = Math.max(0, (totalTx - prevNetBytes.tx) / elapsedSec);

      prevNetBytes = { rx: totalRx, tx: totalTx, timestamp: now };
      return { rx_sec: rxRate, tx_sec: txRate };
    } catch {
      return { rx_sec: 0, tx_sec: 0 };
    }
  }
  return { rx_sec: 0, tx_sec: 0 };
}

// Battery Info
async function getBatteryInfo(): Promise<{ hasBattery: boolean; percent: number; isCharging: boolean; acConnected: boolean }> {
  if (process.platform === "linux") {
    try {
      const files = await readdir("/sys/class/power_supply/");
      const batDir = files.find(f => f.startsWith("BAT"));
      const acDir = files.find(f => f.startsWith("AC") || f.includes("ADP"));
      if (batDir) {
        const capStr = await readFile(`/sys/class/power_supply/${batDir}/capacity`, "utf-8");
        const statusStr = await readFile(`/sys/class/power_supply/${batDir}/status`, "utf-8");
        const percent = parseInt(capStr.trim(), 10);
        const status = statusStr.trim().toLowerCase();
        const isCharging = status === "charging";
        let acConnected = true;
        if (acDir) {
          try {
            const onlineStr = await readFile(`/sys/class/power_supply/${acDir}/online`, "utf-8");
            acConnected = onlineStr.trim() === "1";
          } catch {}
        } else {
          acConnected = status !== "discharging";
        }
        return {
          hasBattery: true,
          percent: isNaN(percent) ? 0 : percent,
          isCharging,
          acConnected,
        };
      }
    } catch {}
  }
  return {
    hasBattery: false,
    percent: 0,
    isCharging: false,
    acConnected: true,
  };
}

// GPU Info
interface GpuController {
  model: string;
  vram: number;
  memoryTotal: number;
  memoryUsed: number;
  temperatureGpu: number | null;
  utilizationGpu: number | null;
}

async function getGpuInfo(): Promise<{ controllers: GpuController[] } | null> {
  try {
    const { stdout } = await execFileAsync("nvidia-smi", [
      "--query-gpu=name,temperature.gpu,utilization.gpu,memory.total,memory.used",
      "--format=csv,noheader,nounits"
    ]);
    const line = stdout.trim();
    if (!line) return null;
    const parts = line.split(",").map(s => s.trim());
    if (parts.length >= 5) {
      const model = parts[0];
      const temperatureGpu = parseInt(parts[1], 10);
      const utilizationGpu = parseInt(parts[2], 10);
      const memoryTotal = parseInt(parts[3], 10);
      const memoryUsed = parseInt(parts[4], 10);
      return {
        controllers: [{
          model,
          vram: isNaN(memoryTotal) ? 0 : memoryTotal,
          memoryTotal: isNaN(memoryTotal) ? 0 : memoryTotal,
          memoryUsed: isNaN(memoryUsed) ? 0 : memoryUsed,
          temperatureGpu: isNaN(temperatureGpu) ? null : temperatureGpu,
          utilizationGpu: isNaN(utilizationGpu) ? null : utilizationGpu,
        }]
      };
    }
  } catch {
    // nvidia-smi failed or not installed
  }
  return null;
}

// Disk IO Stats
interface DiskIoBytes {
  read: number;
  write: number;
  timestamp: number;
}
let prevDiskIo: DiskIoBytes | null = null;

async function getDiskIoStats(): Promise<{ rx_sec: number; wx_sec: number } | null> {
  if (process.platform === "linux") {
    try {
      const content = await readFile("/proc/diskstats", "utf-8");
      const lines = content.split("\n");
      let totalReadSectors = 0;
      let totalWriteSectors = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 10) {
          const dev = parts[2];
          const isPhysicalDisk = (dev.startsWith("sd") && dev.length === 3) || (dev.startsWith("nvme") && !dev.includes("p"));
          if (isPhysicalDisk) {
            const rSectors = parseInt(parts[5], 10);
            const wSectors = parseInt(parts[9], 10);
            if (!isNaN(rSectors)) totalReadSectors += rSectors;
            if (!isNaN(wSectors)) totalWriteSectors += wSectors;
          }
        }
      }

      const now = Date.now();
      const totalReadBytes = totalReadSectors * 512;
      const totalWriteBytes = totalWriteSectors * 512;

      if (!prevDiskIo) {
        prevDiskIo = { read: totalReadBytes, write: totalWriteBytes, timestamp: now };
        return { rx_sec: 0, wx_sec: 0 };
      }

      const elapsedSec = (now - prevDiskIo.timestamp) / 1000;
      if (elapsedSec <= 0) return { rx_sec: 0, wx_sec: 0 };

      const rxRate = Math.max(0, (totalReadBytes - prevDiskIo.read) / elapsedSec);
      const wxRate = Math.max(0, (totalWriteBytes - prevDiskIo.write) / elapsedSec);

      prevDiskIo = { read: totalReadBytes, write: totalWriteBytes, timestamp: now };
      return { rx_sec: rxRate, wx_sec: wxRate };
    } catch {
      return null;
    }
  }
  return null;
}

function scheduleNext(mainWindow: BrowserWindow) {
  if (!running) return;
  timeoutId = setTimeout(async () => {
    try {
      const runSlowPoll = slowPollCounter % 5 === 0 || !lastDisks || !lastBattery || !lastGraphics;

      const promises: Promise<any>[] = [
        Promise.resolve(getCpuLoad()),
        getNetworkStats(),
        getDiskIoStats()
      ];

      if (runSlowPoll) {
        promises.push(getDisksList());
        promises.push(getBatteryInfo());
        promises.push(getGpuInfo());
      }

      const results = await Promise.all(promises);
      const cpuLoad = results[0];
      const networkInfo = results[1];
      const diskIoInfo = results[2];

      let newDisks = lastDisks;
      let newBattery = lastBattery;
      let newGraphics = lastGraphics;

      if (runSlowPoll) {
        newDisks = results[3];
        newBattery = results[4];
        newGraphics = results[5];
        lastDisks = newDisks;
        lastBattery = newBattery;
        lastGraphics = newGraphics;
      }

      slowPollCounter++;

      const disksList = newDisks || [];
      const mainDisk = disksList.find((d: DiskInfo) => d.mount === "/" || d.mount === "C:") || disksList[0] || null;
      const diskInfo = mainDisk
        ? {
            total: mainDisk.total,
            used: mainDisk.used,
            use: mainDisk.use,
          }
        : null;

      const load = os.loadavg();
      const uptime = os.uptime();
      const temp = await getCpuTemp();

      let totalMem = 0;
      const electronMetrics = app.getAppMetrics();
      for (const proc of electronMetrics) {
        totalMem += proc.memory?.workingSetSize || 0;
      }
      if (process.platform === "linux") {
        for (const pid of getPtyPids()) {
          try {
            const status = await readFile(`/proc/${pid}/status`, "utf-8");
            const match = status.match(/VmRSS:\s+(\d+)\s+kB/);
            if (match) totalMem += parseInt(match[1], 10) * 1024;
          } catch {
            // Process may have exited between listing and reading /proc/pid/status
          }
        }
      }
      const totalCpu = electronMetrics.reduce(
        (sum, proc) => sum + (proc.cpu?.percentCPUUsage || 0),
        0,
      );
      const appResources = { cpu: totalCpu, mem: totalMem };

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("sysinfo:update", {
          cpu: cpuLoad,
          mem: {
            total: os.totalmem(),
            used: os.totalmem() - os.freemem(),
          },
          disk: diskInfo,
          disks: disksList,
          uptime,
          load,
          temp,
          network: networkInfo,
          battery: newBattery,
          graphics: newGraphics,
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
    lastDisks = null;
    lastBattery = null;
    lastGraphics = null;
    slowPollCounter = 0;
    prevCpuTicks = null;
    prevNetBytes = null;
    prevDiskIo = null;
  });
}

export function cleanupSysInfo() {
  running = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  lastDisks = null;
  lastBattery = null;
  lastGraphics = null;
  slowPollCounter = 0;
  prevCpuTicks = null;
  prevNetBytes = null;
  prevDiskIo = null;
}
