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
            style={{ background: 'none', border: 'none', color: 'var(--app-red)', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
            title="Clear All"
          >
            Clear All
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {history.length === 0 && (
          <div style={{ color: 'var(--app-fg-muted)' }}>No clipboard history yet.</div>
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
                  style={{ background: 'var(--app-green)', color: 'var(--app-modal-bg)', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, marginRight: 6, fontWeight: 'bold' }}
                >
                  Paste
                </button>
                <button
                  onClick={() => remove(item.id)}
                  style={{ background: 'none', color: 'var(--app-red)', border: 'none', cursor: 'pointer', fontSize: 14 }}
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
