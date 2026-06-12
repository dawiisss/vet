import { app, BrowserWindow, shell, ipcMain, safeStorage } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import chokidar from 'chokidar'
import JSON5 from 'json5'

function encryptField(value: string): string {
  if (!value) return value
  if (value.startsWith('encrypted:')) return value
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) return value
  try {
    const encrypted = safeStorage.encryptString(value)
    return 'encrypted:' + encrypted.toString('base64')
  } catch (err) {
    console.error('Failed to encrypt config field:', err)
    return value
  }
}

function decryptField(value: string): string {
  if (!value) return value
  if (!value.startsWith('encrypted:')) return value
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    console.warn('Encryption not available, cannot decrypt field')
    return value
  }
  try {
    const base64Data = value.substring('encrypted:'.length)
    const encryptedBuffer = Buffer.from(base64Data, 'base64')
    return safeStorage.decryptString(encryptedBuffer)
  } catch (err) {
    console.error('Failed to decrypt config field:', err)
    return ''
  }
}

const CONFIG_DIR = path.join(app.getPath('home'), '.config', 'vet')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json5')

const DEFAULT_CONFIG: any = {
  shell: process.env.SHELL || '/bin/bash',
  fontFamily: 'JetBrains Mono, "Fira Code", monospace',
  fontSize: 14,
  opacity: 1.0,
  vibrancy: 'none',
  webglEnabled: true,
  maxActiveTerminals: 4,
  sidebarPlacement: 'right',
  sidebarOpen: true,
  sidebarWidth: 250,
  clipboardHistoryKeepDays: 7,
  tabBarPosition: 'top',
  sshParseGlobal: true,
  sshHosts: [],
  dockerDefaultShell: '/bin/bash',
  theme: 'catppuccin-mocha',
  customThemes: {},
  cursorStyle: 'block',
  cursorBlink: true,
  historyLoggingEnabled: true,
  historyDatabaseLimitMb: 100,
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
    'ctrl+alt+u': 'split:unsplit',
    'alt+arrowright': 'pane:focus-next',
    'alt+arrowleft': 'pane:focus-prev',
    'ctrl+shift+c': 'terminal:copy',
    'ctrl+shift+v': 'terminal:paste',
    'ctrl+f': 'terminal:search',
    'ctrl+,': 'settings:toggle',
    'ctrl+shift+p': 'command-palette:toggle',
    'ctrl+shift+f': 'app:toggle-fullscreen',
    'ctrl+shift+m': 'app:maximize',
    'ctrl+q': 'app:quit'
  },
  browserHomepage: 'https://duckduckgo.com',
  browserSearchEngine: 'duckduckgo',
  browserAdblockEnabled: true,
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

  if (sanitized.tabBarPosition !== 'top' && sanitized.tabBarPosition !== 'left' && sanitized.tabBarPosition !== 'right') {
    sanitized.tabBarPosition = 'top'
  }

  if (typeof sanitized.sidebarWidth !== 'number' || isNaN(sanitized.sidebarWidth)) {
    sanitized.sidebarWidth = 250
  } else {
    sanitized.sidebarWidth = Math.max(150, Math.min(600, sanitized.sidebarWidth))
  }

  if (typeof sanitized.clipboardHistoryKeepDays !== 'number' || isNaN(sanitized.clipboardHistoryKeepDays)) {
    sanitized.clipboardHistoryKeepDays = 7
  } else {
    sanitized.clipboardHistoryKeepDays = Math.max(1, Math.min(365, sanitized.clipboardHistoryKeepDays))
  }

  if (sanitized.browserAdblockEnabled === undefined) {
    sanitized.browserAdblockEnabled = true
  }
  if (!sanitized.browserHomepage || typeof sanitized.browserHomepage !== 'string') {
    sanitized.browserHomepage = 'https://duckduckgo.com'
  }
  if (sanitized.browserSearchEngine !== 'duckduckgo' && sanitized.browserSearchEngine !== 'google' && sanitized.browserSearchEngine !== 'bing') {
    sanitized.browserSearchEngine = 'duckduckgo'
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
    const sanitized = sanitizeConfig({ ...DEFAULT_CONFIG, ...parsed })
    
    // Decrypt passwords and passphrases in the loaded config
    if (sanitized.sshHosts && Array.isArray(sanitized.sshHosts)) {
      for (const h of sanitized.sshHosts) {
        if (h.password) {
          h.password = decryptField(h.password)
        }
        if (h.passphrase) {
          h.passphrase = decryptField(h.passphrase)
        }
      }
    }
    
    currentConfig = sanitized
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
    // Clone config to encrypt passwords for saving without modifying the in-memory config
    const configToSave = JSON.parse(JSON.stringify(currentConfig))
    if (configToSave.sshHosts && Array.isArray(configToSave.sshHosts)) {
      for (const h of configToSave.sshHosts) {
        if (h.password) {
          h.password = encryptField(h.password)
        }
        if (h.passphrase) {
          h.passphrase = encryptField(h.passphrase)
        }
      }
    }
    const content = JSON5.stringify(configToSave, null, 2)
    await fs.writeFile(CONFIG_FILE, content, 'utf-8')
  } catch (e) {
    console.error('Failed to save config file:', e)
  }
}

export function getConfig() {
  return currentConfig
}
