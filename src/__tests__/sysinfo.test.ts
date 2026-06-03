/**
 * @jest-environment node
 */

jest.mock('systeminformation', () => ({
  currentLoad: jest.fn(() => Promise.resolve({ currentLoad: 45.2 })),
  mem: jest.fn(() => Promise.resolve({ total: 16000000000, active: 8000000000 })),
}))

const mockWebContents = {
  send: jest.fn(),
}

const mockWindow = {
  isDestroyed: jest.fn(() => false),
  webContents: mockWebContents,
}

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  BrowserWindow: {},
}))

import { initSysInfoManager } from '../main/sysinfo'
import { ipcMain } from 'electron'
import si from 'systeminformation'

describe('sysinfo', () => {
  let startHandler: (...args: any[]) => any
  let stopHandler: (...args: any[]) => any
  let intervalCallback: (() => void) | null = null

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    jest.spyOn(global, 'setInterval').mockImplementation((fn) => {
      intervalCallback = fn as unknown as () => void
      return 1 as any
    })
    jest.spyOn(global, 'clearInterval').mockImplementation(jest.fn())

    mockWindow.isDestroyed.mockReturnValue(false)
    mockWebContents.send.mockClear()

    initSysInfoManager(mockWindow as any)

    const calls = (ipcMain.handle as jest.Mock).mock.calls
    startHandler = calls.find((c: string[]) => c[0] === 'sysinfo:start')?.[1]
    stopHandler = calls.find((c: string[]) => c[0] === 'sysinfo:stop')?.[1]
  })

  afterEach(() => {
    jest.useRealTimers()
    intervalCallback = null
  })

  describe('initSysInfoManager', () => {
    it('registers sysinfo:start handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('sysinfo:start', expect.any(Function))
    })

    it('registers sysinfo:stop handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('sysinfo:stop', expect.any(Function))
    })
  })

  describe('sysinfo:start', () => {
    it('starts polling and sends data', async () => {
      await startHandler()

      expect(setInterval).toHaveBeenCalled()

      await intervalCallback?.()
      await Promise.resolve().then(() => {})

      expect(si.currentLoad).toHaveBeenCalled()
      expect(si.mem).toHaveBeenCalled()
      expect(mockWebContents.send).toHaveBeenCalledWith('sysinfo:update', expect.objectContaining({
        cpu: 45.2,
        mem: expect.objectContaining({
          total: 16000000000,
          used: 8000000000,
        }),
      }))
    })

    it('clears previous interval when starting again', async () => {
      await startHandler()
      await startHandler()
      expect(clearInterval).toHaveBeenCalled()
    })

    it('does not send data when window is destroyed', async () => {
      mockWindow.isDestroyed.mockReturnValue(true)

      await startHandler()
      await intervalCallback?.()

      expect(mockWebContents.send).not.toHaveBeenCalled()
    })
  })

  describe('sysinfo:stop', () => {
    it('stops the polling interval', async () => {
      await stopHandler()
      expect(clearInterval).toHaveBeenCalled()
    })
  })
})
