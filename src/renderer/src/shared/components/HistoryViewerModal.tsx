import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { useConfig } from '@/features/settings/useConfigStore'
import { builtinThemes } from '@/themes'
import '@xterm/xterm/css/xterm.css'

interface HistoryViewerModalProps {
  sessionId: string
  onClose: () => void
}

const HistoryViewerModal: React.FC<HistoryViewerModalProps> = ({ sessionId, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const { config } = useConfig()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const baseThemeObj = typeof config.theme === 'string' && builtinThemes[config.theme]
      ? builtinThemes[config.theme]
      : (typeof config.theme === 'object' ? config.theme : builtinThemes['catppuccin-mocha'])

    const themeObj = { ...baseThemeObj }
    if (themeObj.background && typeof config.opacity === 'number') {
      themeObj.background = `color-mix(in srgb, var(--app-bg) 95%, transparent)` // Enforce solid/opaque for modal
    }

    const term = new Terminal({
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      theme: themeObj,
      disableStdin: true,
      cursorStyle: 'bar',
      cursorBlink: false,
      scrollback: 1000000 // Unlimited for history viewing
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    
    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.open(container)

    terminalRef.current = term
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    // Fetch full transcript
    window.historyApi?.getSessionTranscript(sessionId).then(data => {
      term.write(data, () => {
        // Fit after data loads and layout stabilizes
        setTimeout(() => {
          try {
            fitAddon.fit()
          } catch {}
        }, 100)
      })
    })

    const handleResize = () => {
      try { fitAddon.fit() } catch {}
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
    }
  }, [sessionId])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleCopy = () => {
    const sel = terminalRef.current?.getSelection()
    if (sel) {
      navigator.clipboard.writeText(sel).catch(() => {})
    }
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
    >
      <div
        style={{
          width: '80%',
          height: '80%',
          backgroundColor: 'var(--app-bg)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)'
        }}>
          <h3 style={{ margin: 0, color: 'var(--app-fg)', fontSize: 16, fontWeight: 500 }}>
            Historical Session Viewer
          </h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleCopy}
              title="Copy Selected Text"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                padding: '4px 12px',
                borderRadius: 4,
                color: 'var(--app-fg)',
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              Copy Selection
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--app-fg-subtle)',
                cursor: 'pointer',
                fontSize: 20,
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Terminal Container */}
        <div 
          ref={containerRef} 
          style={{ flex: 1, padding: '10px 10px 10px 20px', overflow: 'hidden' }} 
        />
      </div>
    </div>
  )
}

export default HistoryViewerModal
