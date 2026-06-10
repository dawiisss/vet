jest.mock('electron', () => ({
  app: {
    on: jest.fn(),
    getPath: jest.fn(() => '/mock/home'),
  },
  ipcMain: {
    handle: jest.fn(),
  },
}))

jest.mock('os', () => ({
  homedir: jest.fn(() => '/mock/home'),
}))

const mockWriteFileSync = jest.fn()
const mockReadFile = jest.fn()

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}))

import { initSessionManager, getSessionData } from '../main/session'

describe('session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const fs = require('fs')
    fs.existsSync.mockReturnValue(true)
    mockReadFile.mockReset()
    mockWriteFileSync.mockReset()
  })

  describe('initSessionManager', () => {
    it('creates config directory if it does not exist', () => {
      const fs = require('fs')
      fs.existsSync.mockReturnValue(false)
      initSessionManager()
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('vet'),
        { recursive: true }
      )
    })

    it('registers session:save handler', () => {
      initSessionManager()
      const { ipcMain } = require('electron')
      expect(ipcMain.handle).toHaveBeenCalledWith('session:save', expect.any(Function))
    })

    it('registers session:get handler', () => {
      initSessionManager()
      const { ipcMain } = require('electron')
      expect(ipcMain.handle).toHaveBeenCalledWith('session:get', expect.any(Function))
    })

    it('registers before-quit handler', () => {
      initSessionManager()
      const { app } = require('electron')
      expect(app.on).toHaveBeenCalledWith('before-quit', expect.any(Function))
    })
  })

  describe('getSessionData', () => {
    it('returns null when file does not exist', async () => {
      const fs_ = require('fs')
      fs_.promises.readFile.mockRejectedValue({ code: 'ENOENT' })
      const result = await getSessionData()
      expect(result).toBeNull()
    })

    it('returns parsed JSON when file exists', async () => {
      const fs_ = require('fs')
      fs_.promises.readFile.mockResolvedValue(JSON.stringify({ tabs: [{ id: 't1' }] }))
      const result = await getSessionData()
      expect(result).toEqual({ tabs: [{ id: 't1' }] })
    })

    it('returns null on JSON parse error', async () => {
      const fs_ = require('fs')
      fs_.promises.readFile.mockResolvedValue('not json')
      const result = await getSessionData()
      expect(result).toBeNull()
    })
  })
})
