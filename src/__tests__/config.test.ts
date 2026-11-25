jest.mock("electron", () => ({
  app: { getPath: jest.fn(() => "/mock/home/.config/vet") },
  BrowserWindow: { fromWebContents: jest.fn(() => ({})) },
  shell: { openExternal: jest.fn(), openPath: jest.fn() },
  ipcMain: { handle: jest.fn() },
  safeStorage: {
    isEncryptionAvailable: jest.fn(),
    getSelectedStorageBackend: jest.fn(),
    encryptString: jest.fn(),
    decryptString: jest.fn(),
  },
}));

jest.mock("chokidar", () => ({
  watch: jest.fn(() => ({ on: jest.fn() })),
}));

jest.mock("fs/promises", () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  rename: jest.fn(),
  rm: jest.fn(async () => undefined),
}));

import { sanitizeConfig, initConfigManager, getConfig } from "../main/config";
import { ipcMain, safeStorage } from "electron";
import * as fs from "fs/promises";
import JSON5 from "json5";

describe("sanitizeConfig", () => {
  it("populates missing customThemes", () => {
    const result = sanitizeConfig({});
    expect(result.customThemes).toEqual({});
  });

  it("replaces non-object customThemes with empty object", () => {
    const result = sanitizeConfig({ customThemes: "string" });
    expect(result.customThemes).toEqual({});
  });

  it("preserves valid customThemes", () => {
    const result = sanitizeConfig({ customThemes: { myTheme: {} } });
    expect(result.customThemes).toEqual({ myTheme: {} });
  });

  it("populates missing keybindings with defaults", () => {
    const result = sanitizeConfig({});
    expect(result.keybindings).toBeDefined();
    expect(typeof result.keybindings).toBe("object");
    expect(result.keybindings["ctrl+b"]).toBe("sidebar:toggle");
  });

  it("replaces non-object keybindings with defaults", () => {
    const result = sanitizeConfig({ keybindings: "bad" });
    expect(result.keybindings).toBeDefined();
    expect(result.keybindings["ctrl+b"]).toBe("sidebar:toggle");
  });

  it("merges user keybindings with defaults when actions dont conflict", () => {
    const result = sanitizeConfig({ keybindings: { "ctrl+c": "test:action" } });
    expect(result.keybindings["ctrl+c"]).toBe("test:action");
    expect(result.keybindings["ctrl+b"]).toBe("sidebar:toggle");
  });

  it("populates missing profiles with defaults", () => {
    const result = sanitizeConfig({});
    expect(result.profiles).toBeDefined();
    expect(Array.isArray(result.profiles)).toBe(true);
    expect(result.profiles.length).toBeGreaterThanOrEqual(1);
  });

  it("replaces non-array profiles with defaults", () => {
    const result = sanitizeConfig({ profiles: "not-an-array" });
    expect(Array.isArray(result.profiles)).toBe(true);
  });

  it("replaces empty profiles array with defaults", () => {
    const result = sanitizeConfig({ profiles: [] });
    expect(result.profiles.length).toBeGreaterThanOrEqual(1);
  });

  it("sanitizes profile entries with missing fields", () => {
    const result = sanitizeConfig({
      profiles: [{ id: "test", name: "Test" }],
    });
    const profile = result.profiles[0];
    expect(profile.id).toBe("test");
    expect(profile.name).toBe("Test");
    expect(profile.shell).toBeDefined();
    expect(Array.isArray(profile.args)).toBe(true);
    expect(profile.cwd).toBe("~");
  });

  it("deduplicates profiles by id", () => {
    const result = sanitizeConfig({
      profiles: [
        { id: "dup", name: "First" },
        { id: "dup", name: "Second" },
      ],
    });
    expect(result.profiles.length).toBe(1);
  });

  it("handles profiles with env objects", () => {
    const result = sanitizeConfig({
      profiles: [
        { id: "env-test", name: "Env", shell: "/bin/zsh", env: { FOO: "bar" } },
      ],
    });
    expect(result.profiles[0].env).toEqual({ FOO: "bar" });
  });

  it("generates profile ids for profiles without them", () => {
    const result = sanitizeConfig({
      profiles: [{ name: "NoID" }],
    });
    expect(result.profiles[0].id).toMatch(/^profile-\d+$/);
  });

  it("falls back to defaults when all profiles are deduplicated to zero", () => {
    const result = sanitizeConfig({
      profiles: [
        { id: "dup", name: "A" },
        { id: "dup", name: "B" },
      ],
    });
    expect(result.profiles.length).toBe(1);
    expect(result.profiles[0].id).toBe("dup");
  });

  it("populates missing tabBarPosition with top", () => {
    const result = sanitizeConfig({});
    expect(result.tabBarPosition).toBe("top");
  });

  it("preserves valid tabBarPosition", () => {
    expect(sanitizeConfig({ tabBarPosition: "left" }).tabBarPosition).toBe(
      "left",
    );
    expect(sanitizeConfig({ tabBarPosition: "right" }).tabBarPosition).toBe(
      "right",
    );
    expect(sanitizeConfig({ tabBarPosition: "top" }).tabBarPosition).toBe(
      "top",
    );
  });

  it("replaces invalid tabBarPosition with top", () => {
    const result = sanitizeConfig({ tabBarPosition: "bottom" });
    expect(result.tabBarPosition).toBe("top");
  });
});

