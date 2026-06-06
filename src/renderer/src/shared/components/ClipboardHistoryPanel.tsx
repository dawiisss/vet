import { useClipboardStore } from '../../features/clipboard/useClipboardStore'

export default function ClipboardHistoryPanel({
  isActive,
  onInjectSnippet
}: {
  isActive: boolean
  onInjectSnippet: (snippet: string) => void
}) {
  const history = useClipboardStore((state) => state.history)
  const clear = useClipboardStore((state) => state.clear)

  if (!isActive) return null

  return (
    <div style={{ padding: 12, color: 'var(--app-fg)', fontSize: 13, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#bac2de' }}>Clipboard</h3>
        <button
          onClick={clear}
          title="Clear History"
          style={{ background: 'none', border: 'none', color: 'var(--app-red)', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {history.length === 0 && (
          <div style={{ color: 'var(--app-fg-muted)' }}>No clipboard history.</div>
        )}
        {history.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'var(--app-border)',
              border: '1px solid #45475a',
              borderRadius: 6,
              marginBottom: 8,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '6px 10px',
                background: 'var(--app-panel-bg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontWeight: 'bold', color: 'var(--app-yellow)', fontSize: 11 }}>
                {new Date(item.timestamp).toLocaleTimeString()}
              </span>
              <div>
                <button
                  onClick={() => onInjectSnippet(item.text)}
                  style={{
                    background: 'var(--app-green)',
                    color: 'var(--app-modal-bg)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 'bold'
                  }}
                >
                  Paste
                </button>
              </div>
            </div>
            <div
              style={{
                padding: '6px 10px',
                fontSize: 11,
                color: 'var(--app-fg-subtle)',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                maxHeight: 80,
                overflowY: 'auto'
              }}
            >
              {item.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
