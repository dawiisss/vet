import { spawn } from 'node-pty'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs } from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { platform } from 'os'
import { getConfig } from './config'
import * as historyDb from './historyDb'
const execAsync = promisify(exec)

interface PtyProcess {
  pty: ReturnType<typeof spawn>
  id: string
}

const terminals: Map<string, PtyProcess> = new Map()
const forwardTargets: Map<string, (event: string, ...args: unknown[]) => void> = new Map()
const terminalHistories: Map<string, string> = new Map()
const terminalSshHosts: Map<string, string> = new Map()
const outputBuffers: Map<string, string> = new Map()
const outputTimeouts: Map<string, NodeJS.Timeout> = new Map()

export function setForwardTarget(terminalId: string, target: (event: string, ...args: unknown[]) => void): void {
  forwardTargets.set(terminalId, target)
}

export function removeForwardTarget(terminalId: string): void {
  forwardTargets.delete(terminalId)
}

export function getHistory(id: string): { data: string; oldestTimestamp: number } {
  const config = getConfig()
  if (config.historyLoggingEnabled === false) {
    return { data: terminalHistories.get(id) || '', oldestTimestamp: Date.now() }
  } else {
    const chunks = historyDb.getScrollbackChunk(id, Date.now() + 100000)
    if (!chunks || chunks.length === 0) {
      return { data: '', oldestTimestamp: Date.now() }
    }
    return {
      data: chunks.map(c => c.data).join(''),
      oldestTimestamp: chunks[0].timestamp
    }
  }
}

export function createTerminal(options: { cwd?: string, profileId?: string, sshHostId?: string }): string {
  const id = uuidv4()
  if (options.sshHostId) {
    terminalSshHosts.set(id, options.sshHostId)
  }
  const config = getConfig()
  
  let shell = process.env['SHELL'] || '/bin/bash'
  let args: string[] = []
  let env = { ...process.env } as Record<string, string>
  let cwd = options.cwd || process.cwd()
  
  if (options.sshHostId) {
    const host = (config.sshHosts || []).find((h: any) => h.id === options.sshHostId)
    if (host) {
      shell = 'ssh'
      args = []
      if (host.port) args.push('-p', String(host.port))
      if (host.authType === 'key' && host.privateKeyPath) {
        let keyPath = host.privateKeyPath
        if (keyPath.startsWith('~') && process.env.HOME) {
          keyPath = keyPath.replace(/^~/, process.env.HOME)
        }
        args.push('-i', keyPath)
      }
      args.push(`${host.username}@${host.host}`)
    }
  } else if (config.profiles && Array.isArray(config.profiles) && config.profiles.length > 0) {
    const profile = config.profiles.find((p: any) => p.id === options.profileId) || config.profiles[0]
    if (profile) {
      if (profile.shell) shell = profile.shell
      if (profile.args) args = profile.args
      if (profile.env) env = { ...env, ...profile.env }
      if (profile.cwd && !options.cwd) cwd = profile.cwd
    }
  }

  // Handle ~ in cwd manually
  if (cwd.startsWith('~') && process.env.HOME) {
    cwd = cwd.replace(/^~/, process.env.HOME)
  }

  const pty = spawn(shell, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env
  })

  let connectionType = 'local'
  let connectionTarget = 'localhost'
  
  if (shell.endsWith('ssh')) {
    connectionType = 'ssh'
    connectionTarget = args[0] || 'remote'
  } else if (shell.endsWith('docker') && args[0] === 'exec') {
    connectionType = 'docker'
    connectionTarget = args[args.indexOf('-it') + 1] || 'container'
  }

  historyDb.startSession(id, `${path.basename(cwd)} : ${path.basename(shell)}`, connectionType, connectionTarget)

  pty.onData((data: string) => {
    outputBuffers.set(id, (outputBuffers.get(id) || '') + data)
    if (!outputTimeouts.has(id)) {
      outputTimeouts.set(id, setTimeout(() => {
        const bufferedData = outputBuffers.get(id)
        if (bufferedData) {
          const history = terminalHistories.get(id) || ''
          terminalHistories.set(id, (history + bufferedData).slice(-100000))
          historyDb.logOutput(id, bufferedData)
          
          const target = forwardTargets.get(id)
          if (target) {
            target('terminal:data', { id, data: bufferedData })
          }
        }
        outputBuffers.delete(id)
        outputTimeouts.delete(id)
      }, 10))
    }
  })

  pty.onExit(({ exitCode }: { exitCode: number }) => {
    const timeout = outputTimeouts.get(id)
    if (timeout) {
      clearTimeout(timeout)
      outputTimeouts.delete(id)
    }
    const bufferedData = outputBuffers.get(id)
    if (bufferedData) {
      const target = forwardTargets.get(id)
      if (target) {
        target('terminal:data', { id, data: bufferedData })
      }
      historyDb.logOutput(id, bufferedData)
    }
    outputBuffers.delete(id)

    const target = forwardTargets.get(id)
    if (target) {
      target('terminal:exit', { id, exitCode })
    }
    historyDb.closeSession(id)
    terminals.delete(id)
    forwardTargets.delete(id)
  })

  terminals.set(id, { pty, id })
  return id
}

