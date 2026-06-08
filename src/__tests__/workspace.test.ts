/**
 * @jest-environment node
 */

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  shell: { showItemInFolder: jest.fn() },
}))

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  open: jest.fn(),
}))

import { initWorkspaceManager } from '../main/workspace'
import { ipcMain } from 'electron'

describe('workspace', () => {

  let getScriptsHandler: (...args: any[]) => any
  let listDirHandler: (...args: any[]) => any
  let revealPathHandler: (...args: any[]) => any
  let readFileHeadHandler: (...args: any[]) => any

  beforeEach(() => {
    jest.clearAllMocks()
    initWorkspaceManager()
    const calls = (ipcMain.handle as jest.Mock).mock.calls
    getScriptsHandler = calls.find((c: string[]) => c[0] === 'workspace:getScripts')?.[1]
    listDirHandler = calls.find((c: string[]) => c[0] === 'workspace:list-dir')?.[1]
    revealPathHandler = calls.find((c: string[]) => c[0] === 'workspace:reveal-path')?.[1]
    readFileHeadHandler = calls.find((c: string[]) => c[0] === 'workspace:read-file-head')?.[1]
  })

  describe('initWorkspaceManager', () => {
    it('registers workspace:getScripts handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('workspace:getScripts', expect.any(Function))
    })

    it('registers workspace:list-dir handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('workspace:list-dir', expect.any(Function))
    })

    it('registers workspace:reveal-path handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('workspace:reveal-path', expect.any(Function))
    })

    it('registers workspace:read-file-head handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('workspace:read-file-head', expect.any(Function))
    })
  })

  describe('workspace:getScripts handler', () => {
    it('returns null when no package.json found', async () => {
      const fs = require('fs/promises')
      fs.readFile.mockRejectedValue({ code: 'ENOENT' })
      const result = await getScriptsHandler({}, '/some/dir')
      expect(result).toBeNull()
    })

    it('returns scripts from package.json', async () => {
      const fs = require('fs/promises')
      fs.readFile.mockResolvedValue(JSON.stringify({
        scripts: { dev: 'vite', build: 'vite build', test: 'jest' },
      }))
      const result = await getScriptsHandler({}, '/project')
      expect(result).toEqual({
        cwd: '/project',
        scripts: { dev: 'vite', build: 'vite build', test: 'jest' },
      })
    })

    it('walks up to parent directories to find package.json', async () => {
      const fs = require('fs/promises')
      let callCount = 0
      fs.readFile.mockImplementation(() => {
        callCount++
        if (callCount <= 2) return Promise.reject({ code: 'ENOENT' })
        return Promise.resolve(JSON.stringify({ scripts: { start: 'node app' } }))
      })
      const result = await getScriptsHandler({}, '/deep/nested/dir')
      expect(result).not.toBeNull()
      expect(result.scripts.start).toBe('node app')
    })

    it('returns null and logs error on unexpected top-level failure', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const cwdSpy = jest.spyOn(process, 'cwd').mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const result = await getScriptsHandler({}, undefined)

      expect(result).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('Failed to get workspace scripts', expect.any(Error))

      cwdSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })

  describe('workspace:list-dir handler', () => {
    it('lists directory contents sorted (dirs first)', async () => {
      const fs = require('fs/promises')
      fs.readdir.mockResolvedValue(['zzz.ts', 'aaa-folder', 'README.md'])
      fs.stat.mockImplementation(async (pathStr: string) => ({
        isDirectory: () => pathStr.includes('aaa-folder'),
        size: 100,
      }))

      const result = await listDirHandler({}, '/test')
      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('aaa-folder')
      expect(result[0].isDirectory).toBe(true)
    })

    it('skips .git and node_modules with no stat call', async () => {
      const fs = require('fs/promises')
      fs.readdir.mockResolvedValue(['src', '.git', 'node_modules'])
      fs.stat.mockResolvedValue({ isDirectory: () => false, size: 100 })

      const result = await listDirHandler({}, '/test')
      expect(result).toHaveLength(3)
      expect(result.find((i: any) => i.name === '.git')?.isDirectory).toBe(true)
      expect(result.find((i: any) => i.name === 'node_modules')?.isDirectory).toBe(true)
    })

    it('returns empty array on readdir error', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const fs = require('fs/promises')
      fs.readdir.mockRejectedValue(new Error('permission denied'))

      const result = await listDirHandler({}, '/test')
      expect(result).toEqual([])
      errorSpy.mockRestore()
    })
  })

  describe('workspace:reveal-path handler', () => {
    it('calls shell.showItemInFolder', async () => {
      const { shell } = require('electron')
      await revealPathHandler({}, '/path/to/file')
      expect(shell.showItemInFolder).toHaveBeenCalledWith('/path/to/file')
    })
  })

  describe('workspace:read-file-head handler', () => {
    it('reads first 50KB of file', async () => {
      const fs = require('fs/promises')
      const mockHandle = {
        read: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      }
      fs.open.mockResolvedValue(mockHandle)

      mockHandle.read.mockImplementation((buf: Buffer, _off: number, _len: number, _pos: number) => {
        buf.write('hello', 0, 5)
        return Promise.resolve({ bytesRead: 5 })
      })

      const result = await readFileHeadHandler({}, '/file.txt')
      expect(result).toBe('hello')
    })

    it('returns error message on failure', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const fs = require('fs/promises')
      fs.open.mockRejectedValue(new Error('access denied'))

      const result = await readFileHeadHandler({}, '/file.txt')
      expect(result).toContain('Error: Failed to read file')
      errorSpy.mockRestore()
    })
  })
})
