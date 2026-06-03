import { app, ipcMain } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { existsSync, mkdirSync } from 'fs'

const CONFIG_DIR = join(homedir(), '.config', 'vet')
const SESSION_FILE = join(CONFIG_DIR, 'session.json')

let sessionState: any = null

export function initSessionManager() {
  if (!existsSync(CONFIG_DIR)) {
    try {
      mkdirSync(CONFIG_DIR, { recursive: true })
    } catch {}
  }

  ipcMain.handle('session:save', async (_event, state: any) => {
    sessionState = state
  })

  ipcMain.handle('session:get', async () => {
    return await getSessionData()
  })

  app.on('before-quit', () => {
    if (sessionState) {
      try {
        const fsSync = require('fs')
        fsSync.writeFileSync(SESSION_FILE, JSON.stringify(sessionState))
      } catch (err) {
        console.error('Failed to save session on quit', err)
      }
    }
  })
}

export async function getSessionData(): Promise<any | null> {
  try {
    const content = await fs.readFile(SESSION_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}
