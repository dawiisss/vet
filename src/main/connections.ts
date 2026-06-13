import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import os from 'os'
import { getConfig } from './config'

const execFileAsync = promisify(execFile)

export interface ConnectionInfo {
  name: string
  command: string
  source: 'docker' | 'ssh_global' | 'ssh_app'
}

export function initConnectionsManager() {
  ipcMain.handle('connections:get-ssh-hosts', async (): Promise<ConnectionInfo[]> => {
    const config = getConfig()
    const hosts: ConnectionInfo[] = []

    if (config.sshParseGlobal) {
      try {
        const sshConfigPath = path.join(os.homedir(), '.ssh', 'config')
        const content = await fs.readFile(sshConfigPath, 'utf-8')
        const lines = content.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.toLowerCase().startsWith('host ') && !trimmed.toLowerCase().startsWith('host *')) {
            const hostNames = trimmed.substring(5).trim().split(/\s+/)
            for (const name of hostNames) {
              hosts.push({ name, command: `ssh ${name}`, source: 'ssh_global' })
            }
          }
        }
      } catch (err) {
        // Ignore if ~/.ssh/config does not exist
      }
    }

    if (config.sshHosts && Array.isArray(config.sshHosts)) {
      for (const h of config.sshHosts) {
        if (h.name && h.host && h.username) {
          const command = `ssh ${h.port ? `-p ${h.port} ` : ''}${h.username}@${h.host}`
          hosts.push({ id: h.id, name: h.name, command, source: 'ssh_app' })
        }
      }
    }

    // Deduplicate by name just in case
    const seen = new Set<string>()
    return hosts.filter(h => {
      if (seen.has(h.name)) return false
      seen.add(h.name)
      return true
    })
  })

  ipcMain.handle('connections:get-docker', async (): Promise<ConnectionInfo[]> => {
    try {
      const { stdout } = await execFileAsync('docker', ['ps', '--format', '{{.Names}}'])
      const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean)
      const config = getConfig()
      const shell = config.dockerDefaultShell || '/bin/bash'
      
      return lines.map(name => ({
        name,
        command: `docker exec -it ${name} ${shell}`,
        source: 'docker'
      }))
    } catch (err) {
      // Ignore if docker is not installed or not running
      return []
    }
  })
}
