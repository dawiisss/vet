/**
 * @jest-environment node
 */

const mockWindowInstance = {
  id: 1,
  isDestroyed: jest.fn(() => false),
  webContents: {
    send: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    setWindowOpenHandler: jest.fn(),
  },
  close: jest.fn(),
  minimize: jest.fn(),
  maximize: jest.fn(),
  unmaximize: jest.fn(),
  isMaximized: jest.fn(() => false),
  setVibrancy: jest.fn(),
  on: jest.fn(),
  loadURL: jest.fn(),
}

let ipcHandleMock: jest.Mock
let ipcOnMock: jest.Mock

jest.mock('electron', () => {
  ipcHandleMock = jest.fn()
  ipcOnMock = jest.fn()
  const BrowserWindow = jest.fn(() => mockWindowInstance)
  BrowserWindow.fromWebContents = jest.fn(() => mockWindowInstance)
  BrowserWindow.getAllWindows = jest.fn(() => [mockWindowInstance])
  return {
    app: {
      getPath: jest.fn((_name: string) => '/mock/path'),
      whenReady: jest.fn(() => Promise.resolve()),
      on: jest.fn(),
      quit: jest.fn(),
    },
    BrowserWindow,
    ipcMain: { handle: ipcHandleMock, on: ipcOnMock },
    session: {
      defaultSession: {
        webRequest: {
          onHeadersReceived: jest.fn()
        }
      }
    }
  }
})

jest.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: jest.fn() },
  is: { dev: false },
}))

jest.mock('../main/pty', () => ({
  createTerminal: jest.fn(() => 'mock-terminal-id'),
  destroyTerminal: jest.fn(),
  writeToTerminal: jest.fn(),
  resizeTerminal: jest.fn(),
  setForwardTarget: jest.fn(),
  getTerminalInfo: jest.fn(() => Promise.resolve({ title: 'test', cwd: '/test' })),
  getHistory: jest.fn(() => ''),
}))

jest.mock('../main/config', () => ({
  initConfigManager: jest.fn(),
  getConfig: jest.fn(() => ({ shell: '/bin/bash', vibrancy: 'none' })),
  sanitizeConfig: jest.fn((c: any) => c),
}))

jest.mock('../main/session', () => ({
  initSessionManager: jest.fn(),
  getSessionData: jest.fn(),
}))

jest.mock('../main/sysinfo', () => ({
  initSysInfoManager: jest.fn(),
}))

jest.mock('../main/ports', () => ({
  initPortsManager: jest.fn(),
}))

jest.mock('../main/workspace', () => ({
  initWorkspaceManager: jest.fn(),
}))

jest.mock('../main/connections', () => ({
  initConnectionsManager: jest.fn(),
}))

jest.mock('../main/historyDb', () => ({
  initHistoryDb: jest.fn(),
  searchHistory: jest.fn(() => []),
  getHistorySessions: jest.fn(() => []),
  getSessionTranscript: jest.fn(() => ''),
  getScrollbackChunk: jest.fn(() => []),
  clearHistory: jest.fn(),
  deleteSession: jest.fn(),
}))

jest.mock('../main/adblocker', () => ({
  initAdblocker: jest.fn(() => Promise.resolve()),
}))

describe('main process index', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  it('registers all expected IPC handlers on app ready', async () => {
    require('../main/index')
    await new Promise((resolve) => setImmediate(resolve))

    const handleCalls = ipcHandleMock.mock.calls.map((c: string[]) => c[0])
    const onCalls = ipcOnMock.mock.calls.map((c: string[]) => c[0])
    const calls = [...handleCalls, ...onCalls]

    // Window control
    expect(calls).toContain('win:minimize')
    expect(calls).toContain('win:maximize')
    expect(calls).toContain('win:close')
    expect(calls).toContain('win:is-maximized')

    // Terminal
    expect(calls).toContain('terminal:create')
    expect(calls).toContain('terminal:enable-forwarding')
    expect(calls).toContain('terminal:write')
    expect(calls).toContain('terminal:resize')
    expect(calls).toContain('terminal:destroy')
    expect(calls).toContain('terminal:get-history')
    expect(calls).toContain('terminal:detach-tab')
    expect(calls).toContain('terminal:reattach-tab')
    expect(calls).toContain('terminal:get-info')

    // History
    expect(calls).toContain('history:search')
    expect(calls).toContain('history:get-sessions')
    expect(calls).toContain('history:get-session-transcript')
    expect(calls).toContain('history:get-scrollback-chunk')
    expect(calls).toContain('history:clear')
    expect(calls).toContain('history:delete-session')
  })

  it('initializes all sub-managers on app ready', async () => {
    require('../main/index')
    await new Promise((resolve) => setImmediate(resolve))

    const { initConfigManager } = require('../main/config')
    const { initSessionManager } = require('../main/session')
    const { initSysInfoManager } = require('../main/sysinfo')
    const { initPortsManager } = require('../main/ports')
    const { initWorkspaceManager } = require('../main/workspace')
    const { initConnectionsManager } = require('../main/connections')
    const { initHistoryDb } = require('../main/historyDb')
    const { initAdblocker } = require('../main/adblocker')

    expect(initConfigManager).toHaveBeenCalled()
    expect(initAdblocker).toHaveBeenCalled()
    expect(initSessionManager).toHaveBeenCalled()
    expect(initSysInfoManager).toHaveBeenCalled()
    expect(initPortsManager).toHaveBeenCalled()
    expect(initWorkspaceManager).toHaveBeenCalled()
    expect(initConnectionsManager).toHaveBeenCalled()
    expect(initHistoryDb).toHaveBeenCalled()
  })
})
