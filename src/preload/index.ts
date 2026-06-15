import { contextBridge, ipcRenderer, webFrame } from 'electron'



const dataHandlers = new Set<(id: string, data: string) => void>()
const exitHandlers = new Set<(id: string, exitCode: number) => void>()
const reattachHandlers = new Set<(terminalIds: string[]) => void>()
const maximizeHandlers = new Set<(maximized: boolean) => void>()

ipcRenderer.on('terminal:data', (_event, { id, data }: { id: string; data: string }) => {
  dataHandlers.forEach((h) => h(id, data))
})

ipcRenderer.on('terminal:exit', (_event, { id, exitCode }: { id: string; exitCode: number }) => {
  exitHandlers.forEach((h) => h(id, exitCode))
})

ipcRenderer.on('terminal:reattach-tab', (_event, { terminalIds }: { terminalIds: string[] }) => {
  reattachHandlers.forEach((h) => h(terminalIds))
})

ipcRenderer.on('win:maximize-change', (_event, maximized: boolean) => {
  maximizeHandlers.forEach((h) => h(maximized))
})

const terminalApi: TerminalApi = {
  create: (opts?: { cwd?: string; forward?: boolean; isRestore?: boolean; profileId?: string; sshHostId?: string }) => ipcRenderer.invoke('terminal:create', opts || {}),
  enableForwarding: (id: string) => ipcRenderer.invoke('terminal:enable-forwarding', { id }),
  write: (id: string, data: string) => ipcRenderer.send('terminal:write', { id, data }),
  resize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
  getHistory: (id: string) => ipcRenderer.invoke('terminal:get-history', { id }),
  destroy: (id: string) => ipcRenderer.invoke('terminal:destroy', { id }),
  detachTab: (tabId: string, terminalIds: string[]) =>
    ipcRenderer.invoke('terminal:detach-tab', { tabId, terminalIds }),
  reattachTab: (terminalIds: string[]) =>
    ipcRenderer.invoke('terminal:reattach-tab', { terminalIds }),
  getTerminalInfo: (id: string) => ipcRenderer.invoke('terminal:get-info', { id }),
  setForeground: (ids: string[]) => ipcRenderer.invoke('terminal:set-foreground', { ids }),
  onData: (callback) => {
    dataHandlers.add(callback)
    return () => dataHandlers.delete(callback)
  },
  onExit: (callback) => {
    exitHandlers.add(callback)
    return () => exitHandlers.delete(callback)
  },
  onReattachTab: (callback) => {
    reattachHandlers.add(callback)
    return () => reattachHandlers.delete(callback)
  },
  saveSession: (state: any) => ipcRenderer.invoke('session:save', state),
  getSession: () => ipcRenderer.invoke('session:get')
}

const windowApi: WindowApi = {
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  toggleFullscreen: () => ipcRenderer.invoke('win:toggle-fullscreen'),
  close: () => ipcRenderer.invoke('win:close'),
  quit: () => ipcRenderer.invoke('app:quit'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
  openExternal: (url: string) => ipcRenderer.invoke('win:open-external', url),
  onMaximizeChange: (callback) => {
    maximizeHandlers.add(callback)
    return () => maximizeHandlers.delete(callback)
  },
  onWebviewKeydown: (callback) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('webview:keydown', handler)
    return () => {
      ipcRenderer.removeListener('webview:keydown', handler)
    }
  },
  setWebviewIgnoreMouseEvents: (wcId: number, ignore: boolean) =>
    ipcRenderer.invoke('webview:set-ignore-mouse-events', wcId, ignore)
}

const configChangeHandlers = new Set<(config: Config) => void>()

ipcRenderer.on('config:changed', (_event, config: Config) => {
  configChangeHandlers.forEach((h) => h(config))
})

const configApi: ConfigApi = {
  get: () => ipcRenderer.invoke('config:get'),
  set: (partialConfig: Partial<Config>) => ipcRenderer.invoke('config:set', partialConfig),
  openInEditor: () => ipcRenderer.invoke('config:open-in-editor'),
  onChanged: (callback) => {
    configChangeHandlers.add(callback)
    return () => configChangeHandlers.delete(callback)
  }
}

const sysinfoHandlers = new Set<(data: any) => void>()
ipcRenderer.on('sysinfo:update', (_event, data: any) => {
  sysinfoHandlers.forEach(h => h(data))
})

const sysinfoApi = {
  start: () => ipcRenderer.invoke('sysinfo:start'),
  stop: () => ipcRenderer.invoke('sysinfo:stop'),
  onUpdate: (callback: (data: any) => void) => {
    sysinfoHandlers.add(callback)
    return () => sysinfoHandlers.delete(callback)
  }
}

const portsApi = {
  list: () => ipcRenderer.invoke('ports:list'),
  kill: (pid: number) => ipcRenderer.invoke('ports:kill', pid)
}

const workspaceApi = {
  getScripts: (cwd: string) => ipcRenderer.invoke('workspace:getScripts', cwd),
  listDir: (dirPath: string) => ipcRenderer.invoke('workspace:list-dir', dirPath),
  revealPath: (itemPath: string) => ipcRenderer.invoke('workspace:reveal-path', itemPath),
  readFileHead: (filePath: string) => ipcRenderer.invoke('workspace:read-file-head', filePath)
}

const connectionsApi = {
  getSshHosts: () => ipcRenderer.invoke('connections:get-ssh-hosts'),
  getDockerContainers: () => ipcRenderer.invoke('connections:get-docker')
}

