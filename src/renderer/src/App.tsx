import { useCallback, useEffect, useRef, useState } from 'react'
import TitleBar from './components/TitleBar'
import TabBar from './components/TabBar'
import type { TabBarTab } from './components/TabBar'
import SplitPane from './components/SplitPane'
import { destroyTerminalCache } from './components/TerminalView'
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



interface TabState {
  id: string
  label: string
  root: SplitNode
  focusedPath: number[]
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

type DropZone = 'none' | 'right' | 'bottom' | 'outside'

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

import SettingsModal from './components/SettingsModal'
import HistoryViewerModal from './components/HistoryViewerModal'
import CommandPalette, { CommandAction } from './components/CommandPalette'
import { useConfig } from './ConfigContext'
import { builtinThemes } from './themes'
import Sidebar from './components/Sidebar'
import FilePreviewModal from './components/FilePreviewModal'

function App() {
  const { config, updateConfig, openConfig } = useConfig()
  const [tabs, setTabs] = useState<TabState[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDetached, setIsDetached] = useState(false)
  const [detachedTabId, setDetachedTabId] = useState<string | null>(null)
  const [detachedTerminalIds, setDetachedTerminalIds] = useState<string[]>([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [viewingHistorySessionId, setViewingHistorySessionId] = useState<string | null>(null)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null)
  const [dragState, setDragState] = useState<{
    tabId: string
    x: number
    y: number
    zone: DropZone
  } | null>(null)

  const isCommandPaletteOpenRef = useRef(isCommandPaletteOpen)
  isCommandPaletteOpenRef.current = isCommandPaletteOpen

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCommandPaletteOpenRef.current) {
        setIsCommandPaletteOpen(false)
        e.preventDefault()
        e.stopPropagation()
      } else if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        e.stopPropagation()
        setIsSettingsOpen(prev => !prev)
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault()
        e.stopPropagation()
        setIsCommandPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
  }, [])

  const tabsRef = useRef<TabState[]>([])
  useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])
  const initialized = useRef(false)
  const terminalAreaRef = useRef<HTMLDivElement>(null)

  // Check for detached mode on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const detached = params.get('detached')
    const terminals = params.get('terminals')
    if (detached) {
      setIsDetached(true)
      setDetachedTabId(detached)
      const terminalIds = terminals ? terminals.split(',').filter(Boolean) : []
      setDetachedTerminalIds(terminalIds)

      // Build tree from terminal IDs: all as children of a split
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

      setTabs([{
        id: detached,
        label: 'detached',
        root,
        focusedPath: []
      }])
      setActiveTabId(detached)
      return
    }

    if (initialized.current) return
    initialized.current = true

    const api = window.terminalApi
    if (!api) {
      setError('terminalApi not available — IPC not bridged')
      return
    }

    api.create().then(async ({ id }) => {
      const tabId = generateTabId()
      let label: string | undefined
      try {
        const info = await api.getTerminalInfo(id)
        if (info.title) label = info.title
      } catch {}
      setTabs([newTabState(tabId, id, label)])
      setActiveTabId(tabId)
    }).catch((err) => {
      setError(`Failed to create terminal: ${err}`)
    })
  }, [])

  // Listen for reattach events
  useEffect(() => {
    const api = window.terminalApi
    if (!api) return

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
        setTabs((prev) => [...prev, {
          id: tabId,
          label,
          root,
          focusedPath: []
        }])
        setActiveTabId(tabId)
      }
      fetchLabel()
    })
  }, [])

  // Poll for terminal info to update tab labels
  useEffect(() => {
    const api = window.terminalApi
    if (!api) return

    let active = true
    const poll = async () => {
      if (!active) return

      let changed = false
      const updates = new Map<string, string>()

      for (const tab of tabsRef.current) {
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
        setTabs((prev) =>
          prev.map((t) => {
            const newLabel = updates.get(t.id)
            return newLabel ? { ...t, label: newLabel } : t
          })
        )
      }

      if (active) setTimeout(poll, 1000)
    }

    poll()

    return () => {
      active = false
    }
  }, [])

  const newTab = useCallback(async (profileId?: string) => {
    const api = window.terminalApi
    if (!api) return
    try {
      const { id } = await api.create({ profileId })
      const tabId = generateTabId()
      let label: string | undefined
      try {
        const info = await api.getTerminalInfo(id)
        if (info.title) label = info.title
      } catch {}
      setTabs((prev) => [...prev, newTabState(tabId, id, label)])
      setActiveTabId(tabId)
    } catch (err) {
      setError(`Failed to create terminal: ${err}`)
    }
  }, [])

  const closeTab = useCallback((tabId: string) => {
    const api = window.terminalApi
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === tabId)
      if (tab) {
        collectTerminalIds(tab.root).forEach((id) => {
          api.destroy(id)
          destroyTerminalCache(id)
        })
      }
      const next = prev.filter((t) => t.id !== tabId)
      if (tabId === activeTabId) {
        const idx = prev.findIndex((t) => t.id === tabId)
        const newActive = next[Math.min(idx, next.length - 1)]
        if (newActive) {
          setActiveTabId(newActive.id)
        } else {
          setActiveTabId(null)
        }
      }
      return next
    })
  }, [activeTabId])

  const selectTab = useCallback((id: string) => {
    setActiveTabId(id)
  }, [])

  const detachTab = useCallback(async (tabId: string) => {
    const api = window.terminalApi
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return
    try {
      const terminalIds = collectTerminalIds(tab.root)
      await api.detachTab(tabId, terminalIds)
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== tabId)
        if (tabId === activeTabId) {
          const idx = prev.findIndex((t) => t.id === tabId)
          const newActive = next[Math.min(idx, next.length - 1)]
          setActiveTabId(newActive ? newActive.id : null)
        }
        return next
      })
    } catch (err) {
      setError(`Failed to detach tab: ${err}`)
    }
  }, [tabs, activeTabId])

  const reattachMe = useCallback(async () => {
    if (!detachedTabId || detachedTerminalIds.length === 0) return
    const api = window.terminalApi
    try {
      await api.reattachTab(detachedTerminalIds)
    } catch (err) {
      setError(`Failed to reattach: ${err}`)
    }
  }, [detachedTabId, detachedTerminalIds])

  const mergeTabAsSplit = useCallback((fromTabId: string, direction: 'horizontal' | 'vertical') => {
    if (!activeTabId || fromTabId === activeTabId) return
    const fromTab = tabs.find((t) => t.id === fromTabId)
    if (!fromTab) return

    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab) return

    const newTerminalIds = collectTerminalIds(fromTab.root)
    const existing = collectTerminalIds(activeTab.root)
    const api = window.terminalApi

    setTabs((prev) => {
      const updated = prev.map((tab) => {
        if (tab.id !== activeTabId) return tab

        const result = insertLeaves(tab.root, tab.focusedPath, direction, newTerminalIds)
        return {
          ...tab,
          root: result.root,
          focusedPath: result.focusedPath
        }
      })
      return updated.filter((t) => t.id !== fromTabId)
    })
  }, [tabs, activeTabId])

  const splitTab = useCallback(async (direction: 'horizontal' | 'vertical', targetTabId?: string, targetPath?: number[]) => {
    const tabId = targetTabId || activeTabId
    if (!tabId) return
    const api = window.terminalApi

    const activeTab = tabs.find((t) => t.id === tabId)
    if (!activeTab) return

    const path = targetPath || activeTab.focusedPath

    try {
      const { id } = await api.create()
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== tabId) return tab
          const result = insertLeaves(tab.root, path, direction, [id])
          return {
            ...tab,
            root: result.root,
            focusedPath: result.focusedPath
          }
        })
      )
    } catch (err) {
      setError(`Failed to split: ${err}`)
    }
  }, [tabs, activeTabId])

  // Drag handlers
  const handleDragStart = useCallback((tabId: string) => {
    setDragState({ tabId, x: 0, y: 0, zone: 'none' })
  }, [])

  const handleDragMove = useCallback((x: number, y: number) => {
    setDragState((prev) => {
      if (!prev) return null
      const area = terminalAreaRef.current
      if (!area) return { ...prev, x, y, zone: 'none' }

      const r = area.getBoundingClientRect()
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
      return { ...prev, x, y, zone }
    })
  }, [])

  const handleDragEnd = useCallback((tabId: string, x: number, y: number) => {
    setDragState(null)

    // Check if dropped onto another tab for reordering
    const elements = document.elementsFromPoint(x, y)
    const tabItem = elements.find(el => el.classList.contains('tab-item'))
    
    if (tabItem) {
      const targetTabId = (tabItem as HTMLElement).dataset.tabid
      if (targetTabId && targetTabId !== tabId) {
        setTabs(prev => {
          const newTabs = [...prev]
          const sourceIndex = newTabs.findIndex(t => t.id === tabId)
          const targetIndex = newTabs.findIndex(t => t.id === targetTabId)
          if (sourceIndex > -1 && targetIndex > -1) {
            const [moved] = newTabs.splice(sourceIndex, 1)
            newTabs.splice(targetIndex, 0, moved)
          }
          return newTabs
        })
      }
      return
    }

    const area = terminalAreaRef.current
    if (!area) return

    const r = area.getBoundingClientRect()
    const inside =
      x >= r.left && x <= r.right && y >= r.top && y <= r.bottom

    if (!inside) {
      detachTab(tabId)
      return
    }

    const relX = x - r.left
    const relY = y - r.top
    const rightPct = relX / r.width
    const bottomPct = relY / r.height

    if (tabId === activeTabId) {
      return
    }

    if (rightPct > 0.8) {
      mergeTabAsSplit(tabId, 'horizontal')
    } else if (bottomPct > 0.8) {
      mergeTabAsSplit(tabId, 'vertical')
    }
  }, [detachTab, mergeTabAsSplit, splitTab, activeTabId])

  const closeSplit = useCallback(
    (tabId: string, terminalId: string) => {
      const api = window.terminalApi
      api.destroy(terminalId)
      destroyTerminalCache(terminalId)

      setTabs((prev) => {
        const tabIdx = prev.findIndex((t) => t.id === tabId)
        if (tabIdx === -1) return prev

        const tab = prev[tabIdx]
        const activeTab = activeTabId === tabId ? tab : null

        // Find path of this terminal in the tree
        const foundPath = leafPaths(tab.root).find((p) => {
          const node = getNode(tab.root, p)
          return node.terminalId === terminalId
        })

        if (!foundPath) return prev

        const result = removeLeaf(tab.root, foundPath)
        const next = [...prev]

        if (!result.root) {
          next.splice(tabIdx, 1)
          if (activeTabId === tabId) {
            const newActive = next[Math.min(tabIdx, next.length - 1)]
            if (newActive) {
              setActiveTabId(newActive.id)
            } else {
              setActiveTabId(null)
            }
          }
          return next
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
        return next
      })
    },
    [activeTabId]
  )

  const extractToTab = useCallback(
    async (tabId: string, path: number[]) => {
      const tab = tabsRef.current.find((t) => t.id === tabId)
      if (!tab) return

      if (tab.root.type === 'leaf' || !tab.root.children) {
        return
      }

      const targetNode = getNode(tab.root, path)
      if (!targetNode || !targetNode.terminalId) return
      const terminalId = targetNode.terminalId

      let label = tab.label.replace(/ \+ \d+$/, '')
      try {
        const info = await window.terminalApi?.getTerminalInfo(terminalId)
        if (info?.title) label = info.title
      } catch {}

      setTabs((prev) => {
        const tIndex = prev.findIndex((t) => t.id === tabId)
        if (tIndex === -1) return prev
        const currentTab = prev[tIndex]

        const { root: newRoot, newPath } = removeLeaf(currentTab.root, path)
        if (!newRoot) return prev

        const updated = [...prev]
        updated[tIndex] = { ...currentTab, root: newRoot, focusedPath: newPath }

        const extractedTabId = generateTabId()
        const extractedTab = newTabState(extractedTabId, terminalId, label)

        updated.splice(tIndex + 1, 0, extractedTab)
        setActiveTabId(extractedTabId)
        return updated
      })
    },
    []
  )

  const navigateSplit = useCallback(
    (delta: number) => {
      if (!activeTabId) return
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab
          const newPath = navigatePath(tab.root, tab.focusedPath, delta)
          return { ...tab, focusedPath: newPath }
        })
      )
    },
    [activeTabId]
  )

  const onResize = useCallback((tabId: string, path: number[], newSizes: number[]) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== tabId) return tab
        if (path.length === 0) {
          // Root is the split itself
          return { ...tab, root: { ...tab.root, sizes: newSizes } as SplitNode }
        }
        const updated = setNode(tab.root, path, {
          ...getNode(tab.root, path),
          sizes: newSizes
        })
        return { ...tab, root: updated }
      })
    )
  }, [])

  const onFocusSplit = useCallback((tabId: string, path: number[]) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, focusedPath: path } : tab))
    )
  }, [])

  const handleRunScript = useCallback(async (cmd: string, cwd: string) => {
    const api = window.terminalApi
    if (!api) return
    try {
      const { id } = await api.create({ cwd })
      const activeTab = tabsRef.current.find(t => t.id === activeTabId)
      if (activeTab) {
        setTabs(prev => prev.map(t => {
          if (t.id !== activeTabId) return t
          const result = insertLeaves(t.root, t.focusedPath, 'horizontal', [id])
          return { ...t, root: result.root, focusedPath: result.focusedPath }
        }))
      } else {
        const tabId = generateTabId()
        setTabs(prev => [...prev, newTabState(tabId, id, 'Script')])
        setActiveTabId(tabId)
      }
      setTimeout(() => {
        api.write(id, cmd + '\r')
      }, 100)
    } catch (e) {
      setError(`Failed to run script: ${e}`)
    }
  }, [activeTabId])

  const handleInjectSnippet = useCallback((snippet: string) => {
    const api = window.terminalApi
    if (!api || !activeTabId) return
    const activeTab = tabsRef.current.find(t => t.id === activeTabId)
    if (!activeTab) return
    const node = getNode(activeTab.root, activeTab.focusedPath)
    if (node && node.terminalId) {
      api.write(node.terminalId, snippet)
    }
  }, [activeTabId])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      let key = e.key.toLowerCase()
      if (key === 'control') key = 'ctrl'
      
      // Ignore bare modifiers
      if (['ctrl', 'alt', 'shift', 'meta'].includes(key)) return

      const parts = []
      if (e.ctrlKey) parts.push('ctrl')
      if (e.altKey) parts.push('alt')
      if (e.shiftKey) parts.push('shift')
      if (e.metaKey) parts.push('meta')
      parts.push(key)
      
      const shortcut = parts.join('+')
      const action = (config.keybindings || {})[shortcut]

      if (action) {
        e.preventDefault()
        e.stopPropagation()
        switch (action) {
          case 'sidebar:toggle':
            updateConfig({ sidebarOpen: !config.sidebarOpen })
            break
          case 'tab:new':
            newTab()
            break
          case 'tab:close':
            if (activeTabId) closeTab(activeTabId)
            break
          case 'tab:next': {
            if (tabs.length < 2) break
            const idx = tabs.findIndex((t) => t.id === activeTabId)
            setActiveTabId(tabs[(idx + 1) % tabs.length].id)
            break
          }
          case 'tab:prev': {
            if (tabs.length < 2) break
            const idx = tabs.findIndex((t) => t.id === activeTabId)
            setActiveTabId(tabs[(idx - 1 + tabs.length) % tabs.length].id)
            break
          }
          case 'split:extract': {
            const tab = tabs.find((t) => t.id === activeTabId)
            if (tab) {
              extractToTab(activeTabId, tab.focusedPath)
            }
            break
          }
        }
        return
      }

      // Hardcoded split tab commands (not yet mapped to actions)
      if (e.ctrlKey && e.shiftKey && e.key === '\\') {
        e.preventDefault()
        e.stopPropagation()
        splitTab('horizontal')
        return
      }
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'D') {
        e.preventDefault()
        e.stopPropagation()
        splitTab('vertical')
        return
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        navigateSplit(1)
        return
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        navigateSplit(-1)
        return
      }
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        navigateSplit(1)
        return
      }
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        navigateSplit(-1)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [tabs, activeTabId, newTab, closeTab, splitTab, navigateSplit, config.sidebarOpen, updateConfig])

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100vw',
          height: '100vh',
          background: '#1e1e2e',
          color: '#cdd6f4',
          fontFamily: 'monospace',
          fontSize: 14
        }}
      >
        {error}
      </div>
    )
  }

  const tabBarTabs: TabBarTab[] = tabs.map((t) => ({ id: t.id, label: t.label }))

  // Detached mode
  if (isDetached) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TitleBar />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#181825',
            borderBottom: '1px solid #313244',
            height: 28,
            padding: '0 12px',
            userSelect: 'none'
          }}
        >
          <span style={{ color: '#a6adc8', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>
            detached
          </span>
          <span
            onClick={reattachMe}
            style={{
              color: '#6c7086',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'system-ui, sans-serif'
            }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLElement).style.color = '#cdd6f4'
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLElement).style.color = '#6c7086'
            }}
          >
            reattach
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              style={{
                display: tab.id === activeTabId ? 'flex' : 'none',
                width: '100%',
                height: '100%'
              }}
            >
              <SplitPane
                node={tab.root}
                path={[]}
                focusedPath={tab.focusedPath}
                isActive={tab.id === activeTabId}
                onFocus={(path) => onFocusSplit(tab.id, path)}
                onExit={(terminalId) => closeSplit(tab.id, terminalId)}
                onResize={(path, newSizes) => onResize(tab.id, path, newSizes)}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const handleContextMenuAction = (tabId: string, path: number[], action: 'split-h' | 'split-v' | 'close') => {
    onFocusSplit(tabId, path) // Set focus visually
    
    if (action === 'split-h') {
      splitTab('horizontal', tabId, path)
    } else if (action === 'split-v') {
      splitTab('vertical', tabId, path)
    } else if (action === 'close') {
      const tab = tabs.find(t => t.id === tabId)
      if (tab) {
        const targetNode = getNode(tab.root, path)
        if (targetNode?.terminalId) {
          closeSplit(tabId, targetNode.terminalId)
        }
      }
    }
  }

  const themeObj = typeof config.theme === 'string' && builtinThemes[config.theme]
    ? builtinThemes[config.theme]
    : (typeof config.theme === 'object' ? config.theme : builtinThemes['catppuccin-mocha'])

  let appBg = 'transparent'
  if (themeObj.background && typeof config.opacity === 'number') {
    const hex = themeObj.background.replace('#', '')
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      appBg = `rgba(${r}, ${g}, ${b}, ${config.opacity})`
    }
  }

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const activeTerminalId = activeTab ? getNode(activeTab.root, activeTab.focusedPath)?.terminalId || null : null

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: appBg }}>
      <TitleBar onOpenSettings={() => setIsSettingsOpen(true)} />
      <TabBar
        tabs={tabBarTabs}
        activeTabId={activeTabId}
        onSelect={selectTab}
        onClose={closeTab}
        onNew={newTab}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {config.sidebarOpen && config.sidebarPlacement === 'left' && (
          <Sidebar 
            onRunScript={handleRunScript} 
            onInjectSnippet={handleInjectSnippet} 
            onViewSession={(sessionId) => setViewingHistorySessionId(sessionId)}
            activeTerminalId={activeTerminalId}
            onViewFile={(filePath) => setPreviewFilePath(filePath)}
          />
        )}
        <div ref={terminalAreaRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', borderTop: '1px solid #313244' }}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              style={{
                visibility: tab.id === activeTabId ? 'visible' : 'hidden',
                position: tab.id === activeTabId ? 'relative' : 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: tab.id === activeTabId ? 1 : 0,
                display: 'flex',
                width: '100%',
                height: '100%'
              }}
            >
              <SplitPane
                node={tab.root}
                path={[]}
                focusedPath={tab.focusedPath}
                isActive={tab.id === activeTabId}
                onExtract={collectTerminalIds(tab.root).length > 1 ? (path) => extractToTab(tab.id, path) : undefined}
                onFocus={(path) => onFocusSplit(tab.id, path)}
                onExit={(terminalId) => closeSplit(tab.id, terminalId)}
                onResize={(path, newSizes) => onResize(tab.id, path, newSizes)}
                onContextMenuAction={(path, action) => handleContextMenuAction(tab.id, path, action)}
              />
            </div>
          ))}
          {dragState && dragState.zone === 'right' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '20%',
                height: '100%',
                background: 'rgba(203, 166, 247, 0.15)',
                border: '2px dashed #cba6f7',
                zIndex: 100,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#cdd6f4',
                fontSize: 13,
                fontFamily: 'system-ui, sans-serif'
              }}
            >
              split right
            </div>
          )}
          {dragState && dragState.zone === 'bottom' && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: '20%',
                background: 'rgba(203, 166, 247, 0.15)',
                border: '2px dashed #cba6f7',
                zIndex: 100,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#cdd6f4',
                fontSize: 13,
                fontFamily: 'system-ui, sans-serif'
              }}
            >
              split down
            </div>
          )}
        </div>
        {config.sidebarOpen && config.sidebarPlacement === 'right' && (
          <Sidebar 
            onRunScript={handleRunScript} 
            onInjectSnippet={handleInjectSnippet} 
            onViewSession={(sessionId) => setViewingHistorySessionId(sessionId)}
            activeTerminalId={activeTerminalId}
            onViewFile={(filePath) => setPreviewFilePath(filePath)}
          />
        )}
      </div>
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      {viewingHistorySessionId && (
        <HistoryViewerModal 
          sessionId={viewingHistorySessionId} 
          onClose={() => setViewingHistorySessionId(null)} 
        />
      )}
      {previewFilePath && (
        <FilePreviewModal
          filePath={previewFilePath}
          onClose={() => setPreviewFilePath(null)}
        />
      )}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        actions={[
          { id: 'settings', label: 'Settings: Open', onExecute: () => setIsSettingsOpen(true) },
          { id: 'config-file', label: 'Settings: Open config.json5 in Editor', onExecute: openConfig },
          { id: 'toggle-sidebar', label: 'View: Toggle Sidebar', onExecute: () => updateConfig({ sidebarOpen: !config.sidebarOpen }) },
          { id: 'new-tab', label: 'View: New Tab', onExecute: newTab },
          { id: 'split-h', label: 'View: Split Horizontal', onExecute: () => splitTab('horizontal') },
          { id: 'split-v', label: 'View: Split Vertical', onExecute: () => splitTab('vertical') },
          { id: 'extract', label: 'View: Detach Tab to Window', onExecute: detachTab },
          ...Object.keys(builtinThemes).map(themeName => ({
            id: `theme-${themeName}`,
            label: `Theme: Set to ${themeName.replace('-', ' ')}`,
            onExecute: () => updateConfig({ theme: themeName })
          })),
          ...(config.profiles || []).map(profile => ({
            id: `launch-profile-${profile.id}`,
            label: `Profiles: Launch ${profile.name}`,
            onExecute: () => newTab(profile.id)
          }))
        ]}
      />
    </div>
  )
}



export default App
