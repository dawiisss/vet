interface ThemeConfig {
  background: string
  foreground: string
  cursor: string
  selection: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

interface Profile {
  id: string
  name: string
  shell: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
}

interface Config {
  shell: string
  fontFamily: string
  fontSize: number
  opacity: number
  theme: string | ThemeConfig
  customThemes?: Record<string, ThemeConfig>
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  historyLoggingEnabled: boolean
  historyDatabaseLimitMb: number
  historyKeepDays: number
  virtualScrollbackEnabled: boolean
  virtualScrollbackBufferSize: number
  keybindings: Record<string, string>
  sidebarPlacement?: 'left' | 'right'
  sidebarOpen?: boolean
  sshParseGlobal?: boolean
  sshHosts?: Array<{ name: string; command: string }>
  dockerDefaultShell?: string
  profiles?: Profile[]
}

interface TerminalApi {
  create: (opts?: { cwd?: string; profileId?: string }) => Promise<{ id: string }>
  enableForwarding: (id: string) => Promise<void>
  write: (id: string, data: string) => Promise<void>
  resize: (id: string, cols: number, rows: number) => Promise<void>
  getHistory: (id: string) => Promise<string>
  destroy: (id: string) => Promise<void>
  detachTab: (tabId: string, terminalIds: string[]) => Promise<{ success: boolean }>
  reattachTab: (terminalIds: string[]) => Promise<{ success: boolean }>
  onData: (callback: (id: string, data: string) => void) => () => void
  onExit: (callback: (id: string, exitCode: number) => void) => () => void
  onReattachTab: (callback: (terminalIds: string[]) => void) => () => void
  getTerminalInfo: (id: string) => Promise<{ title: string; cwd: string }>
  saveSession: (state: any) => Promise<void>
  getSession: () => Promise<any>
}

interface WindowApi {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (callback: (maximized: boolean) => void) => () => void
}

interface ConfigApi {
  get: () => Promise<Config>
  set: (partialConfig: Partial<Config>) => Promise<void>
  openInEditor: () => Promise<void>
  onChanged: (callback: (config: Config) => void) => () => void
}

interface HistoryApi {
  search: (query: string) => Promise<any[]>
  getSessions: () => Promise<any[]>
  getSessionTranscript: (id: string) => Promise<string>
  getScrollbackChunk: (id: string, beforeTimestamp: number) => Promise<{ data: string, timestamp: number }[]>
  clear: () => Promise<void>
  deleteSession: (id: string) => Promise<void>
}

interface WorkspaceItem {
  name: string
  isDirectory: boolean
  size: number
  ext: string
}

interface WorkspaceApi {
  getScripts: (cwd: string) => Promise<any>
  listDir: (dirPath: string) => Promise<WorkspaceItem[]>
  revealPath: (itemPath: string) => Promise<void>
  readFileHead: (filePath: string) => Promise<string>
}

interface Window {
  terminalApi: TerminalApi
  windowApi: WindowApi
  configApi: ConfigApi
  historyApi: HistoryApi
  workspaceApi: WorkspaceApi
  serializeAddons: Map<string, any>
}
