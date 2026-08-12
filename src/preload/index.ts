import { contextBridge, ipcRenderer } from "electron";

const dataHandlers = new Set<(id: string, data: string) => void>();
const exitHandlers = new Set<(id: string, exitCode: number) => void>();
const reattachHandlers = new Set<(terminalIds: string[]) => void>();
const maximizeHandlers = new Set<(maximized: boolean) => void>();

ipcRenderer.on(
  "terminal:data",
  (_event, { id, data }: { id: string; data: string }) => {
    dataHandlers.forEach((h) => h(id, data));
  },
);

ipcRenderer.on(
  "terminal:exit",
  (_event, { id, exitCode }: { id: string; exitCode: number }) => {
    exitHandlers.forEach((h) => h(id, exitCode));
  },
);

ipcRenderer.on(
  "terminal:reattach-tab",
  (_event, { terminalIds }: { terminalIds: string[] }) => {
    reattachHandlers.forEach((h) => h(terminalIds));
  },
);

ipcRenderer.on("win:maximize-change", (_event, maximized: boolean) => {
  maximizeHandlers.forEach((h) => h(maximized));
});

const invoke = <T>(channel: string) => (...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args);

const send = (channel: string) => (...args: unknown[]) =>
  ipcRenderer.send(channel, ...args);

const registerHandler = <T>(handlers: Set<T>) => (callback: T) => {
  handlers.add(callback);
  return () => {
    handlers.delete(callback);
  };
};

const terminalApi: TerminalApi = {
  create: (opts) => invoke<{ id: string }>("terminal:create")(opts || {}),
  enableForwarding: (id) => invoke<void>("terminal:enable-forwarding")({ id }),
  write: (id, data) => send("terminal:write")({ id, data }),
  resize: (id, cols, rows) => invoke<void>("terminal:resize")({ id, cols, rows }),
  getHistory: (id) => invoke<string>("terminal:get-history")({ id }),
  destroy: (id) => invoke<void>("terminal:destroy")({ id }),
  detachTab: (tabId, terminalIds) =>
    invoke<{ success: boolean }>("terminal:detach-tab")({ tabId, terminalIds }),
  reattachTab: (terminalIds) =>
    invoke<{ success: boolean }>("terminal:reattach-tab")({ terminalIds }),
  getTerminalInfo: (id) =>
    invoke<{ title: string; cwd: string; sshHostId?: string }>("terminal:get-info")({ id }),
  setForeground: (ids) => invoke<void>("terminal:set-foreground")({ ids }),
  onData: registerHandler(dataHandlers),
  onExit: registerHandler(exitHandlers),
  onReattachTab: registerHandler(reattachHandlers),
  saveSession: (state) => invoke<void>("session:save")(state),
  getSession: () => invoke<unknown>("session:get")(),
  saveProfile: (name: string, state: unknown) => invoke<void>("session:save-profile")(name, state),
  getProfiles: () => invoke<Record<string, unknown>>("session:get-profiles")(),
  deleteProfile: (name: string) => invoke<void>("session:delete-profile")(name),
};

const windowApi: WindowApi = {
  minimize: invoke("win:minimize"),
  maximize: invoke("win:maximize"),
  toggleFullscreen: invoke("win:toggle-fullscreen"),
  close: invoke("win:close"),
  quit: invoke("app:quit"),
  getVersion: invoke("app:getVersion"),
  isMaximized: invoke("win:is-maximized"),
  openExternal: invoke("win:open-external"),
  getErrorLogPath: invoke<string | null>("win:get-error-log-path"),
  onMaximizeChange: registerHandler(maximizeHandlers),
  onWebviewKeydown: (callback) => {
    const handler = (
      _event: unknown,
      data: {
        key: string;
        code: string;
        ctrlKey: boolean;
        shiftKey: boolean;
        altKey: boolean;
        metaKey: boolean;
      },
    ) => callback(data);
    ipcRenderer.on("webview:keydown", handler);
    return () => {
      ipcRenderer.removeListener("webview:keydown", handler);
    };
  },
};

