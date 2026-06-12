import { useTabStore } from '../renderer/src/features/terminal/useTabStore'
import { leafNode } from '../renderer/src/features/terminal/splitTree'

describe('useTabStore', () => {
  beforeEach(() => {
    const store = useTabStore.getState()
    store.setTabs([])
    store.setActiveTabId(null)
    store.setDragState(null)
  })

  it('setActiveTabId correctly sets active tab ID', () => {
    const store = useTabStore.getState()
    expect(store.activeTabId).toBeNull()

    store.setActiveTabId('tab-123')
    expect(useTabStore.getState().activeTabId).toBe('tab-123')
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
