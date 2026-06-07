import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SerializeAddon } from '@xterm/addon-serialize'
import { SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { ImageAddon } from '@xterm/addon-image'
import '@xterm/xterm/css/xterm.css'
import { useConfig } from '@/features/settings/useConfigStore'
import { resolveTheme } from '@/themes'
import { useClipboardStore } from '@/features/clipboard/useClipboardStore'
import SearchOverlay from '@/shared/components/SearchOverlay'
import ContextMenu, { ContextMenuAction } from '@/shared/components/ContextMenu'
import { registerDestroyTerminalCache } from '../useTabStore'

interface TerminalViewProps {
  terminalId: string
  isActive: boolean
  isFocused?: boolean
  onExit?: (terminalId: string) => void
  onFocus?: () => void
  onExtract?: () => void
  onContextMenuAction?: (action: 'split-h' | 'split-v' | 'close') => void
}

interface TerminalCacheEntry {
  term: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
  unsubData: () => void
  unsubExit: () => void
  onExit?: (terminalId: string) => void
  webglAddon?: WebglAddon | null
  imageAddon?: ImageAddon | null
}

const terminalCache = new Map<string, TerminalCacheEntry>()

export function destroyTerminalCache(terminalId: string) {
  const entry = terminalCache.get(terminalId)
  if (entry) {
    entry.unsubData()
    entry.unsubExit()
    window.serializeAddons?.delete(terminalId)
    if (entry.webglAddon) entry.webglAddon.dispose()
    if (entry.imageAddon) entry.imageAddon.dispose()
    entry.term.dispose()
    terminalCache.delete(terminalId)
  }
}

registerDestroyTerminalCache(destroyTerminalCache)

function TerminalView({ terminalId, isActive, isFocused, onExit, onFocus, onExtract, onContextMenuAction }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const { config } = useConfig()
  const configRef = useRef(config)
  configRef.current = config

  const webglAddonRef = useRef<WebglAddon | null>(null)
  const imageAddonRef = useRef<ImageAddon | null>(null)

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const isSearchOpenRef = useRef(isSearchOpen)
  isSearchOpenRef.current = isSearchOpen

  useEffect(() => {
    const api = window.terminalApi
    if (!api) return

    const container = containerRef.current
    if (!container) return

    let term: Terminal
    let fitAddon: FitAddon
    let searchAddon: SearchAddon

    let entry = terminalCache.get(terminalId)

    if (!entry) {
      const baseThemeObj = resolveTheme(config.theme, config.customThemes)

      const themeObj = { ...baseThemeObj }
      if (themeObj.background && typeof config.opacity === 'number') {
        const hex = themeObj.background.replace('#', '')
        if (hex.length === 6) {
          const alphaHex = Math.round(config.opacity * 255).toString(16).padStart(2, '0')
          themeObj.background = `#${hex}${alphaHex}`
        }
      }

      term = new Terminal({
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        cursorBlink: config.cursorBlink,
        cursorStyle: config.cursorStyle,
        allowProposedApi: true,
        allowTransparency: true,
        scrollback: config.virtualScrollbackEnabled ? (config.virtualScrollbackBufferSize || 1000) : 100000,
        theme: themeObj
      })

      fitAddon = new FitAddon()
      const serializeAddon = new SerializeAddon()
      searchAddon = new SearchAddon()
      
      term.loadAddon(fitAddon)
      term.loadAddon(serializeAddon)
      term.loadAddon(searchAddon)
      const urlPathRegex = /(?:https?:\/\/[^\s]+)|(?:(?:[a-zA-Z]:[\\/]+|\/)?(?:[\w.-]+[\\/]+)+[\w.-]+(?::\d+)?)/
      term.loadAddon(new WebLinksAddon((_event, uri) => {
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          window.windowApi?.openExternal?.(uri)
        } else {
          const match = uri.match(/^(.+?)(?::(\d+))?$/)
          if (match) {
            window.workspaceApi?.revealPath?.(match[1])
          }
        }
      }, {
        urlRegex: urlPathRegex,
        hover: () => { document.body.style.cursor = 'pointer' },
        leave: () => { document.body.style.cursor = '' }
      }))
      
      try {
        const imageAddon = new ImageAddon({
          sixelSupport: true,
          sixelScrolling: true,
          enableSizeReports: true
        })
        term.loadAddon(imageAddon)
        imageAddonRef.current = imageAddon
      } catch (e) {
        console.warn('Failed to load ImageAddon', e)
      }
      
      term.open(container)

      if (config.webglEnabled) {
        try {
          const webglAddon = new WebglAddon()
          webglAddon.onContextLoss(() => {
            console.warn('WebGL context lost, disposing addon to fallback to canvas renderer')
            webglAddon.dispose()
            webglAddonRef.current = null
            const ent = terminalCache.get(terminalId)
            if (ent) ent.webglAddon = null
          })
          term.loadAddon(webglAddon)
          webglAddonRef.current = webglAddon
        } catch (e) {
          console.warn('WebGL addon failed to load, falling back to canvas', e)
        }
      }

      if (!window.serializeAddons) {
        window.serializeAddons = new Map()
      }
      window.serializeAddons.set(terminalId, serializeAddon)

      // Fetch history (mainly useful when detaching to a new window)
      let oldestTimestamp = Date.now()
      let isFetchingHistory = false
      let hasMoreHistory = true
      let initialWriteDone = false

      api.getHistory(terminalId).then((res: any) => {
        let historyData = ''
        if (typeof res === 'string') {
          historyData = res
        } else if (res && typeof res === 'object') {
          historyData = res.data || ''
          if (res.oldestTimestamp) oldestTimestamp = res.oldestTimestamp
        }
        
        if (historyData) {
          term.write(historyData, () => {
            initialWriteDone = true
          })
        } else {
          initialWriteDone = true
        }
      }).catch(() => {
        initialWriteDone = true
      })

      term.onScroll(async (scrollPos) => {
        if (!initialWriteDone) return
        if (!config.virtualScrollbackEnabled || isFetchingHistory || !hasMoreHistory || scrollPos > 10) return

        isFetchingHistory = true
        try {
          const apiHist = (window as any).historyApi
          if (!apiHist) return

          const chunks = await apiHist.getScrollbackChunk(terminalId, oldestTimestamp)
          if (chunks && chunks.length > 0) {
            oldestTimestamp = chunks[0].timestamp
            
            const serializeAddon = window.serializeAddons?.get(terminalId)
            if (serializeAddon) {
              const currentData = serializeAddon.serialize()
              const oldData = chunks.map((c: any) => c.data).join('')
              
              const linesAdded = (oldData.match(/\n/g) || []).length

              term.reset()
              term.write(oldData + currentData, () => {
                term.scrollToLine(linesAdded + scrollPos)
              })
            }
          } else {
            hasMoreHistory = false
          }
        } catch (err) {
          console.error('Failed to fetch history', err)
        } finally {
          isFetchingHistory = false
        }
      })

      // Enable forwarding immediately so PTY output flows to xterm
      api.enableForwarding(terminalId).catch(() => {})

      const unsubData = api.onData((pId, data) => {
        if (pId === terminalId) {
          term.write(data)
        }
      })

      const unsubExit = api.onExit((pId, exitCode) => {
        if (pId === terminalId) {
          term.write(`\r\n[Process exited with code ${exitCode}]\r\n`)
          const curEntry = terminalCache.get(terminalId)
          curEntry?.onExit?.(terminalId)
        }
      })

      term.onData((data) => {
        api.write(terminalId, data)
      })

      term.onResize(({ cols, rows }) => {
        api.resize(terminalId, cols, rows)
      })


      entry = {
        term,
        fitAddon,
        searchAddon,
        unsubData,
        unsubExit,
        onExit,
        webglAddon: webglAddonRef.current,
        imageAddon: imageAddonRef.current
      }
      terminalCache.set(terminalId, entry)
    } else {
      entry.onExit = onExit
      term = entry.term
      fitAddon = entry.fitAddon
      searchAddon = entry.searchAddon
      webglAddonRef.current = entry.webglAddon || null
      imageAddonRef.current = entry.imageAddon || null
      
      if (term.element) {
        container.appendChild(term.element)
      } else {
        term.open(container)
      }
    }

    terminalRef.current = term
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    // Initial fit after open or reparent
    requestAnimationFrame(() => {
      try {
        fitAddon.fit()
      } catch {
        // ignore
      }
    })

    // Focus tracking: xterm's textarea gets focus on click, focusin bubbles to container
    const handleFocusIn = () => onFocus?.()
    container.addEventListener('focusin', handleFocusIn)

    // Shortcuts via xterm attachCustomKeyEventHandler
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type === 'keydown') {
        if (e.key === 'Escape' && isSearchOpenRef.current) {
          setIsSearchOpen(false)
          return false
        }
        
        let key = e.key.toLowerCase()
        if (key === 'control') key = 'ctrl'
        if (['ctrl', 'alt', 'shift', 'meta'].includes(key)) return true

        const parts = []
        if (e.ctrlKey) parts.push('ctrl')
        if (e.altKey) parts.push('alt')
        if (e.shiftKey) parts.push('shift')
        if (e.metaKey) parts.push('meta')
        parts.push(key)

        const shortcut = parts.join('+')

        if (shortcut === 'ctrl+backspace') {
          window.terminalApi?.write(terminalId, '\x17')
          return false
        }

        const action = (configRef.current.keybindings || {})[shortcut]
        
        if (action === 'terminal:search') {
          if (isSearchOpenRef.current) {
            setIsSearchOpen(false)
            terminalRef.current?.focus()
          } else {
            setIsSearchOpen(true)
          }
          return false
        } else if (action === 'terminal:copy') {
          const sel = term.getSelection()
          if (sel) {
            navigator.clipboard.writeText(sel).catch(() => {})
            useClipboardStore.getState().add(sel)
          }
          return false
        } else if (action === 'terminal:paste') {
          navigator.clipboard.readText().then(text => window.terminalApi?.write(terminalId, text)).catch(() => {})
          return false
        } else if (action && !action.startsWith('terminal:')) {
          // Let it bubble up to window/document listeners for global actions like tab switching or splits
          return true
        }
      }
      return true
    })

    function doFit() {
      try {
        fitAddon.fit()
      } catch {
        // ignore
      }
    }

    const resizeObserver = new ResizeObserver(doFit)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      container.removeEventListener('focusin', handleFocusIn)
    }
  }, [terminalId])

  // Fit when becoming active
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit()
        } catch {
          // ignore
        }
      })
    }
  }, [isActive])

  // Focus when isFocused becomes true
  useEffect(() => {
    if (isFocused && terminalRef.current) {
      terminalRef.current.focus()
    }
  }, [isFocused])

  // Focus when sidebar closes
  useEffect(() => {
    if (!config.sidebarOpen && isFocused && terminalRef.current) {
      terminalRef.current.focus()
    }
  }, [config.sidebarOpen])

  // Dynamically update terminal options when config changes
  useEffect(() => {
    const term = terminalRef.current
    if (term) {
      const baseThemeObj = resolveTheme(config.theme, config.customThemes)

      const themeObj = { ...baseThemeObj }
      if (themeObj.background && typeof config.opacity === 'number') {
        const hex = themeObj.background.replace('#', '')
        if (hex.length === 6) {
          const alphaHex = Math.round(config.opacity * 255).toString(16).padStart(2, '0')
          themeObj.background = `#${hex}${alphaHex}`
        }
      }

      term.options.fontFamily = config.fontFamily
      term.options.fontSize = config.fontSize
      term.options.cursorBlink = config.cursorBlink
      term.options.cursorStyle = config.cursorStyle as any
      term.options.theme = themeObj
      term.options.scrollback = config.virtualScrollbackEnabled ? (config.virtualScrollbackBufferSize || 1000) : 100000

      if (config.webglEnabled && !webglAddonRef.current) {
        try {
          const webglAddon = new WebglAddon()
          webglAddon.onContextLoss(() => { 
            webglAddon.dispose(); 
            webglAddonRef.current = null;
            const entry = terminalCache.get(terminalId);
            if (entry) entry.webglAddon = null;
          })
          term.loadAddon(webglAddon)
          webglAddonRef.current = webglAddon
          const entry = terminalCache.get(terminalId);
          if (entry) entry.webglAddon = webglAddon;
        } catch(e) { console.warn('Failed to enable WebGL', e) }
      } else if (!config.webglEnabled && webglAddonRef.current) {
        webglAddonRef.current.dispose()
        webglAddonRef.current = null
        const entry = terminalCache.get(terminalId);
        if (entry) entry.webglAddon = null;
      }
    }
  }, [config])

  const handleSearch = (text: string, options: { caseSensitive: boolean; useRegex: boolean; wholeWord: boolean; backwards?: boolean }) => {
    const addon = searchAddonRef.current
    if (!addon) return
    
    if (options.backwards) {
      addon.findPrevious(text, {
        caseSensitive: options.caseSensitive,
        useRegex: options.useRegex,
        wholeWord: options.wholeWord,
      })
    } else {
      addon.findNext(text, {
        caseSensitive: options.caseSensitive,
        useRegex: options.useRegex,
        wholeWord: options.wholeWord,
      })
    }
  }

  const [contextMenuState, setContextMenuState] = useState<{ isOpen: boolean; x: number; y: number }>({ isOpen: false, x: 0, y: 0 })

  const contextMenuActions: ContextMenuAction[] = [
    {
      id: 'copy',
      label: 'Copy',
      shortcut: 'Ctrl+Shift+C',
      onExecute: () => {
        const sel = terminalRef.current?.getSelection()
        if (sel) {
          navigator.clipboard.writeText(sel).catch(() => {})
          useClipboardStore.getState().add(sel)
        }
      }
    },
    {
      id: 'paste',
      label: 'Paste',
      shortcut: 'Ctrl+Shift+V',
      onExecute: () => {
        navigator.clipboard.readText().then(text => window.terminalApi?.write(terminalId, text)).catch(() => {})
      }
    },
    {
      id: 'clear',
      label: 'Clear Screen',
      separator: true,
      onExecute: () => {
        terminalRef.current?.clear()
      }
    },
    {
      id: 'split-h',
      label: 'Split Horizontal',
      separator: true,
      onExecute: () => onContextMenuAction?.('split-h')
    },
    {
      id: 'split-v',
      label: 'Split Vertical',
      onExecute: () => onContextMenuAction?.('split-v')
    },
    {
      id: 'close',
      label: 'Close Pane',
      separator: true,
      onExecute: () => onContextMenuAction?.('close')
    }
  ]

  return (
    <div 
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenuState({ isOpen: true, x: e.clientX, y: e.clientY })
      }}
    >
      <div
        ref={containerRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          outline: isFocused ? '2px solid var(--app-accent)' : 'none',
          outlineOffset: -2
        }}
      />
      {isActive && isSearchOpen && (
        <SearchOverlay 
          onSearch={handleSearch} 
          onClose={() => {
            setIsSearchOpen(false)
            terminalRef.current?.focus()
          }} 
        />
      )}
      {isActive && onExtract && (
        <button
          className="extract-btn"
          onClick={onExtract}
          title="Extract to new tab (Ctrl+Shift+E)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 14L21 3" />
            <path d="M15 3h6v6" />
            <path d="M14 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h11" />
          </svg>
        </button>
      )}
      <ContextMenu 
        isOpen={contextMenuState.isOpen}
        x={contextMenuState.x}
        y={contextMenuState.y}
        onClose={() => setContextMenuState(prev => ({ ...prev, isOpen: false }))}
        actions={contextMenuActions}
      />
    </div>
  )
}

export default TerminalView
