import React, { useEffect, useRef, useState } from 'react'
import { useConfig } from '@/features/settings/useConfigStore'
import { useTabStore } from '@/features/terminal/useTabStore'
import { leafCount } from '@/features/terminal/splitTree'
import SearchOverlay from '@/shared/components/SearchOverlay'
import { buildShortcutString } from '@/shared/utils/keybindings'

interface BrowserViewProps {
  browserId: string
  initialUrl?: string
  isActive: boolean
  isFocused?: boolean
  onFocus?: () => void
  onExit?: (browserId: string) => void
  onExtract?: () => void
  onContextMenuAction?: (action: 'split-h' | 'split-v' | 'close') => void
}

function resolveUrl(input: string, defaultSearchEngine: 'duckduckgo' | 'google' | 'bing'): string {
  const trimmed = input.trim()
  
  // Basic URL regex (detects absolute URLs, domains like google.com, or localhost)
  const isUrlPattern = new RegExp('^(https?:\\/\\/)?([\\da-z.-]+)\\.([a-z.]{2,6})([\\/\\w .-]*)*\\/?$', 'i').test(trimmed) || 
                       trimmed.startsWith('localhost:') || 
                       trimmed.startsWith('http://localhost') ||
                       /^file:\/\/\//.test(trimmed)
  
  if (isUrlPattern) {
    if (!/^https?:\/\//i.test(trimmed) && !/^file:\/\/\//i.test(trimmed)) {
      return `https://${trimmed}`
    }
    return trimmed
  }

  // Treat as search query
  const query = encodeURIComponent(trimmed)
  switch (defaultSearchEngine) {
    case 'google':
      return `https://www.google.com/search?q=${query}`
    case 'bing':
      return `https://www.bing.com/search?q=${query}`
    case 'duckduckgo':
    default:
      return `https://duckduckgo.com/?q=${query}`
  }
}

