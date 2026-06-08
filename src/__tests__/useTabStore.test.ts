import { useTabStore } from '../renderer/src/features/terminal/useTabStore'
import { leafNode } from '../renderer/src/features/terminal/splitTree'

describe('useTabStore', () => {
  beforeEach(() => {
    // Reset state before each test if possible. In Zustand, we can re-initialize fields.
    // For this basic test suite, we'll manually reset what we test.
    const store = useTabStore.getState()
    store.setTabs([])
    store.setActiveTabId(null)
    store.setError(null)
    store.setIsSettingsOpen(false)
    store.setIsCommandPaletteOpen(false)
    store.setViewingHistorySessionId(null)
    store.setPreviewFilePath(null)
    store.setDragState(null)
  })

  it('setActiveTabId correctly sets active tab ID', () => {
    const store = useTabStore.getState()
    expect(store.activeTabId).toBeNull()

    store.setActiveTabId('tab-123')
    expect(useTabStore.getState().activeTabId).toBe('tab-123')
  })

  it('setError correctly sets the error message', () => {
    const store = useTabStore.getState()
    expect(store.error).toBeNull()

    store.setError('Connection failed')
    expect(useTabStore.getState().error).toBe('Connection failed')
  })

  it('setIsSettingsOpen updates correctly using boolean and callback', () => {
    const store = useTabStore.getState()
    expect(store.isSettingsOpen).toBe(false)

    store.setIsSettingsOpen(true)
    expect(useTabStore.getState().isSettingsOpen).toBe(true)

    useTabStore.getState().setIsSettingsOpen((prev) => !prev)
    expect(useTabStore.getState().isSettingsOpen).toBe(false)
  })

  it('setIsCommandPaletteOpen updates correctly', () => {
    const store = useTabStore.getState()
    expect(store.isCommandPaletteOpen).toBe(false)

    store.setIsCommandPaletteOpen(true)
    expect(useTabStore.getState().isCommandPaletteOpen).toBe(true)
  })

  it('setViewingHistorySessionId correctly updates session ID', () => {
    const store = useTabStore.getState()
    expect(store.viewingHistorySessionId).toBeNull()

    store.setViewingHistorySessionId('session-456')
    expect(useTabStore.getState().viewingHistorySessionId).toBe('session-456')
  })

  it('setPreviewFilePath correctly updates file path', () => {
    const store = useTabStore.getState()
    expect(store.previewFilePath).toBeNull()

    store.setPreviewFilePath('/path/to/preview.txt')
    expect(useTabStore.getState().previewFilePath).toBe('/path/to/preview.txt')
  })

  it('setDragState correctly updates the drag state', () => {
    const store = useTabStore.getState()
    expect(store.dragState).toBeNull()

    store.setDragState({ tabId: 'tab-99', zone: 'right' })
    expect(useTabStore.getState().dragState).toEqual({ tabId: 'tab-99', zone: 'right' })
  })

  it('renameTab updates the label of the correct tab', () => {
    const store = useTabStore.getState()

    // Set up a mock tab
    store.setTabs([
      {
        id: 'tab-1',
        label: 'Old Label',
        root: leafNode('term-1'),
        focusedPath: []
      },
      {
        id: 'tab-2',
        label: 'Another Tab',
        root: leafNode('term-2'),
        focusedPath: []
      }
    ])

    expect(useTabStore.getState().tabs[0].label).toBe('Old Label')

    // Rename
    store.renameTab('tab-1', 'New Label')

    const newTabs = useTabStore.getState().tabs
    expect(newTabs.find(t => t.id === 'tab-1')?.label).toBe('New Label')
    // Ensure the other tab isn't affected
    expect(newTabs.find(t => t.id === 'tab-2')?.label).toBe('Another Tab')
  })
})
