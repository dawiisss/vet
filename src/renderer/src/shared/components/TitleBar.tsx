import { useEffect, useState } from 'react'
import { useUpdaterStore } from '@/shared/stores/useUpdaterStore'
import { useUIStore } from '@/shared/stores/useUIStore'

interface TitleBarProps {
  onOpenSettings?: () => void
  onOpenAbout?: () => void
}

function TitleBar({ onOpenSettings, onOpenAbout }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false)
  const { status, updateInfo } = useUpdaterStore()
  const setIsUpdateModalOpen = useUIStore((s) => s.setIsUpdateModalOpen)

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
        {(status === 'available' || status === 'downloading' || status === 'downloaded') && (
          <button
            className="titlebar-btn"
            onClick={() => setIsUpdateModalOpen(true)}
            style={{
              ...btnStyle,
              color: 'var(--app-accent, #10b981)',
              position: 'relative'
            }}
            title={`Software Update Available (${updateInfo?.version || ''})`}
            aria-label="Software Update Available"
          >
            <style>{`
              @keyframes vetUpdatePulse {
                0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
                100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
              }
              .vet-update-badge {
                position: absolute;
                top: 6px;
                right: 6px;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: var(--app-accent, #10b981);
                animation: vetUpdatePulse 2s infinite;
              }
            `}</style>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="8 17 12 21 16 17"></polyline>
              <line x1="12" y1="12" x2="12" y2="21"></line>
              <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path>
            </svg>
            <span className="vet-update-badge" />
          </button>
        )}
        {onOpenAbout && (
          <button
            className="titlebar-btn"
            onClick={onOpenAbout}
            style={{ ...btnStyle, color: 'var(--app-fg-subtle)' }}
            title="About Vet"
            aria-label="About Vet"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </button>
        )}
        {onOpenSettings && (
          <button
            className="titlebar-btn"
            onClick={onOpenSettings}
            style={{ ...btnStyle, color: 'var(--app-fg-subtle)' }}
            title="Settings (Ctrl+,)"
            aria-label="Settings"
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
          title="Minimize"
          aria-label="Minimize"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          className="titlebar-btn"
          onClick={handleMaximize}
          style={btnStyle}
          title={maximized ? "Restore down" : "Maximize"}
          aria-label={maximized ? "Restore down" : "Maximize"}
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
          title="Close"
          aria-label="Close"
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
