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
    <div style={{ padding: 12, color: '#cdd6f4', fontSize: 13, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#bac2de' }}>Snippets</h3>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          style={{ background: 'none', border: 'none', color: '#a6e3a1', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}
        >
          {isAdding ? '×' : '+'}
        </button>
      </div>

      {isAdding && (
        <div style={{ background: '#181825', padding: 8, borderRadius: 6, marginBottom: 12, border: '1px solid #313244' }}>
          <input 
            placeholder="Snippet Name" 
            value={newName} 
            onChange={e => { setNewName(e.target.value); setErrorMsg('') }}
            style={{ 
              width: '100%', 
              background: '#11111b', 
              border: '1px solid #313244', 
              color: '#cdd6f4', 
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
            value={newCode}
            onChange={e => { setNewCode(e.target.value); setErrorMsg('') }}
            style={{ 
              width: '100%', 
              background: '#11111b', 
              border: '1px solid #313244', 
              color: '#a6adc8', 
              borderRadius: 4, 
              padding: 6, 
              minHeight: 60, 
              outline: 'none', 
              resize: 'vertical', 
              fontFamily: 'monospace',
              boxSizing: 'border-box'
            }}
          />
          {errorMsg && <div style={{ color: '#f38ba8', fontSize: 11, marginTop: 4 }}>{errorMsg}</div>}
          <button 
            onClick={handleAdd}
            style={{ 
              width: '100%', 
              background: '#89b4fa', 
              color: '#11111b', 
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
          <div style={{ color: '#6c7086' }}>No snippets saved.</div>
        )}
        {snippets.map(s => (
          <div key={s.id} style={{ 
            background: '#313244', border: '1px solid #45475a', borderRadius: 6, marginBottom: 8, overflow: 'hidden'
          }}>
            <div style={{ padding: '6px 10px', background: '#181825', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#f9e2af' }}>{s.name}</span>
              <div>
                <button 
                  onClick={() => onInjectSnippet(s.code)}
                  style={{ background: '#a6e3a1', color: '#11111b', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, marginRight: 6, fontWeight: 'bold' }}
                >
                  Inject
                </button>
                <button 
                  onClick={() => handleDelete(s.id)}
                  style={{ background: 'none', color: '#f38ba8', border: 'none', cursor: 'pointer', fontSize: 14 }}
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ padding: '6px 10px', fontSize: 11, color: '#a6adc8', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto' }}>
              {s.code}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
