import { useEffect, useState, useCallback } from 'react'

interface PortInfo {
  port: number
  process: string
  pid: number
}

export default function PortMonitorPanel({ isActive }: { isActive: boolean }) {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [loading, setLoading] = useState(false)

  const fetchPorts = useCallback(async () => {
    const api = (window as any).portsApi
    if (!api) return
    setLoading(true)
    const result = await api.list()
    setPorts(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isActive) return
    fetchPorts()
    const intv = setInterval(fetchPorts, 5000)
    return () => clearInterval(intv)
  }, [isActive, fetchPorts])

  const killPort = async (pid: number) => {
    const api = (window as any).portsApi
    if (!api) return
    const ok = await api.kill(pid)
    if (ok) {
      setTimeout(fetchPorts, 500)
    }
  }

  return (
    <div style={{ padding: 12, color: 'var(--app-fg)', fontSize: 13, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#bac2de' }}>Listening Ports</h3>
        <button 
          onClick={fetchPorts}
          aria-label="Refresh ports"
          style={{ background: 'none', border: 'none', color: 'var(--app-blue)', cursor: 'pointer', fontSize: 12 }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {ports.length === 0 && !loading && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--app-fg-muted)', textAlign: 'center', padding: 20
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 16 }}>
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
              <path d="M6 8h.01"></path>
              <path d="M10 8h.01"></path>
            </svg>
            <p style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--app-fg)' }}>No listening ports</p>
            <p style={{ margin: 0, fontSize: 12 }}>Active processes will appear here</p>
          </div>
        )}
        {ports.map(p => (
          <div key={`${p.port}-${p.pid}`} style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '8px 0', borderBottom: '1px solid var(--app-border)'
          }}>
            <div>
              <div style={{ fontWeight: 'bold', color: '#89dceb' }}>:{p.port}</div>
              <div style={{ fontSize: 11, color: 'var(--app-fg-subtle)' }}>{p.process} (PID: {p.pid})</div>
            </div>
            <button
              onClick={() => killPort(p.pid)}
              aria-label={`Kill process ${p.process}`}
              style={{
                background: 'var(--app-red)',
                color: 'var(--app-modal-bg)',
                border: 'none',
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 'bold'
              }}
            >
              Kill
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
