import { initSftpManager, cleanupSftpSessions } from "../main/sftp";
import { ipcMain } from "electron";
import { getConfig } from "../main/config";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  app: {
    getPath: jest.fn(() => "/tmp"),
  },
  BrowserWindow: { fromWebContents: jest.fn(() => ({})) },
}));

const mockClientEnd = jest.fn();
const mockClientConnect = jest.fn();
let mockConfigChanged: (() => void) | undefined;
let mockReady: (() => void) | undefined;
let mockDelayReady = false;
const mockSftpOpen = jest.fn((path, flags, cb) => cb(null, "mock-handle"));
const mockSftpWriteFile = jest.fn((path, content, encoding, cb) => cb(null));

jest.mock("ssh2", () => {
  class MockClient {
    connect = mockClientConnect;
    end = mockClientEnd;
    on = jest.fn((event, callback) => {
      if (event === "ready") {
        if (mockDelayReady) mockReady = callback;
        else setTimeout(callback, 0);
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
        stat: jest.fn((_path, cb) => cb(null, { size: 8 })),
        readFile: jest.fn((_path, _encoding, cb) => cb(null, "contents")),
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
  getConfig: jest.fn(),
  onConfigChanged: (listener: () => void) => {
    mockConfigChanged = listener;
    return () => { mockConfigChanged = undefined; };
  },
}));

const host = { id: "test-host", host: "localhost", username: "testuser", authType: "password", password: "pwd" };
const handler = (channel: string) =>
  (ipcMain.handle as jest.Mock).mock.calls.find(([name]) => name === `sftp:${channel}`)![1];
const invoke = (channel: string, ...args: unknown[]) => handler(channel)({ sender: {} }, ...args);

describe("sftp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getConfig as jest.Mock).mockReturnValue({ sshHosts: [host] });
    mockReady = undefined;
    mockDelayReady = false;
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

  it("reads and saves a literal remote path with its connection identity", async () => {
    initSftpManager();
    const file = "/remote/path/notes#draft.txt";
    await invoke("read-file-head", "test-host", file);
    expect(mockSftpOpen).toHaveBeenCalledWith(file, "r", expect.any(Function));

    const result = await invoke("read-file", "test-host", file);
    expect(result).toEqual({ content: "contents", connectionId: expect.any(String) });
    await expect(invoke("write-file", "test-host", file, "edited", result.connectionId)).resolves.toBe(true);
    expect(mockSftpWriteFile).toHaveBeenCalledWith(file, "edited", "utf8", expect.any(Function));
  });

  it("reconnects with the updated profile and rejects writes from an older editor", async () => {
    initSftpManager();
    const old = await invoke("read-file", "test-host", "/notes.txt");
    (getConfig as jest.Mock).mockReturnValue({ sshHosts: [{ ...host, host: "other.example.invalid" }] });
    mockConfigChanged?.();
    expect(mockClientEnd).toHaveBeenCalledTimes(1);
    expect(await invoke("get-home", "test-host", old.connectionId)).toMatchObject({ __ipcError: true });
    expect(await invoke("read-file", "test-host", "/notes.txt", old.connectionId)).toMatchObject({ __ipcError: true });
    expect(mockClientConnect).toHaveBeenCalledTimes(1);
    const current = await invoke("read-file", "test-host", "/notes.txt");
    expect(mockClientConnect).toHaveBeenLastCalledWith(expect.objectContaining({ host: "other.example.invalid" }));
    expect(current.connectionId).not.toBe(old.connectionId);
    expect(await invoke("write-file", "test-host", "/notes.txt", "edited", old.connectionId)).toMatchObject({
      __ipcError: true, message: expect.stringContaining("reopen"),
    });
    expect(mockSftpWriteFile).not.toHaveBeenCalled();
  });

  it("evicts an in-flight connection on deletion and ignores late ready callbacks", async () => {
    initSftpManager();
    mockDelayReady = true;
    const waiting = invoke("get-home", "test-host");
    const staleReady = mockReady;
    expect(staleReady).toBeDefined();
    (getConfig as jest.Mock).mockReturnValue({ sshHosts: [] });
    mockConfigChanged?.();
    staleReady?.();
    expect(await waiting).toMatchObject({ __ipcError: true });
    expect(await invoke("get-home", "test-host")).toMatchObject({ __ipcError: true, message: "SSH Host profile not found" });
    expect(mockClientEnd).toHaveBeenCalledTimes(1);
  });

  it("wraps SFTP promise rejections as structured __ipcError payloads and enforces write size cap", async () => {
    initSftpManager();
    const opened = await invoke("read-file", "test-host", "/notes.txt");
    mockSftpWriteFile.mockImplementationOnce((_p: string, _c: string, _enc: string, cb: (err?: Error) => void) => {
      cb(new Error("Permission denied"));
    });
    const writeErr = await invoke("write-file", "test-host", "/notes.txt", "data", opened.connectionId);
    expect(writeErr).toEqual({ __ipcError: true, message: "Permission denied" });

    const oversized = "x".repeat(10 * 1024 * 1024 + 1);
    const sizeErr = await invoke("write-file", "test-host", "/notes.txt", oversized, opened.connectionId);
    expect(sizeErr).toEqual({
      __ipcError: true,
      message: "Invalid content or exceeds 10 MB limit",
    });
  });
});
