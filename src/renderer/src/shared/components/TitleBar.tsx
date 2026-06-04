import { useEffect, useState } from 'react'



interface TitleBarProps {
  onOpenSettings?: () => void
}

function TitleBar({ onOpenSettings }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const api = window.windowApi
    if (!api) return

    api.isMaximized().then(setMaximized)
    return api.onMaximizeChange(setMaximized)
  }, [])

  const handleMinimize = () => window.windowApi?.minimize()
  const handleMaximize = () => window.windowApi?.maximize()
  const handleClose = () => window.windowApi?.close()

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 32,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--app-fg)',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 14,
    WebkitAppRegion: 'no-drag',
    transition: 'background 0.1s'
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 32,
        background: 'color-mix(in srgb, var(--app-bg) 75%, transparent)',
        userSelect: 'none',
        WebkitAppRegion: 'drag',
        flexShrink: 0
      }}
    >
      <div
        style={{
          paddingLeft: 12,
          color: 'var(--app-fg-muted)',
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        Vet
      </div>
      <div style={{ display: 'flex', height: '100%' }}>
        {onOpenSettings && (
          <button
            className="titlebar-btn"
            onClick={onOpenSettings}
            style={{ ...btnStyle, color: 'var(--app-fg-subtle)' }}
            title="Settings (Ctrl+,)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        )}
        <button
          className="titlebar-btn"
          onClick={handleMinimize}
          style={btnStyle}
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          className="titlebar-btn"
          onClick={handleMaximize}
          style={btnStyle}
        >
          {maximized ? (
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="2" y="0" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="0" y="2" width="10" height="10" fill="var(--app-bg, var(--app-modal-bg))" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>
        <button
          className="titlebar-close-btn"
          onClick={handleClose}
          style={btnStyle}
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default TitleBar
