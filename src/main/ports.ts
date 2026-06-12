import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const execFileAsync = promisify(execFile)

export interface PortInfo {
  port: number
  process: string
  pid: number
}

export function initPortsManager() {
  ipcMain.handle('ports:list', async (): Promise<PortInfo[]> => {
    try {
      const isWin = os.platform() === 'win32'
      if (isWin) {
        const { stdout } = await execFileAsync('netstat', ['-ano'])
        const lines = stdout.split('\n').filter(l => l.trim() && l.includes('LISTENING'))
        const ports: PortInfo[] = []
        for (const line of lines) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 5) {
            const localAddress = parts[1]
            const portMatch = localAddress.match(/:(\d+)$/)
            const port = portMatch ? parseInt(portMatch[1]) : null
            const pid = parseInt(parts[4])
            if (port && pid && !isNaN(pid)) {
              ports.push({ port, pid, process: 'Unknown (Win)' })
            }
          }
        }
        return ports
      } else {
        const { stdout } = await execFileAsync('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n'])
        const lines = stdout.split('\n').filter(l => l.trim()).slice(1) // skip header
        const ports: PortInfo[] = []
        for (const line of lines) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 9) {
            const command = parts[0]
            const pid = parseInt(parts[1])
            const nameField = parts.slice(8).join(' ')
            const portMatch = nameField.match(/:(\d+)\s*\(LISTEN\)/)
            if (portMatch) {
              const port = parseInt(portMatch[1])
              ports.push({ port, pid, process: command })
            }
          }
        }
        return ports
      }
    } catch (err) {
      console.error('Failed to list ports', err)
      return []
    }
  })

  async function getListeningPids(): Promise<Set<number>> {
    const pids = new Set<number>()
    try {
      const isWin = os.platform() === 'win32'
      if (isWin) {
        const { stdout } = await execFileAsync('netstat', ['-ano'])
        const lines = stdout.split('\n').filter(l => l.trim())
        for (const line of lines) {
          if (!line.includes('LISTENING')) continue
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 5) {
            const pid = parseInt(parts[4])
            if (pid && !isNaN(pid)) {
              pids.add(pid)
            }
          }
        }
      } else {
        const { stdout } = await execFileAsync('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n'])
        const lines = stdout.split('\n').filter(l => l.trim()).slice(1) // skip header
        for (const line of lines) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 9) {
            const pid = parseInt(parts[1])
            if (pid && !isNaN(pid)) {
              pids.add(pid)
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to list listening PIDs', err)
    }
    return pids
  }

  ipcMain.handle('ports:kill', async (_, pid: number) => {
    try {
      const numericPid = Number(pid)
      if (!Number.isInteger(numericPid) || numericPid <= 0) {
        console.error(`Invalid PID provided: ${pid}`)
        return false
      }

      // Restrict kill to listening PIDs only
      const listeningPids = await getListeningPids()
      if (!listeningPids.has(numericPid)) {
        console.error(`Attempted to kill unauthorized PID: ${numericPid}`)
        return false
      }

      // Try SIGTERM first, then SIGKILL
      try {
        process.kill(numericPid, 'SIGTERM')
        // Wait briefly for process to exit
        await new Promise(resolve => setTimeout(resolve, 500))
        // Verify if it is still alive
        try {
          process.kill(numericPid, 0)
          // Still alive, force kill
          process.kill(numericPid, 'SIGKILL')
        } catch {
          // Already exited or permission error
        }
      } catch {
        // Fallback to SIGKILL
        process.kill(numericPid, 'SIGKILL')
      }
      return true
    } catch (err) {
      console.error(`Failed to kill pid ${pid}`, err)
      return false
    }
  })
}
