import { useEffect, useRef } from 'react'
import TitleBar from '@/shared/components/TitleBar'
import TabBar from '@/features/terminal/components/TabBar'
import type { TabBarTab } from '@/features/terminal/components/TabBar'
import SplitPane from '@/features/terminal/components/SplitPane'
import { getNode, collectTerminalIds } from '@/features/terminal/splitTree'
import SettingsModal from '@/features/settings/components/SettingsModal'
import HistoryViewerModal from '@/shared/components/HistoryViewerModal'
import CommandPalette from '@/shared/components/CommandPalette'
import { useConfig, useConfigStore } from '@/features/settings/useConfigStore'
import { useTabStore } from '@/features/terminal/useTabStore'
import { builtinThemes } from '@/themes'
import Sidebar from '@/shared/components/Sidebar'
import FilePreviewModal from '@/features/workspace/components/FilePreviewModal'

function App() {
  const { config, updateConfig, openConfig } = useConfig()
  const {
    tabs,
    activeTabId,
    error,
    isDetached,
    isSettingsOpen,
    viewingHistorySessionId,
    isCommandPaletteOpen,
    previewFilePath,
    initializeTabs,
    onReattachTab,
    pollTabLabels,
    setIsSettingsOpen,
    setIsCommandPaletteOpen,
    setViewingHistorySessionId,
    setPreviewFilePath,
    newTab,
    closeTab,
    selectTab,
    splitTab,
    unsplitTab,
    closeSplit,
    extractToTab,
    detachTab,
    onResize,
    onFocusSplit,
    renameTab,
    handleRunScript,
    handleInjectSnippet,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    navigateSplit,
    reattachMe
  } = useTabStore()

  const terminalAreaRef = useRef<HTMLDivElement>(null)

  // Initialize tabs from URL/IPC on mount
  useEffect(() => {
    initializeTabs()
  }, [])

  // Listen for window reattach tab requests
  useEffect(() => {
    return onReattachTab()
  }, [])

  // Poll foreground process names periodically to keep tab labels in sync
  useEffect(() => {
    return pollTabLabels()
  }, [])

  // Keyboard shortcut listener utilizing Zustand direct state fetching to prevent duplicate event bindings
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      let key = e.key.toLowerCase()
      if (key === 'control') key = 'ctrl'

      if (['ctrl', 'alt', 'shift', 'meta'].includes(key)) return

      const parts = []
      if (e.ctrlKey) parts.push('ctrl')
      if (e.altKey) parts.push('alt')
      if (e.shiftKey) parts.push('shift')
      if (e.metaKey) parts.push('meta')
      parts.push(key)

      const shortcut = parts.join('+')
      const currentConfig = useConfigStore.getState().config
      const action = (currentConfig.keybindings || {})[shortcut]

      if (action && !action.startsWith('terminal:')) {
        e.preventDefault()
        e.stopPropagation()
        const store = useTabStore.getState()
        const { tabs: storeTabs, activeTabId: storeActiveTabId } = store

        switch (action) {
          case 'sidebar:toggle':
            useConfigStore.getState().updateConfig({ sidebarOpen: !currentConfig.sidebarOpen })
            break
          case 'tab:new':
            store.newTab()
            break
          case 'tab:close':
            if (storeActiveTabId) store.closeTab(storeActiveTabId)
            break
          case 'tab:next': {
            if (storeTabs.length < 2) break
            const idx = storeTabs.findIndex((t) => t.id === storeActiveTabId)
            store.setActiveTabId(storeTabs[(idx + 1) % storeTabs.length].id)
            break
          }
          case 'tab:prev': {
            if (storeTabs.length < 2) break
            const idx = storeTabs.findIndex((t) => t.id === storeActiveTabId)
            store.setActiveTabId(storeTabs[(idx - 1 + storeTabs.length) % storeTabs.length].id)
            break
          }
          case 'split:extract': {
            const tab = storeTabs.find((t) => t.id === storeActiveTabId)
            if (tab) {
              store.extractToTab(storeActiveTabId, tab.focusedPath)
            }
            break
          }
          case 'split:horizontal':
            store.splitTab('horizontal')
            break
          case 'split:vertical':
            store.splitTab('vertical')
            break
          case 'pane:focus-next':
            store.navigateSplit(1)
            break
          case 'pane:focus-prev':
            store.navigateSplit(-1)
            break
          case 'settings:toggle':
            store.setIsSettingsOpen((prev) => !prev)
            break
          case 'command-palette:toggle':
            store.setIsCommandPaletteOpen((prev) => !prev)
            break
          case 'tabbar:toggle-position': {
            const currentPos = currentConfig.tabBarPosition || 'top'
            const nextPos = currentPos === 'top' ? 'left' : currentPos === 'left' ? 'right' : 'top'
            useConfigStore.getState().updateConfig({ tabBarPosition: nextPos })
            break
          }
          case 'split:unsplit':
            store.unsplitTab()
            break
          case 'app:toggle-fullscreen':
            window.windowApi?.toggleFullscreen()
            break
          case 'app:quit':
            window.windowApi?.quit()
            break
        }
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  // Escape Settings / Command Palette shortcut handling
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const store = useTabStore.getState()
      if (e.key === 'Escape' && store.isCommandPaletteOpen) {
        store.setIsCommandPaletteOpen(false)
        e.preventDefault()
        e.stopPropagation()
      } else if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        e.stopPropagation()
        store.setIsSettingsOpen((prev) => !prev)
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault()
        e.stopPropagation()
        store.setIsCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
  }, [])

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100vw',
          height: '100vh',
          background: 'var(--app-bg)',
          color: 'var(--app-fg)',
          fontFamily: 'monospace',
          fontSize: 14
        }}
      >
        {error}
      </div>
    )
  }

  const tabBarTabs: TabBarTab[] = tabs.map((t) => ({ id: t.id, label: t.label }))

  // Detached/popout mode
  if (isDetached) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TitleBar />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--app-panel-bg)',
            borderBottom: '1px solid var(--app-border)',
            height: 28,
            padding: '0 12px',
            userSelect: 'none'
          }}
        >
          <span style={{ color: 'var(--app-fg-subtle)', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>
            detached
          </span>
          <span
            onClick={reattachMe}
            style={{
              color: 'var(--app-fg-muted)',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'system-ui, sans-serif'
            }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLElement).style.color = 'var(--app-fg)'
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLElement).style.color = 'var(--app-fg-muted)'
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

  const handleContextMenuAction = (
    tabId: string,
    path: number[],
    action: 'split-h' | 'split-v' | 'close'
  ) => {
    onFocusSplit(tabId, path)

    if (action === 'split-h') {
      splitTab('horizontal', tabId, path)
    } else if (action === 'split-v') {
      splitTab('vertical', tabId, path)
    } else if (action === 'close') {
      const tab = tabs.find((t) => t.id === tabId)
      if (tab) {
        const targetNode = getNode(tab.root, path)
        if (targetNode?.terminalId) {
          closeSplit(tabId, targetNode.terminalId)
        }
      }
    }
  }

  const themeObj =
    typeof config.theme === 'string' && builtinThemes[config.theme]
      ? builtinThemes[config.theme]
      : typeof config.theme === 'object'
        ? config.theme
        : builtinThemes['catppuccin-mocha']

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
  const activeTerminalId = activeTab
    ? getNode(activeTab.root, activeTab.focusedPath)?.terminalId || null
    : null

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: appBg,
        ['--app-bg' as any]: themeObj.background,
        ['--app-fg' as any]: themeObj.foreground,
        ['--app-border' as any]: themeObj.selection || 'rgba(255,255,255,0.1)',
        ['--app-accent' as any]: themeObj.magenta || themeObj.cursor || 'var(--app-accent)',
        ['--app-red' as any]: themeObj.red || 'var(--app-red)',
        ['--app-green' as any]: themeObj.green || 'var(--app-green)',
        ['--app-yellow' as any]: themeObj.yellow || 'var(--app-yellow)',
        ['--app-blue' as any]: themeObj.blue || 'var(--app-blue)',
        ['--app-fg-subtle' as any]: 'color-mix(in srgb, var(--app-fg) 70%, transparent)',
        ['--app-fg-muted' as any]: 'color-mix(in srgb, var(--app-fg) 40%, transparent)',
        ['--app-panel-bg' as any]: 'rgba(0,0,0,0.15)',
        ['--app-modal-bg' as any]: 'rgba(0,0,0,0.25)'
      }}
    >
      <TitleBar onOpenSettings={() => setIsSettingsOpen(true)} />
      {(!config.tabBarPosition || config.tabBarPosition === 'top') && (
        <TabBar
          tabs={tabBarTabs}
          activeTabId={activeTabId}
          onSelect={selectTab}
          onClose={closeTab}
          onNew={newTab}
          onDragStart={handleDragStart}
          onDragMove={(x, y) => handleDragMove(x, y, terminalAreaRef.current)}
          onDragEnd={(tabId, x, y) => handleDragEnd(tabId, x, y, terminalAreaRef.current)}
          onRenameTab={renameTab}
        />
      )}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', borderTop: (config.tabBarPosition === 'left' || config.tabBarPosition === 'right') ? '1px solid var(--app-border)' : 'none' }}>
        {config.tabBarPosition === 'left' && (
          <TabBar
            tabs={tabBarTabs}
            activeTabId={activeTabId}
            onSelect={selectTab}
            onClose={closeTab}
            onNew={newTab}
            onDragStart={handleDragStart}
            onDragMove={(x, y) => handleDragMove(x, y, terminalAreaRef.current)}
            onDragEnd={(tabId, x, y) => handleDragEnd(tabId, x, y, terminalAreaRef.current)}
            onRenameTab={renameTab}
          />
        )}
        {config.sidebarOpen && config.sidebarPlacement === 'left' && (
          <Sidebar
            onRunScript={handleRunScript}
            onInjectSnippet={handleInjectSnippet}
            onViewSession={(sessionId) => setViewingHistorySessionId(sessionId)}
            activeTerminalId={activeTerminalId}
            onViewFile={(filePath) => setPreviewFilePath(filePath)}
            onLaunchConnection={(id) => newTab(undefined, id)}
          />
        )}
        <div
          ref={terminalAreaRef}
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            borderTop: (!config.tabBarPosition || config.tabBarPosition === 'top') ? '1px solid var(--app-border)' : 'none'
          }}
        >
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
                onExtract={
                  collectTerminalIds(tab.root).length > 1
                    ? (path) => extractToTab(tab.id, path)
                    : undefined
                }
                onFocus={(path) => onFocusSplit(tab.id, path)}
                onExit={(terminalId) => closeSplit(tab.id, terminalId)}
                onResize={(path, newSizes) => onResize(tab.id, path, newSizes)}
                onContextMenuAction={(path, action) =>
                  handleContextMenuAction(tab.id, path, action)
                }
              />
            </div>
          ))}
          <div
            id="drag-zone-right"
            style={{
              display: 'none',
              position: 'absolute',
              top: 0,
              right: 0,
              width: '20%',
              height: '100%',
              background: 'color-mix(in srgb, var(--app-accent) 15%, transparent)',
              border: '2px dashed var(--app-accent)',
              zIndex: 100,
              pointerEvents: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--app-fg)',
              fontSize: 13,
              fontFamily: 'system-ui, sans-serif'
            }}
          >
            split right
          </div>
          <div
            id="drag-zone-bottom"
            style={{
              display: 'none',
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '20%',
              background: 'color-mix(in srgb, var(--app-accent) 15%, transparent)',
              border: '2px dashed var(--app-accent)',
              zIndex: 100,
              pointerEvents: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--app-fg)',
              fontSize: 13,
              fontFamily: 'system-ui, sans-serif'
            }}
          >
            split down
          </div>
        </div>
        {config.sidebarOpen && config.sidebarPlacement === 'right' && (
          <Sidebar
            onRunScript={handleRunScript}
            onInjectSnippet={handleInjectSnippet}
            onViewSession={(sessionId) => setViewingHistorySessionId(sessionId)}
            activeTerminalId={activeTerminalId}
            onViewFile={(filePath) => setPreviewFilePath(filePath)}
            onLaunchConnection={(id) => newTab(undefined, id)}
          />
        )}
        {config.tabBarPosition === 'right' && (
          <TabBar
            tabs={tabBarTabs}
            activeTabId={activeTabId}
            onSelect={selectTab}
            onClose={closeTab}
            onNew={newTab}
            onDragStart={handleDragStart}
            onDragMove={(x, y) => handleDragMove(x, y, terminalAreaRef.current)}
            onDragEnd={(tabId, x, y) => handleDragEnd(tabId, x, y, terminalAreaRef.current)}
            onRenameTab={renameTab}
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
        <FilePreviewModal filePath={previewFilePath} onClose={() => setPreviewFilePath(null)} />
      )}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        actions={[
          { id: 'settings', label: 'Settings: Open', onExecute: () => setIsSettingsOpen(true) },
          {
            id: 'config-file',
            label: 'Settings: Open config.json5 in Editor',
            onExecute: openConfig
          },
          {
            id: 'toggle-sidebar',
            label: 'View: Toggle Sidebar',
            onExecute: () => updateConfig({ sidebarOpen: !config.sidebarOpen })
          },
          { id: 'new-tab', label: 'View: New Tab', onExecute: newTab },
          { id: 'split-h', label: 'View: Split Horizontal', onExecute: () => splitTab('horizontal') },
          { id: 'split-v', label: 'View: Split Vertical', onExecute: () => splitTab('vertical') },
          { id: 'split-unsplit', label: 'View: Unsplit Tabs', onExecute: () => unsplitTab() },
          { id: 'toggle-fullscreen', label: 'View: Toggle Fullscreen', onExecute: () => window.windowApi?.toggleFullscreen() },
          { id: 'app-exit', label: 'App: Exit', onExecute: () => window.windowApi?.quit() },
          {
            id: 'extract',
            label: 'View: Extract Pane to New Tab',
            onExecute: () => {
              if (activeTabId) extractToTab(activeTabId, activeTab!.focusedPath)
            }
          },
          {
            id: 'detach-window',
            label: 'View: Detach Tab to Window',
            onExecute: () => {
              if (activeTabId) detachTab(activeTabId)
            }
          },
          { id: 'tabbar-pos-top', label: 'View: Position Tab Bar at Top', onExecute: () => updateConfig({ tabBarPosition: 'top' }) },
          { id: 'tabbar-pos-left', label: 'View: Position Tab Bar on Left', onExecute: () => updateConfig({ tabBarPosition: 'left' }) },
          { id: 'tabbar-pos-right', label: 'View: Position Tab Bar on Right', onExecute: () => updateConfig({ tabBarPosition: 'right' }) },
          ...Object.keys(builtinThemes).map((themeName) => ({
            id: `theme-${themeName}`,
            label: `Theme: Set to ${themeName.replace('-', ' ')}`,
            onExecute: () => updateConfig({ theme: themeName })
          })),
          ...(config.profiles || []).map((profile) => ({
            id: `launch-profile-${profile.id}`,
            label: `Profiles: Launch ${profile.name}`,
            onExecute: () => newTab(profile.id)
          })),
          ...(config.sshHosts || []).map((host) => ({
            id: `launch-ssh-${host.id}`,
            label: `SSH: Connect to ${host.name} (${host.host})`,
            onExecute: () => newTab(undefined, host.id)
          }))
        ]}
      />
    </div>
  )
}

export default App
