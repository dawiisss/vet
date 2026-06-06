/**
 * @jest-environment node
 */

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
}))

jest.mock('child_process', () => ({
  exec: jest.fn(),
}))

jest.mock('os', () => ({
  platform: jest.fn(() => 'linux'),
}))

import { initPortsManager } from '../main/ports'
import { ipcMain } from 'electron'

describe('ports', () => {

  let listHandler: (...args: any[]) => any
  let killHandler: (...args: any[]) => any

  beforeEach(() => {
    jest.clearAllMocks()
    initPortsManager()
    const calls = (ipcMain.handle as jest.Mock).mock.calls
    listHandler = calls.find((c: string[]) => c[0] === 'ports:list')?.[1]
    killHandler = calls.find((c: string[]) => c[0] === 'ports:kill')?.[1]
  })

  describe('initPortsManager', () => {
    it('registers ports:list handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('ports:list', expect.any(Function))
    })

    it('registers ports:kill handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('ports:kill', expect.any(Function))
    })
  })

  describe('ports:list handler (Linux)', () => {
    const lsofOutput = [
      'COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME',
      'node    12345 user   23u  IPv6 0x...      0t0  TCP *:3000 (LISTEN)',
      'nginx    6742 root    6u  IPv4 0x...      0t0  TCP *:80 (LISTEN)',
      'python   9901 user    3u  IPv6 0x...      0t0  TCP 127.0.0.1:8000 (LISTEN)',
    ].join('\n')

    it('parses lsof output into port info', async () => {
      const child = require('child_process')
      child.exec.mockImplementation((_cmd: string, cb: any) => {
        cb(null, { stdout: lsofOutput })
        return {}
      })
      
      const result = await listHandler()
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ port: 3000, pid: 12345, process: 'node' })
      expect(result[1]).toEqual({ port: 80, pid: 6742, process: 'nginx' })
    })

    it('returns empty array on exec error', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const child = require('child_process')
      child.exec.mockImplementation((_cmd: string, cb: any) => {
        cb(new Error('lsof not found'))
        return {}
      })
      
      const result = await listHandler()
      expect(result).toEqual([])
      errorSpy.mockRestore()
    })
  })

  describe('ports:kill handler', () => {
    beforeEach(() => {
      jest.spyOn(process, 'kill').mockImplementation(() => true)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('kills process by pid using process.kill', async () => {
      const result = await killHandler({}, 1234)
      expect(result).toBe(true)
      expect(process.kill).toHaveBeenCalledWith(1234, 'SIGKILL')
    })

    it('returns false on invalid pid', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const result = await killHandler({}, 'invalid; kill')
      expect(result).toBe(false)
      expect(process.kill).not.toHaveBeenCalled()
      errorSpy.mockRestore()
    })

    it('returns false on kill failure', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      jest.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('permission denied')
      })
      
      const result = await killHandler({}, 1234)
      expect(result).toBe(false)
      errorSpy.mockRestore()
    })
  })
})
