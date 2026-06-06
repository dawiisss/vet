jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test-vet-history'),
  },
}))

jest.mock('../main/config', () => ({
  getConfig: jest.fn(() => ({
    historyLoggingEnabled: true,
    historyDatabaseLimitMb: 500,
    historyKeepDays: 30,
  })),
}))

import {
  initHistoryDb,
  startSession,
  closeSession,
  logOutput,
  searchHistory,
  getSessionDetails,
  getSessionTranscript,
  getScrollbackChunk,
  clearHistory,
  deleteSession,
  getHistorySessions,
  cleanupHistoryDb} from '../main/historyDb'

describe('historyDb', () => {
  beforeAll(() => {
    initHistoryDb()
  })

  afterAll(() => {
    clearHistory()
    cleanupHistoryDb()
  })

  describe('startSession', () => {
    const sessionId = 'test-session-1'

    it('creates a session record', () => {
      startSession(sessionId, 'Test Session', 'local', 'localhost')
      const sessions = getHistorySessions()
      const found = sessions.filter((s: any) => s.id === sessionId)
      expect(found).toHaveLength(1)
      expect(found[0].title).toBe('Test Session')
    })
  })

  describe('logOutput', () => {
    it('buffers output', () => {
      logOutput('test-session-1', 'Hello World\n')
    })
  })

  describe('getSessionDetails', () => {
    it('returns session details', () => {
      const details = getSessionDetails('test-session-1')
      expect(details).not.toBeNull()
      expect(details.id).toBe('test-session-1')
    })

    it('returns null for non-existent session', () => {
      expect(getSessionDetails('nonexistent')).toBeNull()
    })
  })

  describe('searchHistory', () => {
    beforeAll(() => {
      logOutput('test-session-1', 'echo hello search test')
      closeSession('test-session-1')
    })

    it('searches and finds matching sessions', () => {
      const results = searchHistory('hello')
      expect(results.length).toBeGreaterThan(0)
    })

    it('returns empty for non-matching query', () => {
      const results = searchHistory('zzznomatchzzz')
      expect(results).toHaveLength(0)
    })
  })

  describe('getSessionTranscript', () => {
    it('returns transcript data', () => {
      const transcript = getSessionTranscript('test-session-1')
      expect(transcript).toContain('echo hello search test')
    })

    it('returns empty string for non-existent session', () => {
      expect(getSessionTranscript('nonexistent')).toBe('')
    })
  })

  describe('getScrollbackChunk', () => {
    it('returns chunk for matching session', () => {
      const chunks = getScrollbackChunk('test-session-1', Date.now() + 10000)
      expect(Array.isArray(chunks)).toBe(true)
    })

    it('returns empty for non-existent session', () => {
      expect(getScrollbackChunk('nonexistent', Date.now())).toEqual([])
    })
  })

  describe('deleteSession', () => {
    it('deletes a session', () => {
      startSession('to-delete', 'Delete Me', 'local', 'localhost')
      logOutput('to-delete', 'some data')
      closeSession('to-delete')
      deleteSession('to-delete')
      expect(getSessionDetails('to-delete')).toBeNull()
    })
  })

  describe('clearHistory', () => {
    it('clears all history', () => {
      clearHistory()
      expect(getHistorySessions()).toHaveLength(0)
    })
  })

  describe('config disabled', () => {
    beforeEach(() => {
      const config = require('../main/config')
      config.getConfig.mockReturnValue({
        historyLoggingEnabled: false,
        historyDatabaseLimitMb: 500,
        historyKeepDays: 30,
      })
    })

    afterEach(() => {
      const config = require('../main/config')
      config.getConfig.mockReturnValue({
        historyLoggingEnabled: true,
        historyDatabaseLimitMb: 500,
        historyKeepDays: 30,
      })
    })

    it('does not start session when logging is disabled', () => {
      const before = getHistorySessions().length
      startSession('disabled-test', 'Disabled', 'local', 'localhost')
      logOutput('disabled-test', 'should not be logged')
      const after = getHistorySessions().length
      expect(after).toBe(before)
    })
  })
})
