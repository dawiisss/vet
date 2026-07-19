import { contextBridge, ipcRenderer, webFrame } from "electron";

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

// Bridge mouse events from the webview's main world to the host renderer
// so tab drag-and-drop works over browser panes.
window.addEventListener("message", (e) => {
  try {
    if (e.data && e.data.__vetMouse) {
      ipcRenderer.sendToHost("vet-mouse", e.data.__vetMouse, e.data);
    }
  } catch { /* intentional ignore */ }
});

// Inject XHR/fetch interceptor into main world before any page scripts execute.
// webFrame.executeJavaScript runs synchronously in the main world; this preload
// runs before HTML parsing, so the interceptor is in place before inline <script> tags.
webFrame.executeJavaScript(`
(function() {
  if (window.__adblockHtmlInstalled) return
  window.__adblockHtmlInstalled = true

  var ruleCache = new Map()
  var RULE_CACHE_MAX = 500
  var pruneKeys = ['adPlacements', 'adSlots']

  // Intercept YouTube window globals the moment inline scripts set them
  ;['ytInitialPlayerResponse','ytInitialData','ytcfg'].forEach(function(name) {
    try {
      var v = window[name]
      var d = Object.getOwnPropertyDescriptor(window, name)
      if (d && d.set) return
      var _v = v
      Object.defineProperty(window, name, {
        get: function(){return _v},
        set: function(val){
          try { if (val && typeof val === 'object') pruneKeysDeep(val, pruneKeys) } catch(_){}
          _v = val
        },
        configurable:true, enumerable:true
      })
    } catch(_){}
  })

  // Immediate scan in case already set
  try { if (window.ytInitialPlayerResponse) pruneKeysDeep(window.ytInitialPlayerResponse, pruneKeys) } catch(_){}
  try { if (window.ytInitialData) pruneKeysDeep(window.ytInitialData, pruneKeys) } catch(_){}
  try { if (window.ytcfg) pruneKeysDeep(window.ytcfg, pruneKeys) } catch(_){}

  // Re-scan at DOMContentLoaded (server-rendered data is set by then)
  window.addEventListener('DOMContentLoaded', function() {
    try { if (window.ytInitialPlayerResponse) pruneKeysDeep(window.ytInitialPlayerResponse, pruneKeys) } catch(_){}
    try { if (window.ytInitialData) pruneKeysDeep(window.ytInitialData, pruneKeys) } catch(_){}
    try { if (window.ytcfg) pruneKeysDeep(window.ytcfg, pruneKeys) } catch(_){}
    try {
      if (window.ytInitialData && window.ytInitialData.contents &&
          window.ytInitialData.contents.twoColumnWatchNextResults) {
        pruneKeysDeep(window.ytInitialData.contents.twoColumnWatchNextResults, pruneKeys)
      }
    } catch(_){}
  }, { once: true })

  function cacheGet(key) {
    if (!ruleCache.has(key)) return
    var val = ruleCache.get(key)
    ruleCache.delete(key)
    ruleCache.set(key, val)
    return val
  }

  function cacheSet(key, value) {
    if (ruleCache.size >= RULE_CACHE_MAX) {
      var firstKey = ruleCache.keys().next().value
      ruleCache.delete(firstKey)
    }
    ruleCache.delete(key)
    ruleCache.set(key, value)
  }

  function getRules(url) {
    var c = cacheGet(url)
    if (c !== undefined) return Promise.resolve(c)
    if (!window.adblockerApi || !window.adblockerApi.getHtmlReplaceRules) return Promise.resolve({ pruneKeys: [], replaceRules: [] })
    return window.adblockerApi.getHtmlReplaceRules(url).then(function(r) {
      r = r || { pruneKeys: [], replaceRules: [] }
      cacheSet(url, r)
      return r
    }).catch(function(){ return { pruneKeys: [], replaceRules: [] } })
  }

  function pruneJsonKeys(text, keys) {
    if (!keys || !keys.length) return text
    try { var o = JSON.parse(text); pruneKeysDeep(o, keys); return JSON.stringify(o) } catch(_){ return text }
  }

  function pruneKeysDeep(obj, keys) {
    if (!obj || typeof obj !== 'object') return
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] in obj) { obj[keys[i]] = [] }
    }
    if (Array.isArray(obj)) {
      for (var j = 0; j < obj.length; j++) pruneKeysDeep(obj[j], keys)
    } else {
      for (var k in obj) { if (obj.hasOwnProperty(k)) pruneKeysDeep(obj[k], keys) }
    }
  }

  function applyRules(text, rules) {
    if (!rules || !rules.length) return text
    for (var i = 0; i < rules.length; i++) {
      try { text = text.replace(new RegExp(rules[i].regex, rules[i].flags), rules[i].replacement) } catch(_){}
    }
    return text
  }

  function isTextType(ct) {
    if (!ct) return true
    ct = ct.split(';')[0].trim().toLowerCase()
    return ct === 'text/html' || ct === 'application/json' ||
           ct === 'text/plain' || ct === 'application/javascript' ||
           ct === 'text/javascript' || ct === 'application/x-javascript'
  }

  function shouldIntercept(url) { return /^https?:\\/\\//i.test(url) }

  // Intercept fetch
  try {
    var origFetch = window.fetch
    window.fetch = function(input, init) {
      var url = ''
      try { if (typeof input === 'string') url = input; else if (input && input.url) url = input.url } catch(_){}
      if (!url || !shouldIntercept(url)) return origFetch.apply(this, arguments)
      var rp = getRules(url)
      return origFetch.apply(this, arguments).then(function(resp) {
        return rp.then(function(result) {
          var pk = result.pruneKeys || [], rr = result.replaceRules || []
          if (!pk.length && !rr.length) return resp
          if (!isTextType(resp.headers.get('content-type'))) return resp
          try {
            return resp.text().then(function(text) {
              if (pk.length) text = pruneJsonKeys(text, pk)
              if (rr.length) text = applyRules(text, rr)
              return new Response(text, { status: resp.status, statusText: resp.statusText, headers: resp.headers })
            }).catch(function(){ return resp })
          } catch(_){ return resp }
        })
      }).catch(function(){ return origFetch.apply(window, [input, init]) })
    }
  } catch(_){}

  // Intercept XMLHttpRequest
  try {
    var OrigXHR = XMLHttpRequest
    var origOpen = OrigXHR.prototype.open
    var origSend = OrigXHR.prototype.send
    OrigXHR.prototype.open = function(method, url) {
      try { this._abUrl = (typeof url === 'string') ? url : String(url) } catch(_){ this._abUrl = '' }
      this._abRules = null
      try { return origOpen.apply(this, arguments) } catch(_){}
    }
    OrigXHR.prototype.send = function() {
      var x = this, u = x._abUrl
      if (u && shouldIntercept(u)) getRules(u).then(function(r){ x._abRules = r })
      try { return origSend.apply(this, arguments) } catch(_){}
    }
    try {
      var desc = Object.getOwnPropertyDescriptor(OrigXHR.prototype, 'responseText')
      if (desc && desc.get) {
        var origGet = desc.get
        Object.defineProperty(OrigXHR.prototype, 'responseText', {
          get: function() {
            try {
              var t = origGet.call(this), r = this._abRules
              if (r && (r.pruneKeys || r.replaceRules)) {
                if (this._abMod === undefined) {
                  var m = t
                  if (r.pruneKeys && r.pruneKeys.length) m = pruneJsonKeys(m, r.pruneKeys)
                  if (r.replaceRules && r.replaceRules.length) m = applyRules(m, r.replaceRules)
                  this._abMod = m
                }
                return this._abMod
              }
              return t
            } catch(_){ return '' }
          },
          configurable: true
        })
      }
    } catch(_){}
  } catch(_){}

  // Forward mouse events to host so tab drag-and-drop works over this webview.
  // The webview's native window captures OS-level mouse events — they never reach
  // the renderer's document. Events dispatched on window fire on the isolated
  // world's proxy, which forwards them via sendToHost.
  document.addEventListener('mousemove', function(e) {
    try { window.dispatchEvent(new CustomEvent('__vet_mouse', { detail: { type: 'move', x: e.clientX, y: e.clientY } })) } catch(_){}
  }, { capture: true, passive: true })
  document.addEventListener('mouseup', function(e) {
    try { window.dispatchEvent(new CustomEvent('__vet_mouse', { detail: { type: 'up', x: e.clientX, y: e.clientY, button: e.button } })) } catch(_){}
  }, { capture: true })
})()
`);

// Bridge mouse events from the webview's main world to the host renderer
// so tab drag-and-drop works over browser panes.
window.addEventListener("__vet_mouse", (e: Event) => {
  try {
    const customEvent = e as CustomEvent;
    if (customEvent.detail) {
      ipcRenderer.sendToHost("vet-mouse", customEvent.detail);
    }
  } catch { /* intentional ignore */ }
});
