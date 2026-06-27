/**
 * @jest-environment node
 */

import { initSysInfoManager, cleanupSysInfo } from "../main/sysinfo";
import { ipcMain } from "electron";
import os from "os";

let cpuCalls = 0;
let netCalls = 0;
let diskIoCalls = 0;

// Reset stateful mock counters before each test
beforeEach(() => {
  cpuCalls = 0;
  netCalls = 0;
  diskIoCalls = 0;
});

process.getCPUUsage = jest.fn(() => ({ percentCPUUsage: 1.5, idleWakeupsPerSecond: 10 }));

jest.mock("../main/pty", () => ({
  getPtyPids: jest.fn(() => []),
}));

// Mock native Node.js os module
jest.mock("os", () => ({
  cpus: jest.fn(() => {
    if (cpuCalls === 0) {
      cpuCalls++;
      return [
        {
          model: "Intel Core i7",
          speed: 2500,
          times: { user: 1000, nice: 0, sys: 500, idle: 2000, irq: 0 },
        },
      ];
    } else {
      // Delta total: 3000ms, Delta idle: 1500ms -> cpuLoad = 50%
      return [
        {
          model: "Intel Core i7",
          speed: 2500,
          times: { user: 2000, nice: 0, sys: 1000, idle: 3500, irq: 0 },
        },
      ];
    }
  }),
  totalmem: jest.fn(() => 16000000000),
  freemem: jest.fn(() => 8000000000),
  loadavg: jest.fn(() => [1.5, 2.0, 1.8]),
  uptime: jest.fn(() => 3600),
  platform: jest.fn(() => "linux"),
}));

// Mock native fs/promises
jest.mock("fs/promises", () => ({
  readFile: jest.fn((path: string) => {
    if (path === "/proc/mounts") {
      return Promise.resolve(
        "/dev/sda1 / ext4 rw,relatime 0 0\n/dev/sda1 /home ext4 rw,relatime 0 0\n"
      );
    }
    if (path === "/sys/class/thermal/thermal_zone0/temp") {
      return Promise.resolve("42000\n");
    }
    if (path === "/proc/net/dev") {
      if (netCalls === 0) {
        netCalls++;
        return Promise.resolve(
          "Inter-|   Receive\n face |bytes\n    lo: 0\n  eth0: 100000 0 0 0 0 0 0 0 50000\n"
        );
      } else {
        // Delta rx: 204800, tx: 102400. Over 2.0s: rx_sec = 102400, tx_sec = 51200
        return Promise.resolve(
          "Inter-|   Receive\n face |bytes\n    lo: 0\n  eth0: 304800 0 0 0 0 0 0 0 152400\n"
        );
      }
    }
    if (path === "/proc/diskstats") {
      if (diskIoCalls === 0) {
        diskIoCalls++;
        return Promise.resolve("   8       0 sda 100 0 0 0 100 0 0 0\n");
      } else {
        // Delta read sectors: 4096 (2097152 bytes), write sectors: 2048 (1048576 bytes)
        // Over 2.0s: rx_sec = 1048576, wx_sec = 524288
        return Promise.resolve("   8       0 sda 100 0 4096 0 100 0 2048 0\n");
      }
    }
    if (path === "/sys/class/power_supply/BAT0/capacity") {
      return Promise.resolve("85\n");
    }
    if (path === "/sys/class/power_supply/BAT0/status") {
      return Promise.resolve("charging\n");
    }
    if (path === "/sys/class/power_supply/AC/online") {
      return Promise.resolve("1\n");
    }
    if (path.startsWith("/proc/") && path.endsWith("/status")) {
      return Promise.resolve("VmRSS:     1024 kB\n");
    }
    return Promise.reject(new Error("File not found"));
  }),
  readdir: jest.fn(() => Promise.resolve(["BAT0", "AC"])),
  access: jest.fn(() => Promise.resolve()),
  statfs: jest.fn(() =>
    Promise.resolve({
      bsize: 4096,
      blocks: 12207031, // ~50GB
      bfree: 7324218,
      bavail: 7324218,
    })
  ),
}));

// Mock child_process execFile for nvidia-smi with support for promisified custom resolver
jest.mock("child_process", () => {
  const mockExecFile: any = jest.fn((...args) => {
    const callback = args[args.length - 1];
    const file = args[0];
    if (typeof callback === "function") {
      if (file === "nvidia-smi") {
        callback(null, "NVIDIA GeForce RTX 3060 Ti, 45, 20, 8192, 1024\n", "");
      } else {
        callback(null, "", "");
      }
    }
  });

  mockExecFile[Symbol.for("nodejs.util.promisify.custom")] = jest.fn((file) => {
    if (file === "nvidia-smi") {
      return Promise.resolve({
        stdout: "NVIDIA GeForce RTX 3060 Ti, 45, 20, 8192, 1024\n",
        stderr: "",
      });
    } else {
      return Promise.resolve({ stdout: "", stderr: "" });
    }
  });

  return {
    execFile: mockExecFile,
  };
});

