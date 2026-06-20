/**
 * @jest-environment node
 */

process.getCPUUsage = jest.fn(() => ({ percentCPUUsage: 1.5, idleWakeupsPerSecond: 10 }));

jest.mock("systeminformation", () => ({
  currentLoad: jest.fn(() => Promise.resolve({ currentLoad: 45.2 })),
  mem: jest.fn(() =>
    Promise.resolve({ total: 16000000000, active: 8000000000 }),
  ),
  fsSize: jest.fn(() =>
    Promise.resolve([
      { size: 50000000000, used: 20000000000, use: 40.0, mount: "/", fs: "/dev/sda1" }
    ]),
  ),
  cpuTemperature: jest.fn(() =>
    Promise.resolve({ main: 42.0 }),
  ),
  networkStats: jest.fn(() =>
    Promise.resolve([
      { iface: "eth0", operstate: "up", rx_sec: 102400, tx_sec: 51200 }
    ]),
  ),
  battery: jest.fn(() =>
    Promise.resolve({
      hasBattery: true,
      percent: 85,
      isCharging: true,
      acConnected: true
    }),
  ),
  graphics: jest.fn(() =>
    Promise.resolve({
      controllers: [
        { model: "NVIDIA GeForce RTX 3060 Ti", vram: 8192, memoryTotal: 8192, memoryUsed: 1024, temperatureGpu: 45, utilizationGpu: 20 }
      ]
    }),
  ),
  fsStats: jest.fn(() =>
    Promise.resolve({
      rx_sec: 1048576,
      wx_sec: 524288
    }),
  ),
}));

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
}));

import { initSysInfoManager } from "../main/sysinfo";
import { ipcMain } from "electron";
import si from "systeminformation";

describe("sysinfo", () => {
  let startHandler: (...args: any[]) => any;
  let stopHandler: (...args: any[]) => any;
  let timeoutCallback: (() => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    jest.spyOn(global, "setTimeout").mockImplementation((fn) => {
      timeoutCallback = fn as unknown as () => void;
      return 1 as any;
    });
    jest.spyOn(global, "clearTimeout").mockImplementation(jest.fn());

    mockWindow.isDestroyed.mockReturnValue(false);
    mockWebContents.send.mockClear();

    initSysInfoManager(mockWindow as any);

    const calls = (ipcMain.handle as jest.Mock).mock.calls;
    startHandler = calls.find((c: string[]) => c[0] === "sysinfo:start")?.[1];
    stopHandler = calls.find((c: string[]) => c[0] === "sysinfo:stop")?.[1];
  });

  afterEach(() => {
    jest.useRealTimers();
    timeoutCallback = null;
  });

  describe("initSysInfoManager", () => {
    it("registers sysinfo:start handler", () => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "sysinfo:start",
        expect.any(Function),
      );
    });

    it("registers sysinfo:stop handler", () => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "sysinfo:stop",
        expect.any(Function),
      );
    });
  });

  describe("sysinfo:start", () => {
    it("starts polling and sends data", async () => {
      await startHandler();

      expect(setTimeout).toHaveBeenCalled();

      await timeoutCallback?.();
      await Promise.resolve().then(() => {});

      expect(si.currentLoad).toHaveBeenCalled();
      expect(si.mem).toHaveBeenCalled();
      expect(mockWebContents.send).toHaveBeenCalledWith(
        "sysinfo:update",
        expect.objectContaining({
          cpu: 45.2,
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
              })
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
        }),
      );
    });

    it("clears previous timeout when starting again", async () => {
      await startHandler();
      await startHandler();
      expect(clearTimeout).toHaveBeenCalled();
    });

    it("handles errors during polling gracefully", async () => {
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const testError = new Error("Test error");

      // Override the mock temporarily for this test
      (si.currentLoad as jest.Mock).mockRejectedValueOnce(testError);

      await startHandler();
      await timeoutCallback?.();

      // Need to flush microtasks for the promise rejection to be caught
      await Promise.resolve().then(() => {});

      expect(errorSpy).toHaveBeenCalledWith("Failed to get sysinfo", testError);

      errorSpy.mockRestore();
    });

    it("does not send data when window is destroyed", async () => {
      mockWindow.isDestroyed.mockReturnValue(true);

      await startHandler();
      await timeoutCallback?.();

      expect(mockWebContents.send).not.toHaveBeenCalled();
    });
  });

  describe("sysinfo:stop", () => {
    it("stops the polling timeout", async () => {
      await stopHandler();
      expect(clearTimeout).toHaveBeenCalled();
    });
  });
});
