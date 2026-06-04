import { app, BrowserWindow, shell, ipcMain } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import chokidar from 'chokidar'
import JSON5 from 'json5'

const CONFIG_DIR = path.join(app.getPath('home'), '.config', 'vet')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json5')

const DEFAULT_CONFIG: any = {
  shell: process.env.SHELL || '/bin/bash',
  fontFamily: 'JetBrains Mono, "Fira Code", monospace',
  fontSize: 14,
  opacity: 1.0,
  vibrancy: 'none',
  webglEnabled: true,
  sidebarPlacement: 'right',
  sidebarOpen: true,
  sshParseGlobal: true,
  sshHosts: [],
  dockerDefaultShell: '/bin/bash',
  theme: 'catppuccin-mocha',
  customThemes: {},
  cursorStyle: 'block',
  cursorBlink: true,
  historyLoggingEnabled: true,
  historyDatabaseLimitMb: 500,
  historyKeepDays: 30,
  virtualScrollbackEnabled: true,
  virtualScrollbackBufferSize: 1000,
  keybindings: {
    'ctrl+b': 'sidebar:toggle',
    'ctrl+shift+t': 'tab:new',
    'ctrl+shift+w': 'tab:close',
    'ctrl+tab': 'tab:next',
    'ctrl+shift+tab': 'tab:prev',
    'ctrl+shift+e': 'split:extract',
    'ctrl+shift+\\': 'split:horizontal',
    'ctrl+shift+d': 'split:vertical',
    'alt+arrowright': 'pane:focus-next',
    'alt+arrowleft': 'pane:focus-prev',
    'ctrl+shift+c': 'terminal:copy',
    'ctrl+shift+v': 'terminal:paste',
    'ctrl+f': 'terminal:search',
    'ctrl+,': 'settings:toggle',
    'ctrl+shift+p': 'command-palette:toggle',
  },
  profiles: [
    {
      id: "default",
      name: "Default Shell",
      shell: process.env.SHELL || '/bin/bash',
      args: [],
      cwd: "~"
    },
    {
      id: "node",
      name: "Node.js REPL",
      shell: "node",
      args: [],
      cwd: "~"
    },
    {
      id: "python",
      name: "Python REPL",
      shell: "python3",
      args: [],
      cwd: "~"
    }
  ]
}

let currentConfig: any = { ...DEFAULT_CONFIG }
let watcher: chokidar.FSWatcher | null = null

export function sanitizeConfig(conf: any): any {
  const sanitized = { ...conf }
  
  if (!sanitized.customThemes || typeof sanitized.customThemes !== 'object') {
    sanitized.customThemes = {}
  }
  
  if (!sanitized.keybindings || typeof sanitized.keybindings !== 'object') {
    sanitized.keybindings = { ...DEFAULT_CONFIG.keybindings }
  } else {
    const currentActions = new Set(Object.values(sanitized.keybindings))
    for (const [key, action] of Object.entries(DEFAULT_CONFIG.keybindings)) {
      if (!currentActions.has(action as string) && !sanitized.keybindings[key]) {
        sanitized.keybindings[key] = action
      }
    }
  }
  
  if (!sanitized.sshHosts || !Array.isArray(sanitized.sshHosts)) {
    sanitized.sshHosts = []
  } else {
    sanitized.sshHosts = sanitized.sshHosts.map((h: any, idx: number) => {
      if (!h.id) {
        h.id = `ssh-${Date.now()}-${idx}`
      }
      return h
    })
  }

  if (!sanitized.profiles || !Array.isArray(sanitized.profiles) || sanitized.profiles.length === 0) {
    sanitized.profiles = [ ...DEFAULT_CONFIG.profiles ]
  } else {
    sanitized.profiles = sanitized.profiles.map((p: any, idx: number) => {
      const id = String(p.id || `profile-${idx}`)
      const name = String(p.name || `Profile ${idx}`)
      const shell = String(p.shell || DEFAULT_CONFIG.shell)
      const args = Array.isArray(p.args) ? p.args.map(String) : []
      const cwd = p.cwd ? String(p.cwd) : '~'
      const env = p.env && typeof p.env === 'object' ? p.env : undefined
      return { id, name, shell, args, cwd, ...(env ? { env } : {}) }
    })

    const seen = new Set<string>()
    sanitized.profiles = sanitized.profiles.filter((p: any) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    if (sanitized.profiles.length === 0) {
      sanitized.profiles = [ ...DEFAULT_CONFIG.profiles ]
    }
  }
  return sanitized
}

export async function initConfigManager(mainWindow: BrowserWindow) {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
  } catch (e) {
    console.error('Failed to create config dir', e)
  }

  // Load or create config
  await loadConfig()

  // Watch for changes
  watcher = chokidar.watch(CONFIG_FILE, {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  })

  watcher.on('change', async () => {
    try {
      const success = await loadConfig()
      if (success && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('config:changed', currentConfig)
      }
    } catch (e) {
      console.error('Error reloading config:', e)
    }
  })

  // IPC Handlers
  ipcMain.handle('config:get', () => currentConfig)
  
  ipcMain.handle('config:set', async (_event, partialConfig: any) => {
    currentConfig = sanitizeConfig({ ...currentConfig, ...partialConfig })
    await saveConfig()
    // The chokidar watcher will detect the save and emit to renderer.
    // However, to ensure immediate response, we can also return it or send it directly.
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('config:changed', currentConfig)
    }
  })

  ipcMain.handle('config:open-in-editor', async () => {
    await shell.openExternal(`file://${CONFIG_FILE}`)
  })
}

async function loadConfig(): Promise<boolean> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8')
    const parsed = JSON5.parse(raw)
    currentConfig = sanitizeConfig({ ...DEFAULT_CONFIG, ...parsed })
    return true
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      // File doesn't exist, create it
      await saveConfig()
      return true
    }
    console.error('Failed to parse config file:', e)
    return false
  }
}

async function saveConfig(): Promise<void> {
  try {
    const content = JSON5.stringify(currentConfig, null, 2)
    await fs.writeFile(CONFIG_FILE, content, 'utf-8')
  } catch (e) {
    console.error('Failed to save config file:', e)
  }
}

export function getConfig() {
  return currentConfig
}