const configChangeHandlers = new Set<(config: Config) => void>();
const configErrorHandlers = new Set<(err: string | null) => void>();

ipcRenderer.on("config:changed", (_event, config: Config) => {
  configChangeHandlers.forEach((h) => h(config));
});

ipcRenderer.on("config:error", (_event, err: string | null) => {
  configErrorHandlers.forEach((h) => h(err));
});

const configApi: ConfigApi = {
  get: invoke("config:get"),
  set: invoke("config:set"),
  openInEditor: invoke("config:open-in-editor"),
  onChanged: registerHandler(configChangeHandlers),
  getError: invoke("config:get-error"),
  onError: registerHandler(configErrorHandlers),
};

const sysinfoHandlers = new Set<(data: unknown) => void>();
ipcRenderer.on("sysinfo:update", (_event, data: unknown) => {
  sysinfoHandlers.forEach((h) => h(data));
});

const sysinfoApi = {
  start: invoke("sysinfo:start"),
  stop: invoke("sysinfo:stop"),
  onUpdate: registerHandler(sysinfoHandlers),
};

const portsApi = {
  list: invoke("ports:list"),
  kill: (pid: number) => invoke<void>("ports:kill")(pid),
};

const workspaceApi = {
  getScripts: (cwd: string) => invoke<unknown>("workspace:getScripts")(cwd),
  listDir: (dirPath: string) => invoke<WorkspaceItem[]>("workspace:list-dir")(dirPath),
  searchFiles: (dirPath: string, query: string) =>
    invoke<Array<{ relativePath: string; absolutePath: string }>>("workspace:search-files")(dirPath, query),
  revealPath: (itemPath: string) => invoke<void>("workspace:reveal-path")(itemPath),
  readFileHead: (filePath: string) =>
    unwrap(invoke<string>("workspace:read-file-head")(filePath)),
  writeFile: (filePath: string, content: string) =>
    unwrap(invoke<void>("workspace:write-file")(filePath, content)),
  getGitStatus: (cwd: string) =>
    invoke<Record<string, "M" | "U" | "A" | "D">>("workspace:get-git-status")(cwd),
  getGitDiff: (cwd: string, filePath: string) =>
    invoke<string>("workspace:get-git-diff")(cwd, filePath),
};

const connectionsApi = {
  getSshHosts: () => invoke<unknown[]>("connections:get-ssh-hosts")(),
  getDockerContainers: () => invoke<unknown[]>("connections:get-docker")(),
};

interface IpcError {
  __ipcError: true;
  message: string;
}

const unwrap = async <T>(promise: Promise<T>): Promise<T> => {
  const res = (await promise) as T | IpcError;
  if (res && typeof res === "object" && "__ipcError" in res) {
    throw new Error((res as IpcError).message);
  }
  return res as T;
};

const sftpApi: SftpApi = {
  setTempPassword: (sshHostId: string, password: string) =>
    invoke<void>("sftp:set-temp-password")(sshHostId, password),
  listDir: (sshHostId: string, dirPath: string) =>
    unwrap(invoke<WorkspaceItem[]>("sftp:list-dir")(sshHostId, dirPath)),
  readFileHead: (sshHostId: string, filePath: string) =>
    unwrap(invoke<string>("sftp:read-file-head")(sshHostId, filePath)),
  writeFile: (sshHostId: string, filePath: string, content: string) =>
    unwrap(invoke<void>("sftp:write-file")(sshHostId, filePath, content)),
  getHomeDir: (sshHostId: string) =>
    unwrap(invoke<string>("sftp:get-home")(sshHostId)),
};

