import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const execAsync = promisify(exec)

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
        const { stdout } = await execAsync('netstat -ano | findstr LISTENING')
        // Windows netstat output:
        //  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1144
        const lines = stdout.split('\n').filter(l => l.trim())
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
        const { stdout } = await execAsync('lsof -iTCP -sTCP:LISTEN -P -n')
        // lsof output:
        // COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
        // node    12345 user   23u  IPv6 0x...      0t0  TCP *:3000 (LISTEN)
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

  ipcMain.handle('ports:kill', async (_, pid: number) => {
    try {
      const isWin = os.platform() === 'win32'
      if (isWin) {
        await execAsync(`taskkill /F /PID ${pid}`)
      } else {
        await execAsync(`kill -9 ${pid}`)
      }
      return true
    } catch (err) {
      console.error(`Failed to kill pid ${pid}`, err)
      return false
    }
  })
}
