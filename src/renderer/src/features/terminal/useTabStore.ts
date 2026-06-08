import { create } from 'zustand'
import {
  leafNode,
  collectTerminalIds,
  navigatePath,
  insertLeaves,
  removeLeaf,
  setNode,
  getNode,
  leafPaths
} from './splitTree'
import type { SplitNode } from './splitTree'

// Helper to destroy terminal instances from memory/DOM cache
// (import dynamically or define placeholder to be set by active views)
let _destroyTerminalCache: ((id: string) => void) | null = null
export function registerDestroyTerminalCache(fn: (id: string) => void) {
  _destroyTerminalCache = fn
}

export interface TabState {
  id: string
  label: string
  root: SplitNode
  focusedPath: number[]
}

type DropZone = 'none' | 'right' | 'bottom' | 'outside'

interface DragState {
  tabId: string
  zone: DropZone
}

interface TabStore {
  tabs: TabState[]
  activeTabId: string | null
  error: string | null
  isDetached: boolean
  detachedTabId: string | null
  detachedTerminalIds: string[]
  isSettingsOpen: boolean
  viewingHistorySessionId: string | null
  isCommandPaletteOpen: boolean
  previewFilePath: string | null
  dragState: DragState | null

  // UI state setters
  setError: (err: string | null) => void
  setIsSettingsOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void
  setIsCommandPaletteOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void
  setViewingHistorySessionId: (id: string | null) => void
  setPreviewFilePath: (path: string | null) => void
  setDragState: (dragState: DragState | null | ((prev: DragState | null) => DragState | null)) => void
  setActiveTabId: (id: string | null) => void
  setTabs: (tabs: TabState[] | ((prev: TabState[]) => TabState[])) => void

  // Logical Actions
  initializeTabs: () => void
  onReattachTab: () => () => void
  pollTabLabels: () => () => void
  newTab: (profileId?: string, sshHostId?: string) => Promise<void>
  closeTab: (tabId: string) => void
  selectTab: (id: string) => void
  detachTab: (tabId: string) => Promise<void>
  reattachMe: () => Promise<void>
  mergeTabAsSplit: (fromTabId: string, direction: 'horizontal' | 'vertical') => void
  splitTab: (direction: 'horizontal' | 'vertical', targetTabId?: string, targetPath?: number[]) => Promise<void>
  unsplitTab: () => void
  closeSplit: (tabId: string, terminalId: string) => void
  extractToTab: (tabId: string, path: number[]) => Promise<void>
  navigateSplit: (delta: number) => void
  onResize: (tabId: string, path: number[], newSizes: number[]) => void
  onFocusSplit: (tabId: string, path: number[]) => void
  renameTab: (tabId: string, newLabel: string) => void
  handleRunScript: (cmd: string, cwd: string) => Promise<void>
  handleInjectSnippet: (snippet: string) => void
  handleDragStart: (tabId: string) => void
  handleDragMove: (x: number, y: number, terminalArea: HTMLDivElement | null) => void
  handleDragEnd: (tabId: string, x: number, y: number, terminalArea: HTMLDivElement | null) => void
}

let tabCounter = 1
let nextTabId = 1

function generateTabId(): string {
  return `tab-${nextTabId++}`
}