const historyApi: HistoryApi = {
  search: (query: string) => invoke<unknown[]>("history:search")(query),
  getSessions: () => invoke<unknown[]>("history:get-sessions")(),
  getSessionTranscript: (id: string) =>
    invoke<string>("history:get-session-transcript")(id),
  getScrollbackChunk: (id: string, beforeTimestamp: number) =>
    invoke<{ data: string; timestamp: number }[]>("history:get-scrollback-chunk")(
      id,
      beforeTimestamp,
    ),
  clear: () => invoke<void>("history:clear")(),
  deleteSession: (id: string) => invoke<void>("history:delete-session")(id),
  addBrowserVisit: (url: string, title: string) =>
    invoke<void>("history:add-browser-visit")(url, title),
  getBrowserHistory: () => invoke<unknown[]>("history:get-browser-history")(),
  searchBrowserHistory: (query: string) =>
    invoke<unknown[]>("history:search-browser-history")(query),
  deleteBrowserVisit: (id: number) =>
    invoke<void>("history:delete-browser-visit")(id),
  clearBrowserHistory: () => invoke<void>("history:clear-browser-history")(),
  getDbError: () => invoke<string | null>("history:get-db-error")(),
};

interface ClipboardItem {
  id: string;
  text: string;
  timestamp: number;
}

const clipboardApi = {
  getHistory: () =>
    invoke<ClipboardItem[]>("clipboard:get-history")(),
  setHistory: (items: ClipboardItem[]) =>
    invoke<void>("clipboard:set-history")(items),
};

const adblockerApi = {
  toggle: (enabled: boolean) => invoke<boolean>("adblocker:toggle")(enabled),
  getStats: (webContentsId: number) =>
    invoke<number>("adblocker:get-stats")(webContentsId),
  clearStats: (webContentsId: number) =>
    invoke<number>("adblocker:clear-stats")(webContentsId),
  onBlockedEvent: (
    callback: (
      event: unknown,
      data: { webContentsId: number; url: string; count: number },
    ) => void,
  ) => {
    ipcRenderer.on("adblocker:blocked-event", callback);
    return () => {
      ipcRenderer.removeListener("adblocker:blocked-event", callback);
    };
  },
  getHtmlReplaceRules: (url: string) =>
    invoke<unknown>("adblocker:get-html-replace-rules")(url),
  getAppPreloadPath: () =>
    invoke<string>("adblocker:get-app-preload-path")(),
};

type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "uptodate"
  | "downloading"
  | "downloaded"
  | "error";

const statusChangeHandlers = new Set<
  (status: UpdaterStatus, info?: UpdateInfo | string) => void
>();
const downloadProgressHandlers = new Set<(progress: UpdateProgress) => void>();

ipcRenderer.on(
  "updater:status",
  (_event, status: UpdaterStatus, info?: UpdateInfo | string) => {
    statusChangeHandlers.forEach((h) => h(status, info));
  },
);

ipcRenderer.on("updater:progress", (_event, progress: UpdateProgress) => {
  downloadProgressHandlers.forEach((h) => h(progress));
});

const updaterApi: UpdaterApi = {
  checkForUpdates: () =>
    invoke<{ success: boolean; error?: string }>("updater:check")(),
  downloadUpdate: () =>
    invoke<{ success: boolean; error?: string }>("updater:download")(),
  quitAndInstall: () =>
    invoke<{ success: boolean; error?: string }>("updater:install")(),
  simulateUpdate: () => invoke<void>("updater:simulate")(),
  onStatusChange: registerHandler(statusChangeHandlers),
  onDownloadProgress: registerHandler(downloadProgressHandlers),
};

contextBridge.exposeInMainWorld("terminalApi", terminalApi);
contextBridge.exposeInMainWorld("windowApi", windowApi);
contextBridge.exposeInMainWorld("configApi", configApi);
contextBridge.exposeInMainWorld("sysinfoApi", sysinfoApi);
contextBridge.exposeInMainWorld("portsApi", portsApi);
contextBridge.exposeInMainWorld("workspaceApi", workspaceApi);
contextBridge.exposeInMainWorld("connectionsApi", connectionsApi);
contextBridge.exposeInMainWorld("historyApi", historyApi);
contextBridge.exposeInMainWorld("clipboardApi", clipboardApi);
contextBridge.exposeInMainWorld("sftpApi", sftpApi);
contextBridge.exposeInMainWorld("adblockerApi", adblockerApi);
contextBridge.exposeInMainWorld("updaterApi", updaterApi);