export const BrowserView: React.FC<BrowserViewProps> = ({
  browserId,
  initialUrl,
  isActive,
  isFocused,
  onFocus,
  onExit,
  onExtract,
  onContextMenuAction
}) => {
  const webviewRef = useRef<any>(null)
  const { config } = useConfig()
  const renameTab = useTabStore((s) => s.renameTab)
  const updateBrowserUrl = useTabStore((s) => s.updateBrowserUrl)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const dragState = useTabStore((s) => s.dragState)
  const tabRoot = useTabStore((s) => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    return tab?.root
  })
  const hasSplits = tabRoot ? leafCount(tabRoot) > 1 : false

  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive
  const isFocusedRef = useRef(isFocused)
  isFocusedRef.current = isFocused
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId
  const hasSplitsRef = useRef(hasSplits)
  hasSplitsRef.current = hasSplits
  const onFocusRef = useRef(onFocus)
  onFocusRef.current = onFocus

  const homepage = config.browserHomepage || 'https://duckduckgo.com'
  const searchEngine = config.browserSearchEngine || 'duckduckgo'
  const isAdblockEnabled = config.browserAdblockEnabled !== false

  const [initialUrlResolved, setInitialUrlResolved] = useState(() => initialUrl || homepage)
  const [urlInput, setUrlInput] = useState(initialUrlResolved)

  // Track the URL we want the webview to show. This persists across renders
  // and is checked in the did-navigate handler to detect if the webview
  // navigated away from the desired page (e.g. to the homepage).
  const desiredUrlRef = useRef(initialUrl || homepage)
  if (initialUrl && initialUrl !== desiredUrlRef.current) {
    desiredUrlRef.current = initialUrl
    setInitialUrlResolved(initialUrl)
  }
  const [isLoading, setIsLoading] = useState(false)
  const [pageTitle, setPageTitle] = useState('Web Browser')
  
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  
  const [blockedCount, setBlockedCount] = useState(0)
  const [localAdblockEnabled, setLocalAdblockEnabled] = useState(isAdblockEnabled)
  const [appPreloadPath, setAppPreloadPath] = useState<string | undefined>(undefined)

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMatch, setActiveMatch] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)

  const searchShortcut = Object.entries(config.keybindings || {}).find(
    ([_, val]) => val === 'terminal:search'
  )?.[0] || 'ctrl+f'
  const searchShortcutLabel = searchShortcut
    .split('+')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('+')

  const devtoolsShortcut = Object.entries(config.keybindings || {}).find(
    ([_, val]) => val === 'browser:devtools'
  )?.[0] || 'f12'
  const devtoolsShortcutLabel = devtoolsShortcut
    .split('+')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('+')

  useEffect(() => {
    if (window.adblockerApi) {
      window.adblockerApi.getAppPreloadPath().then((path) => {
        setAppPreloadPath(path)
      })
    } else {
      setAppPreloadPath('')
    }
  }, [])

  useEffect(() => {
    setLocalAdblockEnabled(isAdblockEnabled)
  }, [isAdblockEnabled])

  // Let mouse events pass through the webview during tab drag so
  // the renderer's document receives mousemove/mouseup events
  useEffect(() => {
    if (webviewRef.current && window.windowApi) {
      try {
        const wcId = webviewRef.current.getWebContentsId()
        window.windowApi.setWebviewIgnoreMouseEvents(wcId, !!dragState)
      } catch {}
    }
  }, [dragState])

  // Forward mouse events from webview's guest page to the renderer's document
  // so tab drag-and-drop continues working when the cursor is over this pane.
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const onIpcMessage = (e: any) => {
      if (e.channel !== 'vet-mouse' || !e.args?.[0]) return
      const { type, x, y, button } = e.args[0]
      try {
        const rect = webview.getBoundingClientRect()
        document.dispatchEvent(new MouseEvent(type === 'move' ? 'mousemove' : 'mouseup', {
          clientX: rect.left + x,
          clientY: rect.top + y,
          button: button ?? 0,
          bubbles: true
        }))
      } catch {}
    }

    webview.addEventListener('ipc-message', onIpcMessage)
    return () => {
      try { webview.removeEventListener('ipc-message', onIpcMessage) } catch {}
    }
  }, [appPreloadPath])

  const updateNavigationButtons = () => {
    if (webviewRef.current) {
      try {
        setCanGoBack(webviewRef.current.canGoBack())
        setCanGoForward(webviewRef.current.canGoForward())
      } catch {}
    }
  }

  const handleLoadStart = () => {
    setIsLoading(true)
  }

  const handleDomReady = () => {
    // Stats are handled reactively via adblockerApi.onBlockedEvent and main-process navigation listeners
  }

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const onStartLoading = () => handleLoadStart()
    const onStopLoading = () => setIsLoading(false)
    const onDomReady = () => {
      handleDomReady()
      updateNavigationButtons()
    }
    const onNavigate = (e: any) => {
      setUrlInput(e.url)
      updateNavigationButtons()
      updateBrowserUrl(browserId, e.url)

      // If the webview navigated to a URL that doesn't match our desired URL
      // (e.g. it landed on the homepage after a split remount), navigate it
      // back to the correct page.
      const desired = desiredUrlRef.current
      if (desired && e.url !== desired) {
        try {
          webview.src = desired
        } catch {}
      }

      if (window.historyApi?.addBrowserVisit) {
        let title = ''
        try {
          title = webview.getTitle()
        } catch {}
        window.historyApi.addBrowserVisit(e.url, title)
      }
    }
    const onTitleUpdate = (e: any) => {
      const title = e.title || 'Web Browser'
      if (!hasSplitsRef.current && isActiveRef.current && isFocusedRef.current && activeTabIdRef.current) {
        renameTab(activeTabIdRef.current, title)
      }
      if (window.historyApi?.addBrowserVisit) {
        try {
          const currentUrl = webview.getURL()
          if (currentUrl) {
            window.historyApi.addBrowserVisit(currentUrl, title)
          }
        } catch {}
      }
    }

    const onFoundInPage = (ev: any) => {
      const result = ev.result
      if (result) {
        setTotalMatches(result.matches || 0)
        setActiveMatch(result.activeMatchOrdinal || 0)
      }
    }

    const handleFocus = () => {
      if (onFocusRef.current) {
        onFocusRef.current()
      }
    }

    webview.addEventListener('did-start-loading', onStartLoading)
    webview.addEventListener('did-stop-loading', onStopLoading)
    webview.addEventListener('dom-ready', onDomReady)
    webview.addEventListener('did-navigate', onNavigate)
    webview.addEventListener('did-navigate-in-page', onNavigate)
    webview.addEventListener('page-title-updated', onTitleUpdate)
    webview.addEventListener('found-in-page', onFoundInPage)
    webview.addEventListener('focus', handleFocus)
    webview.addEventListener('mousedown', handleFocus)

    // Set initial src now that webview is attached and listeners are registered
    webview.src = initialUrlResolved

    return () => {
      try { webview.removeEventListener('did-start-loading', onStartLoading) } catch {}
      try { webview.removeEventListener('did-stop-loading', onStopLoading) } catch {}
      try { webview.removeEventListener('dom-ready', onDomReady) } catch {}
      try { webview.removeEventListener('did-navigate', onNavigate) } catch {}
      try { webview.removeEventListener('did-navigate-in-page', onNavigate) } catch {}
      try { webview.removeEventListener('page-title-updated', onTitleUpdate) } catch {}
      try { webview.removeEventListener('found-in-page', onFoundInPage) } catch {}
      try { webview.removeEventListener('focus', handleFocus) } catch {}
      try { webview.removeEventListener('mousedown', handleFocus) } catch {}
    }
  }, [appPreloadPath])

  // Subscribe to block events
  useEffect(() => {
    if (!window.adblockerApi) return

    const unsubscribe = window.adblockerApi.onBlockedEvent((_event, data) => {
      if (webviewRef.current) {
        try {
          const wcId = webviewRef.current.getWebContentsId()
          if (wcId && data.webContentsId === wcId) {
            setBlockedCount(data.count)
          }
        } catch {}
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Focus webview when isFocused changes to true
  useEffect(() => {
    if (isFocused && webviewRef.current) {
      try {
        webviewRef.current.focus()
      } catch {}
    }
  }, [isFocused])

  // When the webview becomes available (appPreloadPath resolves), check if
  // its current URL matches the desired URL and navigate if needed.
  useEffect(() => {
    if (initialUrl && webviewRef.current) {
      try {
        const currentUrl = webviewRef.current.getURL()
        if (currentUrl && currentUrl !== initialUrl) {
          setUrlInput(initialUrl)
          webviewRef.current.src = initialUrl
        }
      } catch {}
    }
  }, [appPreloadPath])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const resolved = resolveUrl(urlInput, searchEngine)
      setUrlInput(resolved)
      if (webviewRef.current) {
        webviewRef.current.src = resolved
      }
    }
  }

  const handleGoBack = () => {
    if (webviewRef.current && webviewRef.current.canGoBack()) {
      webviewRef.current.goBack()
    }
  }

  const handleGoForward = () => {
    if (webviewRef.current && webviewRef.current.canGoForward()) {
      webviewRef.current.goForward()
    }
  }

  const handleReload = () => {
    if (webviewRef.current) {
      webviewRef.current.reload()
    }
  }

  const handleGoHome = () => {
    setUrlInput(homepage)
    if (webviewRef.current) {
      webviewRef.current.src = homepage
    }
  }

  const toggleLocalAdblock = async () => {
    const newState = !localAdblockEnabled
    setLocalAdblockEnabled(newState)
    if (window.adblockerApi) {
      await window.adblockerApi.toggle(newState)
      if (webviewRef.current) {
        webviewRef.current.reload()
      }
    }
  }

  // Handle configurable keybindings for search overlay and developer tools
  useEffect(() => {
    if (!isActive || !isFocused) return

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const shortcut = buildShortcutString(e)
      if (!shortcut) return

      const action = (config.keybindings || {})[shortcut]
      if (action === 'terminal:search') {
        e.preventDefault()
        e.stopPropagation()
        setIsSearchOpen(true)
      } else if (action === 'browser:devtools') {
        e.preventDefault()
        e.stopPropagation()
        if (webviewRef.current) {
          webviewRef.current.openDevTools()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true)
    }
  }, [isActive, isFocused, config.keybindings])

  // Handle custom window events for command palette actions
  useEffect(() => {
    if (!isActive || !isFocused) return

    const handleBrowserAction = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.action === 'browser:devtools') {
        if (webviewRef.current) {
          webviewRef.current.openDevTools()
        }
      } else if (customEvent.detail?.action === 'browser:search') {
        setIsSearchOpen(true)
      }
    }

    window.addEventListener('browser:action', handleBrowserAction)
    return () => {
      window.removeEventListener('browser:action', handleBrowserAction)
    }
  }, [isActive, isFocused])

  const handleSearch = (text: string, options: { caseSensitive: boolean; useRegex: boolean; wholeWord: boolean; backwards?: boolean }) => {
    setSearchQuery(text)
    if (webviewRef.current) {
      if (text) {
        webviewRef.current.findInPage(text, {
          findNext: options.backwards !== undefined,
          forward: !options.backwards,
          matchCase: options.caseSensitive
        })
      } else {
        webviewRef.current.stopFindInPage('clearSelection')
        setTotalMatches(0)
        setActiveMatch(0)
      }
    }
  }

  const closeSearch = () => {
    setIsSearchOpen(false)
    setSearchQuery('')
    setTotalMatches(0)
    setActiveMatch(0)
    if (webviewRef.current) {
      webviewRef.current.stopFindInPage('clearSelection')
      webviewRef.current.focus()
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  return (
    <div
      onMouseDown={onFocus}
      onContextMenu={handleContextMenu}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'var(--app-bg)',
        border: isFocused ? '1px solid var(--app-accent)' : '1px solid var(--app-border)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Browser Nav Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: 'rgba(0, 0, 0, 0.15)',
          borderBottom: '1px solid var(--app-border)',
          backdropFilter: 'blur(8px)',
          userSelect: 'none'
        }}
      >
        {/* Navigation Buttons */}
        <button
          onClick={handleGoBack}
          disabled={!canGoBack}
          title="Back"
          style={{
            background: 'transparent',
            border: 'none',
            color: canGoBack ? 'var(--app-fg)' : 'var(--app-fg-muted)',
            cursor: canGoBack ? 'pointer' : 'default',
            padding: 6,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => {
            if (canGoBack) (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>

        <button
          onClick={handleGoForward}
          disabled={!canGoForward}
          title="Forward"
          style={{
            background: 'transparent',
            border: 'none',
            color: canGoForward ? 'var(--app-fg)' : 'var(--app-fg-muted)',
            cursor: canGoForward ? 'pointer' : 'default',
            padding: 6,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => {
            if (canGoForward) (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>

        <button
          onClick={handleReload}
          title="Reload"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--app-fg)',
            cursor: 'pointer',
            padding: 6,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          {isLoading ? (
            <div
              style={{
                width: 12,
                height: 12,
                border: '2px solid var(--app-fg-muted)',
                borderTop: '2px solid var(--app-fg)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          )}
        </button>

        <button
          onClick={handleGoHome}
          title="Home"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--app-fg)',
            cursor: 'pointer',
            padding: 6,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </button>

        <button
          onClick={() => {
            if (isSearchOpen) {
              closeSearch()
            } else {
              setIsSearchOpen(true)
            }
          }}
          title={`Find in Page (${searchShortcutLabel})`}
          style={{
            background: isSearchOpen ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
            border: 'none',
            color: 'var(--app-fg)',
            cursor: 'pointer',
            padding: 6,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!isSearchOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)'
          }}
          onMouseLeave={(e) => {
            if (!isSearchOpen) (e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        <button
          onClick={() => {
            if (webviewRef.current) {
              webviewRef.current.openDevTools()
            }
          }}
          title={`Developer Tools (${devtoolsShortcutLabel})`}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--app-fg)',
            cursor: 'pointer',
            padding: 6,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </button>

        {/* Address Input */}
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--app-border)',
            borderRadius: 6,
            color: 'var(--app-fg)',
            padding: '4px 10px',
            fontSize: 12,
            outline: 'none',
            fontFamily: 'system-ui, sans-serif',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--app-accent)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--app-border)'
          }}
        />

        {/* Adblock Shield Shield Badge */}
        <button
          onClick={toggleLocalAdblock}
          title={localAdblockEnabled ? `Adblocker Enabled: ${blockedCount} blocked` : 'Adblocker Disabled'}
          style={{
            background: localAdblockEnabled ? 'rgba(235, 111, 146, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${localAdblockEnabled ? 'var(--app-red)' : 'var(--app-border)'}`,
            borderRadius: 6,
            color: localAdblockEnabled ? 'var(--app-red)' : 'var(--app-fg-muted)',
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.2s'
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill={localAdblockEnabled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          {localAdblockEnabled && <span>{blockedCount}</span>}
        </button>

        {/* Close View button (if part of splits) */}
        {onExit && (
          <button
            onClick={() => onExit(browserId)}
            title="Close Split"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--app-fg-muted)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1 }}>×</span>
          </button>
        )}

        {/* Extract to new tab button (only in splits) */}
        {isActive && onExtract && (
          <button
            onClick={onExtract}
            title="Extract to new tab"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--app-fg-muted)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 14L21 3" />
              <path d="M15 3h6v6" />
              <path d="M14 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h11" />
            </svg>
          </button>
        )}
      </div>

      {/* Guest Webview */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
        {appPreloadPath !== undefined && (
          <>
            {/* eslint-disable react/no-unknown-property */}
            <webview
              ref={webviewRef}
              id={browserId}
              partition="persist:browser"
              allowpopups={true}
              preload={appPreloadPath || undefined}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'white'
              }}
            />
            {/* eslint-enable react/no-unknown-property */}
          </>
        )}
      </div>

      {/* Search Overlay */}
      {isSearchOpen && (
        <SearchOverlay
          onSearch={handleSearch}
          onClose={closeSearch}
          matchesInfo={{ active: activeMatch, total: totalMatches }}
          hideRegex={true}
          hideWholeWord={true}
        />
      )}

      {/* Spinner animation stylesheet */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
export default BrowserView
