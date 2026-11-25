import { registerAdblockerIpcHandlers, cleanupAdblocker, initAdblocker } from "../main/adblocker";
import { ipcMain } from "electron";
import { promises as fs } from "fs";

jest.mock("electron", () => {
  const mSession = {
    fromPartition: jest.fn(() => ({
      webRequest: {},
    })),
  };
  return {
    app: {
      on: jest.fn(),
    },
    BrowserWindow: {
      getAllWindows: jest.fn(() => []),
    },
    ipcMain: {
      handle: jest.fn(),
    },
    session: mSession,
  };
});

jest.mock("@ghostery/adblocker-electron", () => {
  const mockBlocker = {
    enableBlockingInSession: jest.fn(),
    disableBlockingInSession: jest.fn(),
    on: jest.fn(),
    unsubscribe: jest.fn(),
    serialize: jest.fn(() => Buffer.from("serialized")),
    onInjectCosmeticFilters: {
      bind: jest.fn(() => jest.fn()),
    },
    config: {},
  };
  return {
    ElectronBlocker: {
      deserialize: jest.fn(() => mockBlocker),
      fromLists: jest.fn(() => Promise.resolve(mockBlocker)),
    },
    fromElectronDetails: jest.fn(),
    fullLists: [],
    adsAndTrackingLists: [],
  };
});

jest.mock("../main/config", () => ({
  getConfig: jest.fn(() => ({
    browserAdblockEnabled: true,
  })),
}));

describe("adblocker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupAdblocker();
  });

  it("registers IPC handlers correctly", () => {
    registerAdblockerIpcHandlers(() => null);
    expect(ipcMain.handle).toHaveBeenCalledWith("adblocker:toggle", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("adblocker:get-stats", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("adblocker:clear-stats", expect.any(Function));
  });

  it("can initialize blocker and write to cache", async () => {
    jest.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));
    jest.spyOn(fs, "writeFile").mockResolvedValue(undefined);

    await initAdblocker("/mock/user/data");
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("rejects non-http URLs in adblocker:get-html-replace-rules", async () => {
    registerAdblockerIpcHandlers(() => null);
    const call = (ipcMain.handle as jest.Mock).mock.calls.find(
      ([channel]: [string]) => channel === "adblocker:get-html-replace-rules",
    );
    expect(call).toBeDefined();
    const handler = call![1] as (_e: unknown, url: string) => Promise<unknown>;
    await expect(handler({}, "file:///etc/passwd")).resolves.toEqual({
      pruneKeys: [],
      replaceRules: [],
    });
    await expect(handler({}, "javascript:alert(1)")).resolves.toEqual({
      pruneKeys: [],
      replaceRules: [],
    });
  });
});
