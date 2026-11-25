import { app, BrowserWindow, shell, ipcMain, safeStorage } from "electron";
import * as path from "path";
import { randomUUID } from "node:crypto";
import * as fs from "fs/promises";
import chokidar, { FSWatcher } from "chokidar";
import JSON5 from "json5";
import { DEFAULT_BROWSER_HOMEPAGE } from "../shared/utils/pathUtils";
import { isTrustedSender } from "./ipc/ipcUtils";

const credentialFields = ["password", "passphrase"] as const;
type CredentialField = typeof credentialFields[number];
type CredentialRecord = Partial<Record<CredentialField, { ciphertext: string; value?: string | undefined }>>;
type StoredCredentials = Map<string, CredentialRecord>;

let storedCredentials: StoredCredentials = new Map();
const configListeners = new Set<() => void>();

export function onConfigChanged(listener: () => void): () => void {
  configListeners.add(listener);
  return () => { configListeners.delete(listener); };
}

function hasSecureStorage(): boolean {
  return !!safeStorage?.isEncryptionAvailable() &&
    (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text");
}

function encryptField(value: string): string {
  try {
    if (hasSecureStorage()) {
      return "encrypted:" + safeStorage.encryptString(value).toString("base64");
    }
  } catch {
    /* Report storage errors without including the credential. */
  }
  throw new Error("SSH credentials require a working system keyring. Unlock or enable your keyring and try again.");
}

function decryptField(ciphertext: string): string | undefined {
  try {
    // Legacy values may have been saved with Electron's Linux fallback.
    // Allow reading those values so they can be replaced or removed.
    if (safeStorage?.isEncryptionAvailable()) {
      const buffer = Buffer.from(ciphertext.slice("encrypted:".length), "base64");
      return safeStorage.decryptString(buffer);
    }
  } catch {
    /* Preserve the ciphertext when a keyring is temporarily unavailable. */
  }
  return undefined;
}

const CONFIG_DIR = path.join(app.getPath("home"), ".config", "vet");
export const CONFIG_FILE = path.join(CONFIG_DIR, "config.json5");

const DEFAULT_CONFIG: any = {
  shell: process.env.SHELL || "/bin/bash",
  fontFamily: 'JetBrains Mono, "Fira Code", monospace',
  fontSize: 14,
  opacity: 1.0,
  vibrancy: "none",
  webglEnabled: true,
  maxActiveTerminals: 4,
  sidebarPlacement: "right",
  sidebarOpen: true,
  sidebarWidth: 250,
  disabledSidebarPanels: [],
  sidebarPanelsOrder: [
    "workspace",
    "search",
    "git",
    "profiles",
    "scripts",
    "docker",
    "ports",
    "system",
    "snippets",
    "clipboard",
    "connections",
    "history",
  ],
  clipboardHistoryKeepDays: 7,
  tabBarPosition: "top",
  sshParseGlobal: true,
  sshHosts: [],
  dockerDefaultShell: "/bin/bash",
  theme: "catppuccin-mocha",
  customThemes: {},
  cursorStyle: "block",
  cursorBlink: true,
  historyLoggingEnabled: true,
  historyDatabaseLimitMb: 100,
  historyKeepDays: 30,
  virtualScrollbackEnabled: true,
  virtualScrollbackBufferSize: 1000,
  keybindings: {
    "ctrl+b": "sidebar:toggle",
    "ctrl+shift+t": "tab:new",
    "ctrl+shift+w": "tab:close",
    "ctrl+tab": "tab:next",
    "ctrl+shift+tab": "tab:prev",
    "ctrl+shift+e": "split:extract",
    "ctrl+shift+\\": "split:horizontal",
    "ctrl+shift+d": "split:vertical",
    "ctrl+shift+x": "split:close",
    "ctrl+alt+u": "split:unsplit",
    "alt+arrowright": "pane:focus-next",
    "alt+arrowleft": "pane:focus-prev",
    "ctrl+shift+c": "terminal:copy",
    "ctrl+shift+v": "terminal:paste",
    "ctrl+f": "terminal:search",
    "ctrl+,": "settings:toggle",
    "ctrl+p": "command-palette:file-search",
    "ctrl+shift+p": "command-palette:toggle",
    "ctrl+shift+f": "app:toggle-fullscreen",
    "ctrl+shift+m": "app:maximize",
    "ctrl+q": "app:quit",
    f12: "browser:devtools",
  },
  browserHomepage: DEFAULT_BROWSER_HOMEPAGE,
  browserSearchEngine: "duckduckgo",
  browserAdblockEnabled: true,
  showIntroOnStartup: true,
  showStatusBar: true,
  editorMode: "split",
  profiles: [
    {
      id: "default",
      name: "Default Shell",
      shell: process.env.SHELL || "/bin/bash",
      args: [],
      cwd: "~",
    },
    {
      id: "node",
      name: "Node.js REPL",
      shell: "node",
      args: [],
      cwd: "~",
    },
    {
      id: "python",
      name: "Python REPL",
      shell: "python3",
      args: [],
      cwd: "~",
    },
  ],
};

let currentConfig: any = { ...DEFAULT_CONFIG };
let watcher: FSWatcher | null = null;
let lastConfigError: string | null = null;

export function sanitizeConfig(conf: any): any {
  const sanitized = { ...conf };

  if (!sanitized.customThemes || typeof sanitized.customThemes !== "object") {
    sanitized.customThemes = {};
  }

  if (!sanitized.keybindings || typeof sanitized.keybindings !== "object") {
    sanitized.keybindings = { ...DEFAULT_CONFIG.keybindings };
  } else {
    const currentActions = new Set(Object.values(sanitized.keybindings));
    for (const [key, action] of Object.entries(DEFAULT_CONFIG.keybindings)) {
      if (
        !currentActions.has(action as string) &&
        !sanitized.keybindings[key]
      ) {
        sanitized.keybindings[key] = action;
      }
    }
  }

  if (!sanitized.sshHosts || !Array.isArray(sanitized.sshHosts)) {
    sanitized.sshHosts = [];
  } else {
    sanitized.sshHosts = sanitized.sshHosts.map((h: any, idx: number) => {
      if (!h.id) {
        h.id = `ssh-${Date.now()}-${idx}`;
      }
      return h;
    });
  }

  if (
    !sanitized.profiles ||
    !Array.isArray(sanitized.profiles) ||
    sanitized.profiles.length === 0
  ) {
    sanitized.profiles = [...DEFAULT_CONFIG.profiles];
  } else {
    sanitized.profiles = sanitized.profiles.map((p: any, idx: number) => {
      const id = String(p.id || `profile-${idx}`);
      const name = String(p.name || `Profile ${idx}`);
      const shell = String(p.shell || DEFAULT_CONFIG.shell);
      const args = Array.isArray(p.args) ? p.args.map(String) : [];
      const cwd = p.cwd ? String(p.cwd) : "~";
      const env = p.env && typeof p.env === "object" ? p.env : undefined;
      return { id, name, shell, args, cwd, ...(env ? { env } : {}) };
    });

    const seen = new Set<string>();
    sanitized.profiles = sanitized.profiles.filter((p: any) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    if (sanitized.profiles.length === 0) {
      sanitized.profiles = [...DEFAULT_CONFIG.profiles];
    }
  }

  if (
    sanitized.tabBarPosition !== "top" &&
    sanitized.tabBarPosition !== "left" &&
    sanitized.tabBarPosition !== "right"
  ) {
    sanitized.tabBarPosition = "top";
  }

  if (
    typeof sanitized.sidebarWidth !== "number" ||
    isNaN(sanitized.sidebarWidth)
  ) {
    sanitized.sidebarWidth = 250;
  } else {
    sanitized.sidebarWidth = Math.max(
      150,
      Math.min(600, sanitized.sidebarWidth),
    );
  }

  if (
    typeof sanitized.clipboardHistoryKeepDays !== "number" ||
    isNaN(sanitized.clipboardHistoryKeepDays)
  ) {
    sanitized.clipboardHistoryKeepDays = 7;
  } else {
    sanitized.clipboardHistoryKeepDays = Math.max(
      1,
      Math.min(365, sanitized.clipboardHistoryKeepDays),
    );
  }

  if (!Array.isArray(sanitized.disabledSidebarPanels)) {
    sanitized.disabledSidebarPanels = [];
  } else {
    sanitized.disabledSidebarPanels = sanitized.disabledSidebarPanels
      .filter((p: any) => typeof p === "string")
      .map(String);
  }

  const DEFAULT_PANEL_ORDER = [
    "workspace",
    "search",
    "git",
    "profiles",
    "scripts",
    "docker",
    "ports",
    "system",
    "snippets",
    "clipboard",
    "connections",
    "history",
  ];

  if (!Array.isArray(sanitized.sidebarPanelsOrder)) {
    sanitized.sidebarPanelsOrder = [...DEFAULT_PANEL_ORDER];
  } else {
    const validKeys = sanitized.sidebarPanelsOrder.filter(
      (k: any) => typeof k === "string" && DEFAULT_PANEL_ORDER.includes(k),
    );
    const uniqueKeys = Array.from(new Set(validKeys));
    for (const key of DEFAULT_PANEL_ORDER) {
      if (!uniqueKeys.includes(key)) {
        uniqueKeys.push(key);
      }
    }
    sanitized.sidebarPanelsOrder = uniqueKeys;
  }

  if (sanitized.browserAdblockEnabled === undefined) {
    sanitized.browserAdblockEnabled = true;
  }
  if (sanitized.showStatusBar === undefined) {
    sanitized.showStatusBar = true;
  } else {
    sanitized.showStatusBar = Boolean(sanitized.showStatusBar);
  }
  if (
    !sanitized.browserHomepage ||
    typeof sanitized.browserHomepage !== "string"
  ) {
    sanitized.browserHomepage = DEFAULT_BROWSER_HOMEPAGE;
  }
  if (
    sanitized.browserSearchEngine !== "duckduckgo" &&
    sanitized.browserSearchEngine !== "google" &&
    sanitized.browserSearchEngine !== "bing"
  ) {
    sanitized.browserSearchEngine = "duckduckgo";
  }

  // fontSize validation
  if (typeof sanitized.fontSize !== "number" || isNaN(sanitized.fontSize)) {
    sanitized.fontSize = 14;
  } else {
    sanitized.fontSize = Math.max(6, Math.min(72, sanitized.fontSize));
  }

  // opacity validation
  if (typeof sanitized.opacity !== "number" || isNaN(sanitized.opacity)) {
    sanitized.opacity = 1.0;
  } else {
    sanitized.opacity = Math.max(0.1, Math.min(1.0, sanitized.opacity));
  }

  // maxActiveTerminals validation
  if (
    typeof sanitized.maxActiveTerminals !== "number" ||
    !Number.isFinite(sanitized.maxActiveTerminals)
  ) {
    sanitized.maxActiveTerminals = 4;
  } else {
    sanitized.maxActiveTerminals = Math.max(
      0,
      Math.min(50, sanitized.maxActiveTerminals),
    );
    sanitized.maxActiveTerminals = Math.floor(sanitized.maxActiveTerminals);
  }

  // cursorStyle validation
  if (!["block", "underline", "bar"].includes(sanitized.cursorStyle)) {
    sanitized.cursorStyle = "block";
  }

  // vibrancy validation
  if (
    !["none", "dark", "light", "medium", "ultra-dark"].includes(
      sanitized.vibrancy,
    )
  ) {
    sanitized.vibrancy = "none";
  }

  // fontFamily validation
  if (typeof sanitized.fontFamily !== "string") {
    sanitized.fontFamily = 'JetBrains Mono, "Fira Code", monospace';
  }

  // theme validation
  if (typeof sanitized.theme !== "string") {
    sanitized.theme = "catppuccin-mocha";
  }

  return sanitized;
}

export async function initConfigManager(mainWindow: BrowserWindow) {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (e) {
    console.error("Failed to create config dir", e);
  }

  // Serialize user saves and file watcher reads so each sees a complete revision.
  let configQueue: Promise<unknown> = Promise.resolve();
  const enqueueConfig = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = configQueue.then(operation);
    configQueue = result.catch(() => undefined);
    return result;
  };

  // Load or create config
  await loadConfig();

  // Watch for changes
  watcher = chokidar.watch(CONFIG_FILE, {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  function broadcastConfig(config: any): void {
    for (const listener of configListeners) listener();
    const sanitized = sanitizeConfigForRenderer(config);
    const windows = typeof BrowserWindow.getAllWindows === "function" ? BrowserWindow.getAllWindows() : [mainWindow];
    for (const win of windows) {
      if (win && !win.isDestroyed()) {
        win.webContents.send("config:changed", sanitized);
        win.webContents.send("config:error", null);
      }
    }
  }

  function broadcastConfigError(error: string | null): void {
    const windows = typeof BrowserWindow.getAllWindows === "function" ? BrowserWindow.getAllWindows() : [mainWindow];
    for (const win of windows) {
      if (win && !win.isDestroyed()) {
        win.webContents.send("config:error", error);
      }
    }
  }

  watcher.on("change", async () => {
    try {
      const success = await enqueueConfig(loadConfig);
      if (success) {
        broadcastConfig(currentConfig);
      } else {
        broadcastConfigError(lastConfigError);
      }
    } catch (e) {
      console.error("Error reloading config:", e);
    }
  });

  // IPC Handlers
  ipcMain.handle("config:get", (event) => {
    if (!isTrustedSender(event)) return null;
    return sanitizeConfigForRenderer(currentConfig);
  });
  ipcMain.handle("config:get-error", (event) => {
    if (!isTrustedSender(event)) return null;
    return lastConfigError;
  });

  ipcMain.handle("config:set", async (event, partialConfig: any) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked config:set from untrusted sender");
      throw new Error("Access denied");
    }
    if (
      !partialConfig ||
      typeof partialConfig !== "object" ||
      Array.isArray(partialConfig)
    ) {
      console.warn("[security] Rejected config:set with invalid payload");
      throw new Error("Invalid config payload");
    }

    // Cap unbounded structures before sanitize to bound memory/disk impact.
    if (Array.isArray(partialConfig.profiles)) {
      partialConfig.profiles = partialConfig.profiles.slice(0, 16);
    }
    if (Array.isArray(partialConfig.sshHosts)) {
      partialConfig.sshHosts = partialConfig.sshHosts.slice(0, 64);
    }
    if (Array.isArray(partialConfig.allowedShells)) {
      partialConfig.allowedShells = partialConfig.allowedShells.slice(0, 32);
    }
    if (Array.isArray(partialConfig.disabledSidebarPanels)) {
      partialConfig.disabledSidebarPanels = partialConfig.disabledSidebarPanels
        .filter((p: any) => typeof p === "string")
        .slice(0, 32);
    }
    if (Array.isArray(partialConfig.sidebarPanelsOrder)) {
      partialConfig.sidebarPanelsOrder = partialConfig.sidebarPanelsOrder
        .filter((p: any) => typeof p === "string")
        .slice(0, 32);
    }
    const reservedKeys = new Set(["__proto__", "constructor", "prototype"]);
    if (
      partialConfig.keybindings &&
      typeof partialConfig.keybindings === "object" &&
      !Array.isArray(partialConfig.keybindings)
    ) {
      partialConfig.keybindings = Object.fromEntries(
        Object.entries(partialConfig.keybindings)
          .filter(
            ([k, v]) =>
              typeof k === "string" &&
              typeof v === "string" &&
              !reservedKeys.has(k),
          )
          .slice(0, 64),
      );
    }
    if (
      partialConfig.customThemes &&
      typeof partialConfig.customThemes === "object" &&
      !Array.isArray(partialConfig.customThemes)
    ) {
      partialConfig.customThemes = Object.fromEntries(
        Object.entries(partialConfig.customThemes)
          .filter(([k]) => !reservedKeys.has(k))
          .slice(0, 32),
      );
    }

    return enqueueConfig(async () => {
      const mergedHosts = partialConfig.sshHosts;
      if (Array.isArray(mergedHosts)) {
        partialConfig.sshHosts = mergedHosts.map((host: SshHost) => {
          const nextHost = { ...host };
          const existing = currentConfig.sshHosts?.find((entry: SshHost) => entry.id === host.id);
          for (const field of credentialFields) {
            if (nextHost[field] === "__redacted__") {
              const value = existing?.[field];
              if (typeof value === "string") nextHost[field] = value;
              else delete nextHost[field];
            }
          }
          return nextHost;
        });
      }
      const nextConfig = sanitizeConfig({ ...currentConfig, ...partialConfig });
      await saveConfig(nextConfig);
      currentConfig = nextConfig;
      broadcastConfig(currentConfig);
    });
  });

  ipcMain.handle("config:open-in-editor", async (event) => {
    if (!isTrustedSender(event)) return;
    await shell.openPath(CONFIG_FILE);
  });
}

async function loadConfig(): Promise<boolean> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON5.parse(raw);
    const sanitized = sanitizeConfig({ ...DEFAULT_CONFIG, ...parsed });

    const loadedCredentials: StoredCredentials = new Map();
    for (const host of sanitized.sshHosts as SshHost[]) {
      for (const field of credentialFields) {
        const ciphertext = host[field];
        if (typeof ciphertext !== "string" || !ciphertext.startsWith("encrypted:")) continue;
        const previous = storedCredentials.get(host.id)?.[field];
        const value = decryptField(ciphertext) ?? (previous?.ciphertext === ciphertext ? previous.value : undefined);
        const record = loadedCredentials.get(host.id) ?? {};
        record[field] = { ciphertext, value };
        loadedCredentials.set(host.id, record);
        if (value === undefined) delete host[field];
        else host[field] = value;
      }
    }

    storedCredentials = loadedCredentials;
    currentConfig = sanitized;
    lastConfigError = null;
    return true;
  } catch (error: unknown) {
    let cause = error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      try {
        await saveConfig(currentConfig);
        lastConfigError = null;
        return true;
      } catch (writeError) {
        cause = writeError;
      }
    }
    console.error("Failed to load config file:", cause);
    lastConfigError = cause instanceof Error ? cause.message : String(cause);
    return false;
  }
}