describe("SSH credential persistence", () => {
  const host = { id: "test-host", name: "Example", host: "example.invalid", username: "tester", authType: "password" };
  const ciphertext = "encrypted:c3RvcmVk";
  const handler = (channel: string) =>
    (ipcMain.handle as jest.Mock).mock.calls.find(([name]) => name === `config:${channel}`)![1];
  const save = (data: unknown) => handler("set")({ sender: {} }, data);
  const init = () => initConfigManager({
    isDestroyed: () => false, webContents: { send: jest.fn() },
  } as unknown as Electron.BrowserWindow);

  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(process, "platform", { ...platformDescriptor, value: "linux" });
    (safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true);
    (safeStorage.getSelectedStorageBackend as jest.Mock).mockReturnValue("gnome_libsecret");
    (safeStorage.encryptString as jest.Mock).mockReturnValue(Buffer.from("stored"));
    (safeStorage.decryptString as jest.Mock).mockReset();
    (fs.readFile as jest.Mock).mockResolvedValue(JSON5.stringify({ sshHosts: [host] }));
  });

  afterEach(() => { Object.defineProperty(process, "platform", platformDescriptor); });

  it.each(["unavailable", "basic_text", "encrypt failure"])("rejects a new credential with %s without saving it", async (mode) => {
    if (mode === "unavailable") (safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(false);
    if (mode === "basic_text") (safeStorage.getSelectedStorageBackend as jest.Mock).mockReturnValue("basic_text");
    if (mode === "encrypt failure") (safeStorage.encryptString as jest.Mock).mockImplementationOnce(() => { throw new Error("locked"); });
    await init();
    await expect(save({ sshHosts: [{ ...host, password: "secret" }] })).rejects.toThrow("working system keyring");
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(getConfig().sshHosts[0].password).toBeUndefined();
  });

  it("stores encrypted credentials and redacts them from renderer reads", async () => {
    await init();
    await save({ sshHosts: [{ ...host, password: "secret" }] });
    expect(getConfig().sshHosts[0].password).toBe("secret");
    const saved = JSON5.parse((fs.writeFile as jest.Mock).mock.calls[0]![1]);
    expect(saved.sshHosts[0].password).toBe(ciphertext);
    expect(handler("get")({ sender: {} }).sshHosts[0].password).toBe("__redacted__");
  });

  it("retains a locked credential through unrelated saves and redacted profile edits", async () => {
    const locked = "encrypted:bG9ja2Vk";
    (fs.readFile as jest.Mock).mockResolvedValue(JSON5.stringify({ sshHosts: [{ ...host, password: locked }] }));
    (safeStorage.decryptString as jest.Mock).mockImplementation(() => { throw new Error("locked"); });
    await init();
    expect(getConfig().sshHosts[0].password).toBeUndefined();
    expect(handler("get")({ sender: {} }).sshHosts[0].password).toBe("__redacted__");
    await save({ fontSize: 20 });
    await save({ sshHosts: [{ ...host, name: "Renamed", password: "__redacted__" }] });
    for (const [, written] of (fs.writeFile as jest.Mock).mock.calls) {
      expect(JSON5.parse(written).sshHosts[0].password).toBe(locked);
    }
    expect(safeStorage.encryptString).not.toHaveBeenCalled();
  });
});
