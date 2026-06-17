/**
 * @jest-environment node
 */

jest.mock("node-pty", () => ({
  spawn: jest.fn(() => ({
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
    onData: jest.fn(),
    onExit: jest.fn(),
    pid: 12345,
    process: "/bin/bash",
  })),
}));

jest.mock("uuid", () => ({
  v4: jest.fn(() => "mock-uuid-1234"),
}));

jest.mock("fs", () => ({
  promises: {
    readlink: jest.fn(),
  },
}));

jest.mock("child_process", () => ({
  exec: jest.fn((_cmd, cb) => {
    if (typeof cb === "function") {
      cb(null, { stdout: "", stderr: "" });
    }
  }),
  execFile: jest.fn((_file, _args, cb) => {
    if (typeof cb === "function") {
      cb(null, { stdout: "", stderr: "" });
    }
  }),
}));

jest.mock("os", () => ({
  platform: jest.fn(() => "linux"),
}));

jest.mock("../main/config", () => ({
  getConfig: jest.fn(() => ({
    shell: "/bin/bash",
    historyLoggingEnabled: false,
    profiles: [
      { id: "default", name: "Default", shell: "/bin/bash", args: [] },
      { id: "ssh-profile", name: "SSH", shell: "ssh", args: ["user@host"] },
    ],
  })),
}));

jest.mock("../main/historyDb", () => ({
  startSession: jest.fn(),
  closeSession: jest.fn(),
  logOutput: jest.fn(),
  getScrollbackChunk: jest.fn(() => []),
}));

import { spawn } from "node-pty";
import {
  createTerminal,
  writeToTerminal,
  resizeTerminal,
  destroyTerminal,
  setForwardTarget,
  removeForwardTarget,
  getHistory,
  getTerminalInfo,
} from "../main/pty";

describe("pty", () => {
  let terminalId: string;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    const config = require("../main/config");
    config.getConfig.mockReturnValue({
      shell: "/bin/bash",
      historyLoggingEnabled: false,
      profiles: [
        { id: "default", name: "Default", shell: "/bin/bash", args: [] },
        { id: "ssh-profile", name: "SSH", shell: "ssh", args: ["user@host"] },
      ],
    });
    terminalId = createTerminal({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("createTerminal", () => {
    it("returns a uuid", () => {
      expect(terminalId).toBe("mock-uuid-1234");
    });

    it("spawns a pty process with expected shell", () => {
      expect(spawn).toHaveBeenCalledWith(
        "/bin/bash",
        [],
        expect.objectContaining({
          name: "xterm-256color",
          cols: 80,
          rows: 24,
        }),
      );
    });

    it("calls historyDb.startSession", () => {
      const historyDb = require("../main/historyDb");
      expect(historyDb.startSession).toHaveBeenCalledWith(
        terminalId,
        expect.any(String),
        "local",
        "localhost",
      );
    });

    it("detects SSH connections by shell name", () => {
      const config = require("../main/config");
      config.getConfig.mockReturnValue({
        profiles: [
          { id: "ssh-profile", name: "SSH", shell: "ssh", args: ["user@host"] },
        ],
      });
      createTerminal({ profileId: "ssh-profile" });
      const historyDb = require("../main/historyDb");
      expect(historyDb.startSession).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        "ssh",
        "user@host",
      );
    });

    it("registers onData handler that saves to history buffer", () => {
      const mockSpawn = spawn as jest.Mock;
      const mockPty = mockSpawn.mock.results[
        mockSpawn.mock.results.length - 1
      ].value;
      const onDataCallback = mockPty.onData.mock.calls[0][0];

      onDataCallback("test data");
      jest.advanceTimersByTime(15);
      expect(getHistory(terminalId).data).toContain("test data");
    });

    it("registers onData handler that calls forward target", () => {
      const forwardFn = jest.fn();
      setForwardTarget(terminalId, forwardFn);

      const mockSpawn = spawn as jest.Mock;
      const mockPty = mockSpawn.mock.results[
        mockSpawn.mock.results.length - 1
      ].value;
      const onDataCallback = mockPty.onData.mock.calls[0][0];

      onDataCallback("fwd data");
      jest.advanceTimersByTime(15);
      expect(forwardFn).toHaveBeenCalledWith(
        "terminal:data",
        expect.objectContaining({ id: terminalId, data: "fwd data" }),
      );
    });

    it("caps history buffer at 100KB", () => {
      const mockSpawn = spawn as jest.Mock;
      const mockPty = mockSpawn.mock.results[
        mockSpawn.mock.results.length - 1
      ].value;
      const onDataCallback = mockPty.onData.mock.calls[0][0];

      const bigData = "x".repeat(150000);
      onDataCallback(bigData);
      jest.advanceTimersByTime(15);
      const history = getHistory(terminalId);
      expect(history.data.length).toBeLessThanOrEqual(100000);
    });
  });

  describe("writeToTerminal", () => {
    it("writes data to the pty", () => {
      writeToTerminal(terminalId, "echo hello");
      const mockPty = (spawn as jest.Mock).mock.results[0].value;
      expect(mockPty.write).toHaveBeenCalledWith("echo hello");
    });

    it("does nothing for unknown terminal", () => {
      writeToTerminal("unknown-id", "data");
    });
  });

  describe("resizeTerminal", () => {
    it("resizes the pty", () => {
      resizeTerminal(terminalId, 120, 40);
      const mockPty = (spawn as jest.Mock).mock.results[0].value;
      expect(mockPty.resize).toHaveBeenCalledWith(120, 40);
    });

    it("does nothing for unknown terminal", () => {
      resizeTerminal("unknown-id", 120, 40);
    });
  });

  describe("destroyTerminal", () => {
    it("kills the pty and cleans up", () => {
      destroyTerminal(terminalId);
      const mockPty = (spawn as jest.Mock).mock.results[0].value;
      expect(mockPty.kill).toHaveBeenCalled();
    });

    it("does nothing for unknown terminal", () => {
      destroyTerminal("unknown-id");
    });
  });

  describe("setForwardTarget / removeForwardTarget", () => {
    it("sets and removes forward target", () => {
      const fn = jest.fn();
      setForwardTarget(terminalId, fn);
      expect(fn).not.toHaveBeenCalled();
      removeForwardTarget(terminalId);
    });
  });

  describe("getTerminalInfo", () => {
    it("returns terminal info on linux", async () => {
      const fs = require("fs");
      fs.promises.readlink.mockResolvedValue("/home/user/projects");

      const info = await getTerminalInfo(terminalId);
      expect(info.title).toContain("projects");
      expect(info.cwd).toBe("/home/user/projects");
    });

    it("returns fallback for unknown terminal", async () => {
      const info = await getTerminalInfo("unknown-id");
      expect(info.cwd).toBe("");
    });
  });
});
