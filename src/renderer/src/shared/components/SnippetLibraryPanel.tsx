import { useState, useEffect } from 'react'

export default function SnippetLibraryPanel({ 
  isActive, 
  onInjectSnippet 
}: { 
  isActive: boolean
  onInjectSnippet: (snippet: string) => void 
}) {
  const [snippets, setSnippets] = useState<{ id: string, name: string, code: string }[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('vet:snippets')
    if (saved) {
      try {
        setSnippets(JSON.parse(saved))
      } catch (e) {}
    }
  }, [])

  const saveSnippets = (list: any[]) => {
    setSnippets(list)
    localStorage.setItem('vet:snippets', JSON.stringify(list))
  }

  const handleAdd = () => {
    if (!newName.trim() || !newCode.trim()) {
      setErrorMsg('Both Name and Command are required.')
      return
    }
    const s = { id: Date.now().toString(), name: newName, code: newCode }
    saveSnippets([...snippets, s])
    setNewName('')
    setNewCode('')
    setErrorMsg('')
    setIsAdding(false)
  }

  const handleDelete = (id: string) => {
    saveSnippets(snippets.filter(s => s.id !== id))
  }

  return (
    <div style={{ padding: 12, color: 'var(--app-fg)', fontSize: 13, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#bac2de' }}>Snippets</h3>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          aria-label={isAdding ? 'Cancel adding snippet' : 'Add new snippet'}
          className="focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:outline-none"
          style={{ background: 'none', border: 'none', color: 'var(--app-green)', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}
        >
          {isAdding ? '×' : '+'}
        </button>
      </div>

      {isAdding && (
        <div style={{ background: 'var(--app-panel-bg)', padding: 8, borderRadius: 6, marginBottom: 12, border: '1px solid var(--app-border)' }}>
          <input 
            placeholder="Snippet Name" 
            aria-label="Snippet Name"
            value={newName} 
            onChange={e => { setNewName(e.target.value); setErrorMsg('') }}
            className="focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            style={{ 
              width: '100%', 
              background: 'var(--app-modal-bg)', 
              border: '1px solid var(--app-border)', 
              color: 'var(--app-fg)', 
              marginBottom: 8, 
              borderRadius: 4,
              padding: '6px 8px',
              outline: 'none', 
              fontWeight: 'bold',
              boxSizing: 'border-box'
            }}
          />
          <textarea 
            placeholder="Command..." 
            aria-label="Snippet Command"
            value={newCode}
            onChange={e => { setNewCode(e.target.value); setErrorMsg('') }}
            className="focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            style={{ 
              width: '100%', 
              background: 'var(--app-modal-bg)', 
              border: '1px solid var(--app-border)', 
              color: 'var(--app-fg-subtle)', 
              borderRadius: 4, 
              padding: 6, 
              minHeight: 60, 
              outline: 'none', 
              resize: 'vertical', 
              fontFamily: 'monospace',
              boxSizing: 'border-box'
            }}
          />
          {errorMsg && <div style={{ color: 'var(--app-red)', fontSize: 11, marginTop: 4 }}>{errorMsg}</div>}
          <button 
            onClick={handleAdd}
            className="focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-panel-bg)]"
            style={{ 
              width: '100%', 
              background: 'var(--app-blue)', 
              color: 'var(--app-modal-bg)', 
              border: 'none', 
              borderRadius: 4, 
              padding: '4px 0', 
              marginTop: 8, 
              cursor: 'pointer', 
              fontWeight: 'bold' 
            }}
          >
            Save Snippet
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {snippets.length === 0 && !isAdding && (
          <div style={{ color: 'var(--app-fg-muted)' }}>No snippets saved.</div>
        )}
        {snippets.map(s => (
          <div key={s.id} style={{ 
            background: 'var(--app-border)', border: '1px solid #45475a', borderRadius: 6, marginBottom: 8, overflow: 'hidden'
          }}>
            <div style={{ padding: '6px 10px', background: 'var(--app-panel-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--app-yellow)' }}>{s.name}</span>
              <div>
                <button 
                  onClick={() => onInjectSnippet(s.code)}
                  aria-label={`Inject snippet ${s.name}`}
                  className="focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-panel-bg)]"
                  style={{ background: 'var(--app-green)', color: 'var(--app-modal-bg)', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, marginRight: 6, fontWeight: 'bold' }}
                >
                  Inject
                </button>
                <button 
                  onClick={() => handleDelete(s.id)}
                  aria-label={`Delete snippet ${s.name}`}
                  className="focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
                  style={{ background: 'none', color: 'var(--app-red)', border: 'none', cursor: 'pointer', fontSize: 14 }}
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--app-fg-subtle)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto' }}>
              {s.code}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
