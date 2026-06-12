/**
 * @jest-environment node
 */

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
}))

const execFileMock = jest.fn()
jest.mock('child_process', () => ({
  execFile: execFileMock,
}))

jest.mock('os', () => ({
  homedir: jest.fn(() => '/mock/home'),
  platform: jest.fn(() => 'linux'),
}))

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}))

jest.mock('../main/config', () => ({
  getConfig: jest.fn(() => ({
    sshParseGlobal: true,
    sshHosts: [],
    dockerDefaultShell: '/bin/bash',
  })),
}))

import { initConnectionsManager } from '../main/connections'
import { ipcMain } from 'electron'

function mockExecCallback(stdout: string, error: Error | null = null) {
  execFileMock.mockImplementation((_file: string, _args: string[], cb: (...args: unknown[]) => void) => {
    if (cb && typeof cb === 'function') {
      cb(error, { stdout }, '')
      return undefined as any
    }
    return undefined as any
  })
}

describe('connections', () => {
  let sshHandler: (...args: any[]) => any
  let dockerHandler: (...args: any[]) => any

  beforeEach(() => {
    jest.clearAllMocks()
    initConnectionsManager()
    const calls = (ipcMain.handle as jest.Mock).mock.calls
    sshHandler = calls.find((c: string[]) => c[0] === 'connections:get-ssh-hosts')?.[1]
    dockerHandler = calls.find((c: string[]) => c[0] === 'connections:get-docker')?.[1]
  })

  describe('initConnectionsManager', () => {
    it('registers connections:get-ssh-hosts handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('connections:get-ssh-hosts', expect.any(Function))
    })

    it('registers connections:get-docker handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('connections:get-docker', expect.any(Function))
    })
  })

  describe('SSH hosts handler', () => {
    it('parses SSH config with Host blocks', async () => {
      const fs = require('fs/promises')
      fs.readFile.mockResolvedValue(`
Host myserver
  HostName 192.168.1.1
  User admin

Host dev-* gitlab.com
  User deploy
`)
      const result = await sshHandler()
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.some((h: any) => h.name === 'myserver')).toBe(true)
    })

    it('excludes Host * wildcard', async () => {
      const fs = require('fs/promises')
      fs.readFile.mockResolvedValue(`
Host *
  ForwardAgent yes

Host realserver
  HostName real.com
`)
      const result = await sshHandler()
      expect(result.find((h: any) => h.name === '*')).toBeUndefined()
      expect(result.find((h: any) => h.name === 'realserver')).toBeDefined()
    })

    it('returns empty array when SSH config is missing', async () => {
      const fs = require('fs/promises')
      fs.readFile.mockRejectedValue({ code: 'ENOENT' })
      const result = await sshHandler()
      expect(result).toEqual([])
    })

    it('deduplicates hosts by name', async () => {
      const config = require('../main/config')
      config.getConfig.mockReturnValue({
        sshParseGlobal: true,
        sshHosts: [{ name: 'myserver', command: 'ssh custom@myserver' }],
        dockerDefaultShell: '/bin/bash',
      })
      const fs = require('fs/promises')
      fs.readFile.mockResolvedValue('Host myserver\n  HostName 1.2.3.4')

      const result = await sshHandler()
      const myserverResults = result.filter((h: any) => h.name === 'myserver')
      expect(myserverResults).toHaveLength(1)
    })
  })

  describe('Docker containers handler', () => {
    it('parses docker ps output', async () => {
      mockExecCallback('web-app\nredis-cache\npostgres-db')

      const result = await dockerHandler()
      expect(result.length).toBeGreaterThanOrEqual(3)
      expect(result[0].name).toBe('web-app')
      expect(result[0].source).toBe('docker')
    })

    it('returns empty array when docker is not available', async () => {
      mockExecCallback('', new Error('docker not found'))

      const result = await dockerHandler()
      expect(result).toEqual([])
    })
  })
})
