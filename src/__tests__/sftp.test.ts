import { initSftpManager, cleanupSftpSessions } from "../main/sftp";
import { ipcMain } from "electron";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock("ssh2", () => {
  class MockClient {
    connect = jest.fn();
    end = jest.fn();
    on = jest.fn((event, callback) => {
      if (event === "ready") {
        setTimeout(callback, 0);
      }
      return this;
    });
    sftp = jest.fn((callback) => {
      callback(null, {
        readdir: jest.fn((path, cb) => cb(null, [])),
        open: jest.fn((path, flags, cb) => cb(null, "mock-handle")),
        read: jest.fn((handle, buffer, offset, length, position, cb) => cb(null, 0)),
        close: jest.fn((handle, cb) => cb()),
      });
    });
    exec = jest.fn((cmd, callback) => {
      const mockStream = {
        on: jest.fn((event, cb) => {
          if (event === "close") {
            setTimeout(cb, 0);
          }
          return this;
        }),
      };
      callback(null, mockStream);
    });
  }
  return {
    Client: MockClient,
  };
});

jest.mock("../main/config", () => ({
  getConfig: jest.fn(() => ({
    sshHosts: [
      { id: "test-host", host: "localhost", username: "testuser", authType: "password", password: "pwd" },
    ],
  })),
}));

describe("sftp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupSftpSessions();
  });

  it("registers IPC handlers correctly", () => {
    initSftpManager();
    expect(ipcMain.handle).toHaveBeenCalledWith("sftp:set-temp-password", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("sftp:list-dir", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("sftp:read-file-head", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("sftp:get-home", expect.any(Function));
  });
});
