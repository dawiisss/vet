jest.mock("electron", () => ({
  app: {
    on: jest.fn(),
    getPath: jest.fn(() => "/mock/home"),
  },
  BrowserWindow: {
    fromWebContents: jest.fn(() => ({})),
  },
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock("os", () => ({
  homedir: jest.fn(() => "/mock/home"),
}));

jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    rename: jest.fn(),
    mkdir: jest.fn(),
  },
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  renameSync: jest.fn(),
}));

import { initSessionManager, getSessionData } from "../main/session";

describe("session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const fs = require("fs");
    fs.existsSync.mockReturnValue(true);
  });

  describe("initSessionManager", () => {
    it("creates config directory if it does not exist", () => {
      const fs = require("fs");
      fs.existsSync.mockReturnValue(false);
      initSessionManager(() => true);
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("vet"),
        { recursive: true },
      );
    });

    it("registers session:save handler", () => {
      initSessionManager(() => true);
      const { ipcMain } = require("electron");
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "session:save",
        expect.any(Function),
      );
    });

    it("registers session:get handler", () => {
      initSessionManager(() => true);
      const { ipcMain } = require("electron");
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "session:get",
        expect.any(Function),
      );
    });

    it("registers will-quit handler", () => {
      initSessionManager(() => true);
      const { app } = require("electron");
      expect(app.on).toHaveBeenCalledWith("will-quit", expect.any(Function));
    });
  });

  it("debounces snapshots, writes an empty layout atomically, and ignores secondary windows", () => {
    jest.useFakeTimers();
    try {
      const { app, ipcMain } = require("electron");
      const fs = require("fs");
      const mainSender = {};
      initSessionManager((sender) => sender === mainSender);
      const save = ipcMain.handle.mock.calls.find(([channel]: [string]) => channel === "session:save")[1];
      save({ sender: mainSender }, {
        tabs: [{ id: "t1", label: "Shell", root: { terminalId: "pty" } }], activeTabId: "t1",
      });
      save({ sender: mainSender }, { tabs: [], activeTabId: null });
      save({ sender: {} }, { tabs: [{ id: "other", label: "Other", root: { terminalId: "other" } }] });
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      jest.advanceTimersByTime(250);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining(".tmp"),
        '{"tabs":[],"activeTabId":null}', { encoding: "utf-8", mode: 0o600 });
      expect(fs.renameSync).toHaveBeenCalledWith(expect.stringContaining(".tmp"), expect.stringContaining("session.json"));
      const willQuit = app.on.mock.calls.find(([event]: [string]) => event === "will-quit")[1];
      willQuit();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("writes workspace profiles atomically and rejects prototype-polluting names", async () => {
    const { ipcMain } = require("electron");
    const fs = require("fs");
    fs.promises.readFile.mockResolvedValue(JSON.stringify({}));
    fs.promises.writeFile = jest.fn().mockResolvedValue(undefined);
    fs.promises.rename = jest.fn().mockResolvedValue(undefined);

    initSessionManager(() => true);
    const saveProfile = ipcMain.handle.mock.calls.find(
      ([channel]: [string]) => channel === "session:save-profile",
    )[1];

    await saveProfile({ sender: {} }, "__proto__", { polluted: true });
    expect(fs.promises.writeFile).not.toHaveBeenCalled();

    await saveProfile({ sender: {} }, "work", { tabs: [] });
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("profiles.json."),
      expect.stringContaining('"work"'),
      { encoding: "utf-8", mode: 0o600 },
    );
    expect(fs.promises.rename).toHaveBeenCalledWith(
      expect.stringContaining("profiles.json."),
      expect.stringContaining("profiles.json"),
    );
  });

  describe("getSessionData", () => {
    it("returns null when file does not exist", async () => {
      const fs_ = require("fs");
      fs_.promises.readFile.mockRejectedValue({ code: "ENOENT" });
      const result = await getSessionData();
      expect(result).toBeNull();
    });

    it("returns parsed JSON when file exists", async () => {
      const fs_ = require("fs");
      fs_.promises.readFile.mockResolvedValue(
        JSON.stringify({ tabs: [{ id: "t1" }] }),
      );
      const result = await getSessionData();
      expect(result).toEqual({ tabs: [{ id: "t1" }] });
    });

    it("returns null on JSON parse error", async () => {
      const fs_ = require("fs");
      fs_.promises.readFile.mockResolvedValue("not json");
      const result = await getSessionData();
      expect(result).toBeNull();
    });
  });
});
