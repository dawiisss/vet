import { contextBridge, ipcRenderer } from 'electron'



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
  write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', { id, data }),
  resize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
  getHistory: (id: string) => ipcRenderer.invoke('terminal:get-history', { id }),
  destroy: (id: string) => ipcRenderer.invoke('terminal:destroy', { id }),
  detachTab: (tabId: string, terminalIds: string[]) =>
    ipcRenderer.invoke('terminal:detach-tab', { tabId, terminalIds }),
  reattachTab: (terminalIds: string[]) =>
    ipcRenderer.invoke('terminal:reattach-tab', { terminalIds }),
  getTerminalInfo: (id: string) => ipcRenderer.invoke('terminal:get-info', { id }),
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
  close: () => ipcRenderer.invoke('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
  onMaximizeChange: (callback) => {
    maximizeHandlers.add(callback)
    return () => maximizeHandlers.delete(callback)
  }
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

contextBridge.exposeInMainWorld('terminalApi', terminalApi)
contextBridge.exposeInMainWorld('windowApi', windowApi)
contextBridge.exposeInMainWorld('configApi', configApi)
contextBridge.exposeInMainWorld('sysinfoApi', sysinfoApi)
contextBridge.exposeInMainWorld('portsApi', portsApi)
contextBridge.exposeInMainWorld('workspaceApi', workspaceApi)
contextBridge.exposeInMainWorld('connectionsApi', connectionsApi)
contextBridge.exposeInMainWorld('historyApi', historyApi)
contextBridge.exposeInMainWorld('sftpApi', sftpApi)
