import { useState, useEffect } from 'react'
import DOMPurify from 'dompurify'

interface HistorySession {
  id: string
  title: string
  created_at: number
  connection_type: string
  connection_target: string
  snippet?: string
}

export default function HistoryPanel({ 
  isActive, 
  onViewSession 
}: { 
  isActive: boolean
  onViewSession: (sessionId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const loadSessions = async () => {
    try {
      setIsSearching(true)
      const api = window.historyApi
      if (!api) return
      
      let results = []
      if (query.trim() === '') {
        results = await api.getSessions()
      } else {
        results = await api.search(query.trim())
      }
      setSessions(results)
    } catch (err) {
      console.error('Failed to load history', err)
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    if (isActive) {
      loadSessions()
    }
  }, [isActive])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isActive) {
        loadSessions()
      }
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [query])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await window.historyApi?.deleteSession(id)
      setSessions(sessions.filter(s => s.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleClear = async () => {
    if (window.confirm('Are you sure you want to clear all terminal history?')) {
      try {
        await window.historyApi?.clear()
        setSessions([])
      } catch (err) {
        console.error(err)
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'var(--app-fg)' }}>
      <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#bac2de' }}>Terminal History</span>
          <button 
            onClick={handleClear}
            style={{ background: 'transparent', border: 'none', color: 'var(--app-red)', cursor: 'pointer', fontSize: 12 }}
            title="Clear all history"
          >
            Clear
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search commands or output..."
          style={{
            width: '100%',
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '6px 8px',
            borderRadius: 4,
            color: 'var(--app-fg)',
            outline: 'none',
            fontSize: 12,
            boxSizing: 'border-box'
          }}
        />
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {isSearching ? (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--app-fg-muted)', marginTop: 20 }}>Searching...</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--app-fg-muted)', marginTop: 20 }}>No history found.</div>
        ) : (
          sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => onViewSession(session.id)}
              style={{
                padding: 10,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 6,
                marginBottom: 8,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                  <span style={{ fontSize: 12 }}>
                    {session.connection_type === 'ssh' ? '🌐' : session.connection_type === 'docker' ? '🐳' : '💻'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {session.title || 'Terminal'}
                  </span>
                </div>
                <button 
                  onClick={(e) => handleDelete(e, session.id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--app-fg-muted)', cursor: 'pointer', padding: 0 }}
                  title="Delete session"
                >
                  ×
                </button>
              </div>
              
              <div style={{ fontSize: 10, color: 'var(--app-fg-muted)', marginTop: 4 }}>
                {new Date(session.created_at).toLocaleString()}
              </div>

              {session.snippet && (
                <div 
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: 'var(--app-fg-subtle)',
                    background: 'rgba(0,0,0,0.2)',
                    padding: 6,
                    borderRadius: 4,
                    overflow: 'hidden',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: 60
                  }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(session.snippet) }}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
