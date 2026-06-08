import { useClipboardStore } from '@/features/clipboard/useClipboardStore'

export default function ClipboardHistoryPanel({
  isActive,
  onInjectSnippet
}: {
  isActive: boolean
  onInjectSnippet: (snippet: string) => void
}) {
  const { history, remove, clear } = useClipboardStore()

  // Format timestamp nicely
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div style={{ padding: 12, color: 'var(--app-fg)', fontSize: 13, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#bac2de' }}>Clipboard</h3>
        {history.length > 0 && (
          <button
            onClick={clear}
            aria-label="Clear all clipboard history"
            style={{ background: 'none', border: 'none', color: 'var(--app-red)', cursor: 'pointer', fontSize: 12, fontWeight: 'bold', outlineColor: 'var(--app-red)' }}
            title="Clear All"
          >
            Clear All
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {history.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--app-fg-muted)',
            textAlign: 'center',
            padding: 20
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 16 }}>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            <p style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--app-fg)' }}>Clipboard is empty</p>
            <p style={{ margin: 0, fontSize: 12 }}>Copied text will appear here</p>
          </div>
        )}
        {history.map(item => (
          <div key={item.id} style={{
            background: 'var(--app-border)', border: '1px solid #45475a', borderRadius: 6, marginBottom: 8, overflow: 'hidden'
          }}>
            <div style={{ padding: '6px 10px', background: 'var(--app-panel-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--app-fg-muted)' }}>{formatTime(item.timestamp)}</span>
              <div>
                <button
                  onClick={() => onInjectSnippet(item.text)}
                  aria-label="Paste clipboard entry"
                  style={{ background: 'var(--app-green)', color: 'var(--app-modal-bg)', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, marginRight: 6, fontWeight: 'bold', outlineColor: 'var(--app-green)' }}
                >
                  Paste
                </button>
                <button
                  onClick={() => remove(item.id)}
                  aria-label="Delete clipboard entry"
                  style={{ background: 'none', color: 'var(--app-red)', border: 'none', cursor: 'pointer', fontSize: 14, outlineColor: 'var(--app-red)' }}
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--app-fg-subtle)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto', wordBreak: 'break-all' }}>
              {item.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