const unwrap = async (promise: Promise<any>) => {
  const res = await promise
  if (res && res.__ipcError) throw new Error(res.message)
  return res
}

const sftpApi: SftpApi = {
  setTempPassword: (sshHostId: string, password: string) => ipcRenderer.invoke('sftp:set-temp-password', sshHostId, password),
  listDir: (sshHostId: string, dirPath: string) => unwrap(ipcRenderer.invoke('sftp:list-dir', sshHostId, dirPath)),
  readFileHead: (sshHostId: string, filePath: string) => unwrap(ipcRenderer.invoke('sftp:read-file-head', sshHostId, filePath)),
  getHomeDir: (sshHostId: string) => unwrap(ipcRenderer.invoke('sftp:get-home', sshHostId))
}

const historyApi: HistoryApi = {
  search: (query: string) => ipcRenderer.invoke('history:search', query),
  getSessions: () => ipcRenderer.invoke('history:get-sessions'),
  getSessionTranscript: (id: string) => ipcRenderer.invoke('history:get-session-transcript', id),
  getScrollbackChunk: (id: string, beforeTimestamp: number) => ipcRenderer.invoke('history:get-scrollback-chunk', id, beforeTimestamp),
  clear: () => ipcRenderer.invoke('history:clear'),
  deleteSession: (id: string) => ipcRenderer.invoke('history:delete-session', id)
}

interface ClipboardItem {
  id: string
  text: string
  timestamp: number
}

const clipboardApi = {
  getHistory: () => ipcRenderer.invoke('clipboard:get-history') as Promise<ClipboardItem[]>,
  setHistory: (items: ClipboardItem[]) => ipcRenderer.invoke('clipboard:set-history', items)
}

const adblockerApi = {
  toggle: (enabled: boolean) => ipcRenderer.invoke('adblocker:toggle', enabled),
  getStats: (webContentsId: number) => ipcRenderer.invoke('adblocker:get-stats', webContentsId),
  clearStats: (webContentsId: number) => ipcRenderer.invoke('adblocker:clear-stats', webContentsId),
  onBlockedEvent: (callback: (event: any, data: { webContentsId: number; url: string; count: number }) => void) => {
    ipcRenderer.on('adblocker:blocked-event', callback)
    return () => {
      ipcRenderer.removeListener('adblocker:blocked-event', callback)
    }
  },
  getHtmlReplaceRules: (url: string) =>
    ipcRenderer.invoke('adblocker:get-html-replace-rules', url) as Promise<{
      pruneKeys: string[]
      replaceRules: Array<{ regex: string; flags: string; replacement: string }>
    }>,
  getAppPreloadPath: () => ipcRenderer.invoke('adblocker:get-app-preload-path') as Promise<string>
}

const statusChangeHandlers = new Set<(status: any, info?: any) => void>()
const downloadProgressHandlers = new Set<(progress: any) => void>()

ipcRenderer.on('updater:status', (_event, status, info) => {
  statusChangeHandlers.forEach((h) => h(status, info))
})

ipcRenderer.on('updater:progress', (_event, progress) => {
  downloadProgressHandlers.forEach((h) => h(progress))
})

const updaterApi: UpdaterApi = {
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  quitAndInstall: () => ipcRenderer.invoke('updater:install'),
  simulateUpdate: () => ipcRenderer.invoke('updater:simulate'),
  onStatusChange: (callback) => {
    statusChangeHandlers.add(callback)
    return () => statusChangeHandlers.delete(callback)
  },
  onDownloadProgress: (callback) => {
    downloadProgressHandlers.add(callback)
    return () => downloadProgressHandlers.delete(callback)
  }
}

contextBridge.exposeInMainWorld('terminalApi', terminalApi)
contextBridge.exposeInMainWorld('windowApi', windowApi)
contextBridge.exposeInMainWorld('configApi', configApi)
contextBridge.exposeInMainWorld('sysinfoApi', sysinfoApi)
contextBridge.exposeInMainWorld('portsApi', portsApi)
contextBridge.exposeInMainWorld('workspaceApi', workspaceApi)
contextBridge.exposeInMainWorld('connectionsApi', connectionsApi)
contextBridge.exposeInMainWorld('historyApi', historyApi)
contextBridge.exposeInMainWorld('clipboardApi', clipboardApi)
contextBridge.exposeInMainWorld('sftpApi', sftpApi)
contextBridge.exposeInMainWorld('adblockerApi', adblockerApi)
contextBridge.exposeInMainWorld('updaterApi', updaterApi)

// Bridge mouse events from the webview's main world to the host renderer
// so tab drag-and-drop works over browser panes.
window.addEventListener('message', (e) => {
  try {
    if (e.data && e.data.__vetMouse) {
      ipcRenderer.sendToHost('vet-mouse', e.data.__vetMouse, e.data)
    }
  } catch {}
})

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
      try {
        if (!rules[i]._compiledRegex) {
          rules[i]._compiledRegex = new RegExp(rules[i].regex, rules[i].flags)
        }
        text = text.replace(rules[i]._compiledRegex, rules[i].replacement)
      } catch(_){}
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
`)

// Bridge mouse events from the webview's main world to the host renderer
// so tab drag-and-drop works over browser panes.
window.addEventListener('__vet_mouse', (e: any) => {
  try {
    if (e.detail) {
      ipcRenderer.sendToHost('vet-mouse', e.detail)
    }
  } catch {}
})
