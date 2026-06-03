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

export function setForwardTarget(terminalId: string, target: (event: string, ...args: unknown[]) => void): void {
  forwardTargets.set(terminalId, target)
}

export function removeForwardTarget(terminalId: string): void {
  forwardTargets.delete(terminalId)
}

export function getHistory(id: string): string {
  return terminalHistories.get(id) || ''
}

export function createTerminal(options: { cwd?: string, profileId?: string }): string {
  const id = uuidv4()
  const config = getConfig()
  
  let shell = process.env['SHELL'] || '/bin/bash'
  let args: string[] = []
  let env = { ...process.env } as Record<string, string>
  let cwd = options.cwd || process.cwd()
  
  if (config.profiles && Array.isArray(config.profiles) && config.profiles.length > 0) {
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
    const history = terminalHistories.get(id) || ''
    terminalHistories.set(id, (history + data).slice(-100000))
    historyDb.logOutput(id, data)
    
    const target = forwardTargets.get(id)
    if (target) {
      target('terminal:data', { id, data })
    }
  })

  pty.onExit(({ exitCode }: { exitCode: number }) => {
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
    terminal.pty.kill()
    historyDb.closeSession(id)
    terminals.delete(id)
    forwardTargets.delete(id)
    terminalHistories.delete(id)
  }
}

export async function getTerminalInfo(id: string): Promise<{ title: string; cwd: string }> {
  const terminal = terminals.get(id)
  if (!terminal) return { title: 'Terminal', cwd: '' }

  let cwd = ''
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
  const procName = path.basename(terminal.pty.process || 'shell')

  return { title: `${folder} : ${procName}`, cwd: resolvedCwd }
}