const mockWebContents = {
  send: jest.fn(),
};

const mockWindow = {
  isDestroyed: jest.fn(() => false),
  webContents: mockWebContents,
};

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
  BrowserWindow: {},
  app: {
    getAppMetrics: jest.fn(() => [
      {
        type: "Browser",
        pid: 12345,
        cpu: { percentCPUUsage: 1.5, idleWakeupsPerSecond: 10 },
        memory: { workingSetSize: 231735296 },
      },
    ]),
  },
}));

describe("sysinfo", () => {
  let startHandler: (...args: any[]) => any;
  let stopHandler: (...args: any[]) => any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(global, "clearTimeout");

    mockWindow.isDestroyed.mockReturnValue(false);
    mockWebContents.send.mockClear();

    initSysInfoManager(mockWindow as any);

    const calls = (ipcMain.handle as jest.Mock).mock.calls;
    startHandler = calls.find((c: string[]) => c[0] === "sysinfo:start")?.[1];
    stopHandler = calls.find((c: string[]) => c[0] === "sysinfo:stop")?.[1];
  });

  afterEach(() => {
    cleanupSysInfo();
    jest.useRealTimers();
  });

  describe("initSysInfoManager", () => {
    it("registers sysinfo:start handler", () => {
      expect(ipcMain.handle).toHaveBeenCalledWith("sysinfo:start", expect.any(Function));
    });

    it("registers sysinfo:stop handler", () => {
      expect(ipcMain.handle).toHaveBeenCalledWith("sysinfo:stop", expect.any(Function));
    });
  });

  describe("sysinfo:start", () => {
    it("starts polling and sends data", async () => {
      await startHandler();

      // First tick (initializes rates and load baselines)
      await jest.advanceTimersByTimeAsync(2000);

      // Second tick (calculates correct rate differences)
      await jest.advanceTimersByTimeAsync(2000);

      expect(os.cpus).toHaveBeenCalled();
      expect(mockWebContents.send).toHaveBeenCalledWith(
        "sysinfo:update",
        expect.objectContaining({
          cpu: 50.0,
          mem: expect.objectContaining({
            total: 16000000000,
            used: 8000000000,
          }),
          network: expect.objectContaining({
            rx_sec: 102400,
            tx_sec: 51200,
          }),
          battery: expect.objectContaining({
            hasBattery: true,
            percent: 85,
            isCharging: true,
            acConnected: true,
          }),
          graphics: expect.objectContaining({
            controllers: expect.arrayContaining([
              expect.objectContaining({
                model: "NVIDIA GeForce RTX 3060 Ti",
                utilizationGpu: 20,
              }),
            ]),
          }),
          diskIo: expect.objectContaining({
            rx_sec: 1048576,
            wx_sec: 524288,
          }),
          appResources: expect.objectContaining({
            cpu: 1.5,
            mem: expect.any(Number),
          }),
        })
      );
    });

    it("clears previous timeout when starting again", async () => {
      await startHandler();
      await startHandler();
      expect(clearTimeout).toHaveBeenCalled();
    });

    it("handles errors during polling gracefully", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const testError = new Error("Test error");

      // Cause a failure on cpus retrieval to trigger catch block
      (os.cpus as jest.Mock).mockImplementationOnce(() => {
        throw testError;
      });

      await startHandler();
      await jest.advanceTimersByTimeAsync(2000);

      expect(errorSpy).toHaveBeenCalledWith("Failed to get sysinfo", testError);

      errorSpy.mockRestore();
    });

    it("does not send data when window is destroyed", async () => {
      mockWindow.isDestroyed.mockReturnValue(true);

      await startHandler();
      await jest.advanceTimersByTimeAsync(2000);

      expect(mockWebContents.send).not.toHaveBeenCalled();
    });
  });

  describe("sysinfo:stop", () => {
    it("stops the polling timeout", async () => {
      await startHandler(); // start it first to set timeoutId
      jest.clearAllMocks(); // clear mocks to ensure clearTimeout counts correctly
      await stopHandler();
      expect(clearTimeout).toHaveBeenCalled();
    });
  });
});