export function writeToTerminal(id: string, data: string): void {
  const terminal = terminals.get(id)
  if (terminal) {
    terminal.pty.write(data)
  }
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  const terminal = terminals.get(id)
  if (terminal) {
    terminal.pty.resize(cols, rows)
  }
}

export function destroyTerminal(id: string): void {
  const terminal = terminals.get(id)
  if (terminal) {
    const timeout = outputTimeouts.get(id)
    if (timeout) {
      clearTimeout(timeout)
      outputTimeouts.delete(id)
    }
    outputBuffers.delete(id)

    terminal.pty.kill()
    historyDb.closeSession(id)
    terminals.delete(id)
    forwardTargets.delete(id)
    terminalHistories.delete(id)
    terminalSshHosts.delete(id)
  }
}

export async function getTerminalInfo(id: string): Promise<{ title: string; cwd: string; sshHostId?: string }> {
  const terminal = terminals.get(id)
  const sshHostId = terminalSshHosts.get(id)
  if (!terminal) return { title: 'Terminal', cwd: '', sshHostId }

  let cwd = ''
  let dynamicSshTarget = ''
  let finalProcName = path.basename(terminal.pty.process || 'shell')

  try {
    if (platform() === 'linux' || platform() === 'darwin') {
      // Find foreground process group
      const { stdout: tpgidOut } = await execAsync(`ps -o tpgid= -p ${terminal.pty.pid}`)
      const tpgid = tpgidOut.trim()
      if (tpgid && tpgid !== String(terminal.pty.pid)) {
        const { stdout: pgrepOut } = await execAsync(`pgrep -g ${tpgid}`)
        const pids = pgrepOut.trim().split('\n').filter(Boolean)
        if (pids.length > 0) {
          const { stdout: psOut } = await execAsync(`ps -o comm=,args= -p ${pids.join(',')}`)
          const lines = psOut.trim().split('\n')
          for (const line of lines) {
            const cmd = line.trim()
            if (!cmd) continue
            const parts = cmd.split(/\s+/)
            const comm = parts[0]
            if (comm === 'ssh' || comm.endsWith('/ssh')) {
              finalProcName = 'ssh'
              const args = cmd.substring(comm.length).trim().split(/\s+/)
              for (let i = args.length - 1; i >= 0; i--) {
                if (!args[i].startsWith('-')) {
                  dynamicSshTarget = args[i]
                  break
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    // ignore
  }

  try {
    if (platform() === 'linux') {
      cwd = await fs.readlink(`/proc/${terminal.pty.pid}/cwd`)
    } else if (platform() === 'darwin') {
      const { stdout } = await execAsync(`lsof -a -d cwd -p ${terminal.pty.pid} -Fn`)
      const lines = stdout.split('\n')
      for (const line of lines) {
        if (line.startsWith('n')) {
          cwd = line.slice(1)
          break
        }
      }
    }
  } catch {
    // ignore
  }

  const resolvedCwd = cwd || process.cwd()
  const folder = resolvedCwd ? (resolvedCwd === '/' ? '/' : path.basename(resolvedCwd)) : '?'

  let effectiveSshHostId = sshHostId
  if (!effectiveSshHostId && dynamicSshTarget) {
    effectiveSshHostId = `auto-${dynamicSshTarget}`
  }

  return { title: `${folder} : ${finalProcName}`, cwd: resolvedCwd, sshHostId: effectiveSshHostId }
}
