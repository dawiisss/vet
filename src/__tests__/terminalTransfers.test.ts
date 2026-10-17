import { EventEmitter } from "node:events";
import type { BrowserWindow as ElectronWindow } from "electron";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  BrowserWindow: { fromWebContents: jest.fn((sender) => sender.window) },
}));
jest.mock("../main/pty", () => ({
  createTerminal: jest.fn(), destroyTerminal: jest.fn(), writeToTerminal: jest.fn(),
  resizeTerminal: jest.fn(), getTerminalInfo: jest.fn(), getHistory: jest.fn(), setForegroundTerminals: jest.fn(),
}));
jest.mock("../main/config", () => ({ getConfig: jest.fn(() => ({})) }));

import { ipcMain } from "electron";
import { registerTerminalHandlers } from "../main/ipc/terminalHandlers";

class TestWindow extends EventEmitter {
  destroyed = false;
  webContents = { send: jest.fn() };
  close = jest.fn(() => { this.destroyed = true; this.emit("closed"); });
  destroy = this.close;
  isDestroyed = () => this.destroyed;
  constructor(readonly id: number) { super(); }
}
const asWindow = (window: TestWindow) => window as unknown as ElectronWindow;
type Handler = (event: unknown, data: unknown) => Promise<unknown>;

describe("acknowledged tab transfers", () => {
  let source: TestWindow;
  let destination: TestWindow;
  let terminals: Map<number, Set<string>>;
  let load: jest.Mock;
  let forward: jest.Mock;
  let handlers: Map<string, Handler>;
  const tab: TabTransferState = {
    label: "Edited tab",
    root: { direction: "horizontal", children: [
      { terminalId: "pty" }, { editorId: "editor", filePath: "/tmp/a.txt" },
    ], sizes: [0.4, 0.6] },
    focusedPath: [1],
    editorDocuments: [{ editorId: "editor", filePath: "/tmp/a.txt", content: "valuable unsaved text", isDirty: true }],
  };
  const invoke = (name: string, window: TestWindow, data: unknown) =>
    handlers.get(`terminal:${name}`)!({ sender: { window } }, data);
  const detach = () => invoke("detach-tab", source, { tabId: "tab", terminalIds: ["pty"], tab });
  const detachId = () => new URLSearchParams(load.mock.calls[0][1]).get("transfer")!;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    source = new TestWindow(1);
    destination = new TestWindow(2);
    terminals = new Map([[source.id, new Set(["pty"])]]);
    load = jest.fn();
    forward = jest.fn();
    registerTerminalHandlers({
      windowTerminals: terminals,
      createWindow: () => asWindow(destination),
      getMainWindow: () => asWindow(destination),
      loadWindow: load,
      registerForwardTarget: forward,
    });
    handlers = new Map((ipcMain.handle as jest.Mock).mock.calls.map(([name, handler]) => [name, handler]));
  });
  afterEach(() => { jest.useRealTimers(); });

  test("keeps ownership and source tab until the destination acknowledges IPC buffers", async () => {
    let finished = false;
    const pending = detach().then((result) => { finished = true; return result; });
    const transferId = detachId();
    expect(load.mock.calls[0][1]).not.toContain("valuable");
    expect(load.mock.calls[0][1]).not.toContain("a.txt");
    expect(terminals.get(source.id)?.has("pty")).toBe(true);
    expect(await invoke("get-tab-transfer", source, { transferId })).toBeNull();
    expect(await invoke("complete-tab-transfer", source, { transferId })).toEqual({ success: false });
    expect(await invoke("get-tab-transfer", destination, { transferId })).toEqual(tab);
    expect(finished).toBe(false);
    expect(await invoke("complete-tab-transfer", destination, { transferId })).toEqual({ success: true });
    expect(await pending).toEqual({ success: true });
    expect(terminals.get(source.id)?.has("pty")).toBe(false);
    expect(terminals.get(destination.id)?.has("pty")).toBe(true);
    expect(forward).toHaveBeenCalledWith("pty", destination);
    expect(source.close).not.toHaveBeenCalled();
    expect(await invoke("get-tab-transfer", destination, { transferId })).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  test("timeout leaves source ownership intact and destroys the uninitialized detached window", async () => {
    const pending = detach();
    jest.advanceTimersByTime(30000);
    expect(await pending).toEqual({ success: false });
    expect(terminals.get(source.id)?.has("pty")).toBe(true);
    expect(destination.destroy).toHaveBeenCalled();
    expect(forward).not.toHaveBeenCalled();
    expect(source.listenerCount("closed")).toBe(0);
  });

  test("a destination closing during bootstrap leaves the source intact", async () => {
    const pending = detach();
    destination.close();
    expect(await pending).toEqual({ success: false });
    expect(terminals.get(source.id)?.has("pty")).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  test("reattach moves ownership and lets the renderer decide whether to close the source", async () => {
    terminals.get(source.id)!.add("other-pty");
    const pending = invoke("reattach-tab", source, { terminalIds: ["pty"], tab });
    const { transferId } = destination.webContents.send.mock.calls[0][1];
    expect(source.close).not.toHaveBeenCalled();
    expect(await invoke("get-tab-transfer", destination, { transferId })).toEqual(tab);
    await invoke("complete-tab-transfer", destination, { transferId });
    expect(await pending).toEqual({ success: true });
    expect(source.close).not.toHaveBeenCalled();
    expect(terminals.get(destination.id)?.has("pty")).toBe(true);
    expect(terminals.get(source.id)?.has("pty")).toBe(false);
    expect(terminals.get(source.id)?.has("other-pty")).toBe(true);
  });

  test("failed reattach leaves both windows open and retains source ownership", async () => {
    const pending = invoke("reattach-tab", source, { terminalIds: ["pty"], tab });
    jest.advanceTimersByTime(30000);
    expect(await pending).toEqual({ success: false });
    expect(source.close).not.toHaveBeenCalled();
    expect(destination.close).not.toHaveBeenCalled();
    expect(terminals.get(source.id)?.has("pty")).toBe(true);
  });

  test("editor-only panes transfer without requiring PTY ownership", async () => {
    const editorTab = { ...tab, root: { editorId: "editor", filePath: "/tmp/a.txt" }, focusedPath: [] };
    const pending = invoke("detach-tab", source, { tabId: "editor-tab", terminalIds: [], tab: editorTab });
    const transferId = detachId();
    expect(await invoke("get-tab-transfer", destination, { transferId })).toEqual(editorTab);
    await invoke("complete-tab-transfer", destination, { transferId });
    expect(await pending).toEqual({ success: true });
  });

  test("rejects transfers of a PTY not owned by the source", async () => {
    terminals.get(source.id)!.clear();
    expect(await detach()).toEqual({ success: false });
    expect(load).not.toHaveBeenCalled();
  });
});