async function saveConfig(config: typeof currentConfig): Promise<void> {
  const configToSave = structuredClone(config);
  const nextCredentials: StoredCredentials = new Map();
  for (const host of configToSave.sshHosts as SshHost[]) {
    const previous = storedCredentials.get(host.id);
    const record: CredentialRecord = {};
    for (const field of credentialFields) {
      const value = host[field];
      const existing = previous?.[field];
      if (existing && value === existing.value) {
        record[field] = existing;
      } else if (value) {
        record[field] = { value, ciphertext: encryptField(value) };
      }
      const ciphertext = record[field]?.ciphertext;
      if (ciphertext) host[field] = ciphertext;
    }
    nextCredentials.set(host.id, record);
  }

  const content = JSON5.stringify(configToSave, null, 2);
  const temporary = `${CONFIG_FILE}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, content, { encoding: "utf-8", mode: 0o600, flag: "wx" });
    await fs.rename(temporary, CONFIG_FILE);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => { /* Keep the original save error. */ });
    throw error;
  }
  storedCredentials = nextCredentials;
}

export function sanitizeConfigForRenderer(conf: any): any {
  if (!conf) return conf;
  const sanitized = structuredClone(conf);
  if (Array.isArray(sanitized.sshHosts)) {
    for (const host of sanitized.sshHosts as SshHost[]) {
      for (const field of credentialFields) {
        if (host[field] || storedCredentials.get(host.id)?.[field]) host[field] = "__redacted__";
      }
    }
  }
  return sanitized;
}

export function getConfig() {
  return currentConfig;
}

export function cleanupConfigManager() {
  if (watcher) {
    try {
      watcher.close();
    } catch (err) {
      console.error("Error closing config watcher:", err);
    }
    watcher = null;
  }
}
