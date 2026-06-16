/**
 * @jest-environment jsdom
 */

import { useTabStore } from '../renderer/src/features/terminal/useTabStore'
import { leafNode, browserLeafNode } from '../renderer/src/features/terminal/splitTree'
import { setupMockedApis } from './rendererHelpers'
import { jest } from '@jest/globals'

describe('useTabStore', () => {
  beforeEach(() => {
    setupMockedApis()
    const store = useTabStore.getState()
    store.setTabs([])
    store.setActiveTabId(null)
    store.setDragState(null)
    
    // Clear mock functions
    const api = window.terminalApi as any
    if (api) {
      api.detachTab.mockClear()
      api.reattachTab.mockClear()
      api.onReattachTab.mockClear()
    }
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

  it('detachTab collects browser IDs correctly', async () => {
    const store = useTabStore.getState()
    store.setTabs([
      {
        id: 'tab-browser',
        label: 'Web Browser',
        root: browserLeafNode('browser-123'),
        focusedPath: []
      }
    ])

    await store.detachTab('tab-browser')

    const api = window.terminalApi as any
    expect(api.detachTab).toHaveBeenCalledWith('tab-browser', ['browser-123'])
    expect(useTabStore.getState().tabs).toHaveLength(0)
  })

  it('detachTab encodes URL in browser ID if present', async () => {
    const store = useTabStore.getState()
    const browserNode = browserLeafNode('browser-123')
    browserNode.url = 'https://google.com/search'
    store.setTabs([
      {
        id: 'tab-browser',
        label: 'Web Browser',
        root: browserNode,
        focusedPath: []
      }
    ])

    await store.detachTab('tab-browser')

    const api = window.terminalApi as any
    expect(api.detachTab).toHaveBeenCalledWith('tab-browser', ['browser-123:https%3A%2F%2Fgoogle.com%2Fsearch'])
  })

  it('detachTab queries DOM webview element for URL if node.url is missing', async () => {
    const store = useTabStore.getState()
    store.setTabs([
      {
        id: 'tab-browser',
        label: 'Web Browser',
        root: browserLeafNode('browser-123'),
        focusedPath: []
      }
    ])

    // Create a mock webview element in document body
    const mockWebview = document.createElement('div')
    mockWebview.id = 'browser-123'
    ;(mockWebview as any).getURL = () => 'https://youtube.com'
    document.body.appendChild(mockWebview)

    await store.detachTab('tab-browser')

    const api = window.terminalApi as any
    expect(api.detachTab).toHaveBeenCalledWith('tab-browser', ['browser-123:https%3A%2F%2Fyoutube.com'])

    // Cleanup mock element
    document.body.removeChild(mockWebview)
  })

  it('initializeTabs reconstructs browser leaf nodes correctly when detached', () => {
    // Mock URL search params using history.pushState
    window.history.pushState({}, '', '?detached=tab-browser&terminals=browser-123:https%3A%2F%2Fgoogle.com%2Fsearch');

    // Run inside isolateModules to get a fresh copy of useTabStore
    jest.isolateModules(() => {
      const { useTabStore: freshUseTabStore } = require('../renderer/src/features/terminal/useTabStore') as any;
      freshUseTabStore.getState().initializeTabs();

      const updatedStore = freshUseTabStore.getState();
      expect(updatedStore.isDetached).toBe(true);
      const expectedNode = { ...browserLeafNode('browser-123'), url: 'https://google.com/search' };
      expect(updatedStore.tabs[0].root).toEqual(expectedNode);
    });

    // Restore location
    window.history.pushState({}, '', '/');
  })

  it('onReattachTab reconstructs browser leaf nodes correctly', () => {
    const store = useTabStore.getState()
    let callback: any
    const api = window.terminalApi as any
    api.onReattachTab.mockImplementation((cb: any) => {
      callback = cb
      return () => {}
    })

    store.onReattachTab()
    expect(callback).toBeDefined()

    // Trigger reattach callback with browser ID + URL
    callback(['browser-123:https%3A%2F%2Fgoogle.com%2Fsearch'])

    const tabs = useTabStore.getState().tabs
    const newTab = tabs[tabs.length - 1]
    expect(newTab.label).toBe('Web Browser')
    const expectedNode = { ...browserLeafNode('browser-123'), url: 'https://google.com/search' };
    expect(newTab.root).toEqual(expectedNode)
  })
})
