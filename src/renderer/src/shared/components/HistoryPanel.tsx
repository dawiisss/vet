import { useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { useTabStore } from '@/features/terminal/useTabStore'

interface HistorySession {
  id: string
  title: string
  created_at: number
  connection_type: string
  connection_target: string
  snippet?: string
}

interface BrowserHistoryEntry {
  id: number
  url: string
  title?: string
  timestamp: number
}

export default function HistoryPanel({ 
  isActive, 
  onViewSession 
}: { 
  isActive: boolean
  onViewSession: (sessionId: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'terminal' | 'browser'>('terminal')
  const [query, setQuery] = useState('')
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [browserHistory, setBrowserHistory] = useState<BrowserHistoryEntry[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  const newBrowserTab = useTabStore((s) => s.newBrowserTab)

  const loadHistory = async () => {
    try {
      setIsSearching(true)
      const api = window.historyApi
      if (!api) return
      
      if (activeTab === 'terminal') {
        let results = []
        if (query.trim() === '') {
          results = await api.getSessions()
        } else {
          results = await api.search(query.trim())
        }
        setSessions(results)
      } else {
        let results = []
        if (query.trim() === '') {
          results = await api.getBrowserHistory()
        } else {
          results = await api.searchBrowserHistory(query.trim())
        }
        setBrowserHistory(results)
      }
    } catch (err) {
      console.error('Failed to load history', err)
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    if (isActive) {
      loadHistory()
    }
  }, [isActive, activeTab])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isActive) {
        loadHistory()
      }
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [query])

  const handleDeleteTerminal = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await window.historyApi?.deleteSession(id)
      setSessions(sessions.filter(s => s.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteBrowser = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    try {
      await window.historyApi?.deleteBrowserVisit(id)
      setBrowserHistory(browserHistory.filter(b => b.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleClear = async () => {
    if (activeTab === 'terminal') {
      if (window.confirm('Are you sure you want to clear all terminal history?')) {
        try {
          await window.historyApi?.clear()
          setSessions([])
        } catch (err) {
          console.error(err)
        }
      }
    } else {
      if (window.confirm('Are you sure you want to clear all browser history?')) {
        try {
          await window.historyApi?.clearBrowserHistory()
          setBrowserHistory([])
        } catch (err) {
          console.error(err)
        }
      }
    }
  }

  const handleBrowserClick = (url: string) => {
    newBrowserTab(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'var(--app-fg)' }}>
      <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Toggle Segments */}
        <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.2)', borderRadius: 6, padding: 3, marginBottom: 12 }}>
          <button
            onClick={() => {
              setActiveTab('terminal')
              setQuery('')
            }}
            style={{
              flex: 1,
              background: activeTab === 'terminal' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              border: 'none',
              borderRadius: 4,
              color: activeTab === 'terminal' ? 'var(--app-fg)' : 'var(--app-fg-muted)',
              fontSize: 12,
              fontWeight: 500,
              padding: '6px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Terminal
          </button>
          <button
            onClick={() => {
              setActiveTab('browser')
              setQuery('')
            }}
            style={{
              flex: 1,
              background: activeTab === 'browser' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              border: 'none',
              borderRadius: 4,
              color: activeTab === 'browser' ? 'var(--app-fg)' : 'var(--app-fg-muted)',
              fontSize: 12,
              fontWeight: 500,
              padding: '6px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Browser
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#bac2de' }}>
            {activeTab === 'terminal' ? 'Terminal History' : 'Browser History'}
          </span>
          <button 
            onClick={handleClear}
            style={{ background: 'transparent', border: 'none', color: 'var(--app-red)', cursor: 'pointer', fontSize: 12 }}
            title={`Clear all ${activeTab} history`}
          >
            Clear
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={activeTab === 'terminal' ? 'Search commands or output...' : 'Search URLs or page titles...'}
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
        ) : activeTab === 'terminal' ? (
          sessions.length === 0 ? (
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
                    onClick={(e) => handleDeleteTerminal(e, session.id)}
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
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(session.snippet, { ALLOWED_TAGS: ['b'], ALLOWED_ATTR: [] }) }}
                  />
                )}
              </div>
            ))
          )
        ) : (
          browserHistory.length === 0 ? (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--app-fg-muted)', marginTop: 20 }}>No history found.</div>
          ) : (
            browserHistory.map(entry => (
              <div 
                key={entry.id}
                onClick={() => handleBrowserClick(entry.url)}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', flex: 1, paddingRight: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <span style={{ fontSize: 12 }}>🌐</span>
                      <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={entry.title || entry.url}>
                        {entry.title || entry.url}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--app-fg-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={entry.url}>
                      {entry.url}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteBrowser(e, entry.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--app-fg-muted)', cursor: 'pointer', padding: 0, fontSize: 14 }}
                    title="Delete page visit"
                  >
                    ×
                  </button>
                </div>
                
                <div style={{ fontSize: 9, color: 'var(--app-fg-muted)', marginTop: 6 }}>
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}
