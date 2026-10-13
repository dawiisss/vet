import { initSftpManager, cleanupSftpSessions } from "../main/sftp";
import { ipcMain } from "electron";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  app: {
    getPath: jest.fn(() => "/tmp"),
  },
  BrowserWindow: { fromWebContents: jest.fn(() => ({})) },
}));

const mockSftpOpen = jest.fn((path, flags, cb) => cb(null, "mock-handle"));
const mockSftpWriteFile = jest.fn((path, content, encoding, cb) => cb(null));

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
        open: mockSftpOpen,
        read: jest.fn((handle, buffer, offset, length, position, cb) => cb(null, 0)),
        close: jest.fn((handle, cb) => cb()),
        writeFile: mockSftpWriteFile,
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
    expect(ipcMain.handle).toHaveBeenCalledWith("sftp:write-file", expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith("sftp:get-home", expect.any(Function));
  });

  it("strips hash fragments in sftp:read-file-head and sftp:write-file", async () => {
    initSftpManager();
    const calls = (ipcMain.handle as jest.Mock).mock.calls;
    const readHandler = calls.find((c: string[]) => c[0] === "sftp:read-file-head")?.[1];
    const writeHandler = calls.find((c: string[]) => c[0] === "sftp:write-file")?.[1];

    await readHandler({ sender: {} }, "test-host", "/remote/path/file.txt#git-diff");
    expect(mockSftpOpen).toHaveBeenCalledWith(
      "/remote/path/file.txt",
      "r",
      expect.any(Function),
    );

    await writeHandler({ sender: {} }, "test-host", "/remote/path/file.txt#L50", "content");
    expect(mockSftpWriteFile).toHaveBeenCalledWith(
      "/remote/path/file.txt",
      "content",
      "utf8",
      expect.any(Function),
    );
  });
});