function newTabState(tabId: string, terminalId: string, label?: string): TabState {
  return {
    id: tabId,
    label: label || `shell ${tabCounter++}`,
    root: leafNode(terminalId),
    focusedPath: []
  }
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export const useTabStore = create<TabStore>((set, get) => {
  let initialized = false

  return {
    tabs: [],
    activeTabId: null,
    error: null,
    isDetached: false,
    detachedTabId: null,
    detachedTerminalIds: [],
    isSettingsOpen: false,
    viewingHistorySessionId: null,
    isCommandPaletteOpen: false,
    previewFilePath: null,
    dragState: null,

    setError: (err) => set({ error: err }),
    setIsSettingsOpen: (isOpen) => set(state => ({
      isSettingsOpen: typeof isOpen === 'function' ? isOpen(state.isSettingsOpen) : isOpen
    })),
    setIsCommandPaletteOpen: (isOpen) => set(state => ({
      isCommandPaletteOpen: typeof isOpen === 'function' ? isOpen(state.isCommandPaletteOpen) : isOpen
    })),
    setViewingHistorySessionId: (id) => set({ viewingHistorySessionId: id }),
    setPreviewFilePath: (path) => set({ previewFilePath: path }),
    setDragState: (dragState) => set(state => ({
      dragState: typeof dragState === 'function' ? dragState(state.dragState) : dragState
    })),
    setActiveTabId: (id) => set({ activeTabId: id }),
    setTabs: (tabs) => set(state => ({
      tabs: typeof tabs === 'function' ? tabs(state.tabs) : tabs
    })),

    initializeTabs: () => {
      if (initialized) return
      initialized = true

      const params = new URLSearchParams(window.location.search)
      const detached = params.get('detached')
      const terminals = params.get('terminals')
      if (detached) {
        const terminalIds = terminals ? terminals.split(',').filter(Boolean) : []
        let root: SplitNode
        if (terminalIds.length <= 1) {
          root = leafNode(terminalIds[0] ?? '')
        } else {
          root = {
            direction: 'horizontal',
            children: terminalIds.map(leafNode),
            sizes: terminalIds.map(() => 1 / terminalIds.length)
          }
        }
        set({
          isDetached: true,
          detachedTabId: detached,
          detachedTerminalIds: terminalIds,
          tabs: [{
            id: detached,
            label: 'detached',
            root,
            focusedPath: []
          }],
          activeTabId: detached
        })
        return
      }

      const api = window.terminalApi
      if (!api) {
        set({ error: 'terminalApi not available — IPC not bridged' })
        return
      }

      api.create().then(async ({ id }) => {
        const tabId = generateTabId()
        let label: string | undefined
        try {
          const info = await api.getTerminalInfo(id)
          if (info.title) label = info.title
        } catch {}
        set({
          tabs: [newTabState(tabId, id, label)],
          activeTabId: tabId
        })
      }).catch((err) => {
        set({ error: `Failed to create terminal: ${err}` })
      })
    },

    onReattachTab: () => {
      const api = window.terminalApi
      if (!api) return () => {}

      return api.onReattachTab((terminalIds: string[]) => {
        const tabId = generateTabId()
        let root: SplitNode
        if (terminalIds.length <= 1) {
          root = leafNode(terminalIds[0] ?? '')
        } else {
          root = {
            direction: 'horizontal',
            children: terminalIds.map(leafNode),
            sizes: terminalIds.map(() => 1 / terminalIds.length)
          }
        }
        const fetchLabel = async () => {
          let label = `shell ${tabCounter++}`
          try {
            const info = await api.getTerminalInfo(terminalIds[0])
            const suffix = terminalIds.length > 1 ? ` + ${terminalIds.length - 1}` : ''
            if (info.title) label = info.title + suffix
          } catch {}
          set((state) => ({
            tabs: [...state.tabs, {
              id: tabId,
              label,
              root,
              focusedPath: []
            }],
            activeTabId: tabId
          }))
        }
        fetchLabel()
      })
    },

    pollTabLabels: () => {
      const api = window.terminalApi
      if (!api) return () => {}

      let active = true
      const poll = async () => {
        if (!active) return

        let changed = false
        const updates = new Map<string, string>()

        for (const tab of get().tabs) {
          const targetNode = getNode(tab.root, tab.focusedPath)
          if (targetNode && targetNode.terminalId) {
            try {
              const info = await api.getTerminalInfo(targetNode.terminalId)
              const countAttached = collectTerminalIds(tab.root).length - 1
              const suffix = countAttached > 0 ? ` + ${countAttached}` : ''
              const targetLabel = info.title ? info.title + suffix : ''
              
              if (targetLabel && targetLabel !== tab.label) {
                updates.set(tab.id, targetLabel)
                changed = true
              }
            } catch {
              // ignore
            }
          }
        }

        if (active && changed) {
          set((state) => ({
            tabs: state.tabs.map((t) => {
              const newLabel = updates.get(t.id)
              return newLabel ? { ...t, label: newLabel } : t
            })
          }))
        }

        if (active) setTimeout(poll, 1000)
      }

      poll()

      return () => {
        active = false
      }
    },

    newTab: async (profileId, sshHostId) => {
      const api = window.terminalApi
      if (!api) return
      try {
        const { id } = await api.create({ profileId, sshHostId })
        const tabId = generateTabId()
        let label: string | undefined
        try {
          const info = await api.getTerminalInfo(id)
          if (info.title) label = info.title
        } catch {}
        set((state) => ({
          tabs: [...state.tabs, newTabState(tabId, id, label)],
          activeTabId: tabId
        }))
      } catch (err) {
        set({ error: `Failed to create terminal: ${err}` })
      }
    },

    closeTab: (tabId) => {
      const api = window.terminalApi
      if (!api) return
      const activeTabId = get().activeTabId
      const prevTabs = get().tabs
      const tab = prevTabs.find((t) => t.id === tabId)
      if (tab) {
        collectTerminalIds(tab.root).forEach((id) => {
          api.destroy(id)
          if (_destroyTerminalCache) _destroyTerminalCache(id)
        })
      }
      const next = prevTabs.filter((t) => t.id !== tabId)
      let newActiveTabId = activeTabId
      if (tabId === activeTabId) {
        const idx = prevTabs.findIndex((t) => t.id === tabId)
        const newActive = next[Math.min(idx, next.length - 1)]
        newActiveTabId = newActive ? newActive.id : null
      }
      set({
        tabs: next,
        activeTabId: newActiveTabId
      })
    },

    selectTab: (id) => {
      set({ activeTabId: id })
    },

    detachTab: async (tabId) => {
      const api = window.terminalApi
      if (!api) return
      const activeTabId = get().activeTabId
      const prevTabs = get().tabs
      const tab = prevTabs.find((t) => t.id === tabId)
      if (!tab) return
      try {
        const terminalIds = collectTerminalIds(tab.root)
        await api.detachTab(tabId, terminalIds)
        terminalIds.forEach(id => {
          if (_destroyTerminalCache) _destroyTerminalCache(id)
        })

        const next = prevTabs.filter((t) => t.id !== tabId)
        let newActiveTabId = activeTabId
        if (tabId === activeTabId) {
          const idx = prevTabs.findIndex((t) => t.id === tabId)
          const newActive = next[Math.min(idx, next.length - 1)]
          newActiveTabId = newActive ? newActive.id : null
        }
        set({
          tabs: next,
          activeTabId: newActiveTabId
        })
      } catch (err) {
        set({ error: `Failed to detach tab: ${err}` })
      }
    },

    reattachMe: async () => {
      const detachedTabId = get().detachedTabId
      const detachedTerminalIds = get().detachedTerminalIds
      if (!detachedTabId || detachedTerminalIds.length === 0) return
      const api = window.terminalApi
      if (!api) return
      try {
        await api.reattachTab(detachedTerminalIds)
      } catch (err) {
        set({ error: `Failed to reattach: ${err}` })
      }
    },

    mergeTabAsSplit: (fromTabId, direction) => {
      const activeTabId = get().activeTabId
      const prevTabs = get().tabs
      if (!activeTabId || fromTabId === activeTabId) return
      const fromTab = prevTabs.find((t) => t.id === fromTabId)
      if (!fromTab) return

      const activeTab = prevTabs.find((t) => t.id === activeTabId)
      if (!activeTab) return

      const newTerminalIds = collectTerminalIds(fromTab.root)
      const updated = prevTabs.map((tab) => {
        if (tab.id !== activeTabId) return tab

        const result = insertLeaves(tab.root, tab.focusedPath, direction, newTerminalIds)
        return {
          ...tab,
          root: result.root,
          focusedPath: result.focusedPath
        }
      })
      set({
        tabs: updated.filter((t) => t.id !== fromTabId)
      })
    },

    splitTab: async (direction, targetTabId, targetPath) => {
      const activeTabId = get().activeTabId
      const tabId = targetTabId || activeTabId
      if (!tabId) return
      const api = window.terminalApi
      if (!api) return

      try {
        const { id } = await api.create()
        set((state) => {
          const tab = state.tabs.find((t) => t.id === tabId)
          if (!tab) {
            api.destroy(id)
            return state
          }
          const path = targetPath || tab.focusedPath
          const result = insertLeaves(tab.root, path, direction, [id])
          return {
            tabs: state.tabs.map((t) => {
              if (t.id !== tabId) return t
              return {
                ...t,
                root: result.root,
                focusedPath: result.focusedPath
              }
            })
          }
        })
      } catch (err) {
        set({ error: `Failed to split: ${err}` })
      }
    },

    unsplitTab: async () => {
      const activeTabId = get().activeTabId
      if (!activeTabId) return
      const prevTabs = get().tabs
      const activeTab = prevTabs.find((t) => t.id === activeTabId)
      if (!activeTab) return

      const focusedNode = getNode(activeTab.root, activeTab.focusedPath)
      if (!focusedNode || !focusedNode.terminalId) return

      const allTerminalIds = collectTerminalIds(activeTab.root)
      const toExtract = allTerminalIds.filter(id => id !== focusedNode.terminalId)
      
      if (toExtract.length === 0) return
      
      const api = window.terminalApi
      const newTabs: TabState[] = []
      
      for (const id of toExtract) {
        let label = activeTab.label.replace(/ \+ \d+$/, '')
        if (api) {
          try {
            const info = await api.getTerminalInfo(id)
            if (info?.title) label = info.title
          } catch {}
        }
        newTabs.push(newTabState(generateTabId(), id, label))
      }

      set((state) => {
        const next = [...state.tabs]
        const tabIdx = next.findIndex((t) => t.id === activeTabId)
        if (tabIdx === -1) return state
        
        next[tabIdx] = {
          ...next[tabIdx],
          root: leafNode(focusedNode.terminalId!),
          focusedPath: []
        }
        
        next.splice(tabIdx + 1, 0, ...newTabs)
        return { tabs: next }
      })
    },

    closeSplit: (tabId, terminalId) => {
      const api = window.terminalApi
      if (!api) return
      api.destroy(terminalId)
      if (_destroyTerminalCache) _destroyTerminalCache(terminalId)

      const activeTabId = get().activeTabId
      const prevTabs = get().tabs

      const tabIdx = prevTabs.findIndex((t) => t.id === tabId)
      if (tabIdx === -1) return

      const tab = prevTabs[tabIdx]

      // Find path of this terminal in the tree
      const foundPath = leafPaths(tab.root).find((p) => {
        const node = getNode(tab.root, p)
        return node.terminalId === terminalId
      })

      if (!foundPath) return

      const result = removeLeaf(tab.root, foundPath)
      const next = [...prevTabs]

      if (!result.root) {
        next.splice(tabIdx, 1)
        let newActiveTabId = activeTabId
        if (activeTabId === tabId) {
          const newActive = next[Math.min(tabIdx, next.length - 1)]
          newActiveTabId = newActive ? newActive.id : null
        }
        set({
          tabs: next,
          activeTabId: newActiveTabId
        })
        return
      }

      let newFocusedPath = result.newPath
      const remaining = collectTerminalIds(result.root)
      if (remaining.length > 0) {
        const paths = leafPaths(result.root)
        if (paths.length > 0 && !paths.some((p) => pathsEqual(p, result.newPath))) {
          newFocusedPath = paths[Math.min(paths.length - 1, paths.length - 1)]
        }
      }

      next[tabIdx] = {
        ...tab,
        root: result.root,
        focusedPath: newFocusedPath
      }
      set({ tabs: next })
    },

    extractToTab: async (tabId, path) => {
      const api = window.terminalApi
      if (!api) return
      const prevTabs = get().tabs
      const tab = prevTabs.find((t) => t.id === tabId)
      if (!tab) return

      if (tab.root.direction === undefined || !tab.root.children) {
        return
      }

      const targetNode = getNode(tab.root, path)
      if (!targetNode || !targetNode.terminalId) return
      const terminalId = targetNode.terminalId

      let label = tab.label.replace(/ \+ \d+$/, '')
      try {
        const info = await api.getTerminalInfo(terminalId)
        if (info?.title) label = info.title
      } catch {}

      const tIndex = prevTabs.findIndex((t) => t.id === tabId)
      if (tIndex === -1) return
      const currentTab = prevTabs[tIndex]

      const { root: newRoot, newPath } = removeLeaf(currentTab.root, path)
      if (!newRoot) return

      const updated = [...prevTabs]
      updated[tIndex] = { ...currentTab, root: newRoot, focusedPath: newPath }

      const extractedTabId = generateTabId()
      const extractedTab = newTabState(extractedTabId, terminalId, label)

      updated.splice(tIndex + 1, 0, extractedTab)
      set({
        tabs: updated,
        activeTabId: extractedTabId
      })
    },

    navigateSplit: (delta) => {
      const activeTabId = get().activeTabId
      if (!activeTabId) return
      set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== activeTabId) return tab
          const newPath = navigatePath(tab.root, tab.focusedPath, delta)
          return { ...tab, focusedPath: newPath }
        })
      }))
    },

    onResize: (tabId, path, newSizes) => {
      set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== tabId) return tab
          if (path.length === 0) {
            return { ...tab, root: { ...tab.root, sizes: newSizes } as SplitNode }
          }
          const updated = setNode(tab.root, path, {
            ...getNode(tab.root, path),
            sizes: newSizes
          })
          return { ...tab, root: updated }
        })
      }))
    },

    onFocusSplit: (tabId, path) => {
      set((state) => ({
        tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, focusedPath: path } : tab))
      }))
    },

    renameTab: (tabId, newLabel) => {
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, label: newLabel } : t))
      }))
    },

    handleRunScript: async (cmd, cwd) => {
      const api = window.terminalApi
      if (!api) return
      const activeTabId = get().activeTabId
      const prevTabs = get().tabs
      try {
        const { id } = await api.create({ cwd })
        const activeTab = prevTabs.find(t => t.id === activeTabId)
        if (activeTab) {
          set((state) => ({
            tabs: state.tabs.map(t => {
              if (t.id !== activeTabId) return t
              const result = insertLeaves(t.root, t.focusedPath, 'horizontal', [id])
              return { ...t, root: result.root, focusedPath: result.focusedPath }
            })
          }))
        } else {
          const tabId = generateTabId()
          set((state) => ({
            tabs: [...state.tabs, newTabState(tabId, id, 'Script')],
            activeTabId: tabId
          }))
        }
        setTimeout(() => {
          api.write(id, cmd + '\r')
        }, 100)
      } catch (e) {
        set({ error: `Failed to run script: ${e}` })
      }
    },

    handleInjectSnippet: (snippet) => {
      const api = window.terminalApi
      const activeTabId = get().activeTabId
      if (!api || !activeTabId) return
      const activeTab = get().tabs.find(t => t.id === activeTabId)
      if (!activeTab) return
      const node = getNode(activeTab.root, activeTab.focusedPath)
      if (node && node.terminalId) {
        api.write(node.terminalId, snippet)
      }
    },

    handleDragStart: (tabId) => {
      set({ dragState: { tabId, zone: 'none' } })
      const rightZone = document.getElementById('drag-zone-right')
      if (rightZone) rightZone.style.display = 'none'
      const bottomZone = document.getElementById('drag-zone-bottom')
      if (bottomZone) bottomZone.style.display = 'none'
    },

    handleDragMove: (x, y, terminalArea) => {
      if (!terminalArea) {
        const rightZone = document.getElementById('drag-zone-right')
        if (rightZone) rightZone.style.display = 'none'
        const bottomZone = document.getElementById('drag-zone-bottom')
        if (bottomZone) bottomZone.style.display = 'none'
        return
      }

      const r = terminalArea.getBoundingClientRect()
      const relX = x - r.left
      const relY = y - r.top
      const rightPct = relX / r.width
      const bottomPct = relY / r.height

      let zone: DropZone = 'none'
      if (relX >= 0 && relX <= r.width && relY >= 0 && relY <= r.height) {
        if (rightPct > 0.8) zone = 'right'
        else if (bottomPct > 0.8) zone = 'bottom'
      } else {
        zone = 'outside'
      }

      const rightZone = document.getElementById('drag-zone-right')
      const bottomZone = document.getElementById('drag-zone-bottom')

      if (rightZone && bottomZone) {
        rightZone.style.display = zone === 'right' ? 'flex' : 'none'
        bottomZone.style.display = zone === 'bottom' ? 'flex' : 'none'
      }
    },

    handleDragEnd: (tabId, x, y, terminalArea) => {
      set({ dragState: null })
      const rightZone = document.getElementById('drag-zone-right')
      if (rightZone) rightZone.style.display = 'none'
      const bottomZone = document.getElementById('drag-zone-bottom')
      if (bottomZone) bottomZone.style.display = 'none'

      // Check if dropped onto another tab for reordering
      const elements = document.elementsFromPoint(x, y)
      const tabItem = elements.find(el => el.classList.contains('tab-item'))
      
      if (tabItem) {
        const targetTabId = (tabItem as HTMLElement).dataset.tabid
        if (targetTabId && targetTabId !== tabId) {
          set(state => {
            const newTabs = [...state.tabs]
            const sourceIndex = newTabs.findIndex(t => t.id === tabId)
            const targetIndex = newTabs.findIndex(t => t.id === targetTabId)
            if (sourceIndex > -1 && targetIndex > -1) {
              const [moved] = newTabs.splice(sourceIndex, 1)
              newTabs.splice(targetIndex, 0, moved)
            }
            return { tabs: newTabs }
          })
        }
        return
      }

      if (!terminalArea) return

      const r = terminalArea.getBoundingClientRect()
      const inside =
        x >= r.left && x <= r.right && y >= r.top && y <= r.bottom

      if (!inside) {
        get().detachTab(tabId)
        return
      }

      const relX = x - r.left
      const relY = y - r.top
      const rightPct = relX / r.width
      const bottomPct = relY / r.height

      if (tabId === get().activeTabId) {
        return
      }

      if (rightPct > 0.8) {
        get().mergeTabAsSplit(tabId, 'horizontal')
      } else if (bottomPct > 0.8) {
        get().mergeTabAsSplit(tabId, 'vertical')
      }
    }
  }
})
