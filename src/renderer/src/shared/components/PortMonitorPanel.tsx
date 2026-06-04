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
          style={{ background: 'none', border: 'none', color: 'var(--app-blue)', cursor: 'pointer', fontSize: 12 }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {ports.length === 0 && !loading && <div style={{ color: 'var(--app-fg-muted)' }}>No listening ports found.</div>}
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
