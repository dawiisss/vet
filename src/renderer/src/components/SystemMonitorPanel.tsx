import { useEffect, useState } from 'react'

export default function SystemMonitorPanel({ isActive }: { isActive: boolean }) {
  const [data, setData] = useState<{ cpu: number; mem: { total: number; used: number } } | null>(null)

  useEffect(() => {
    if (!isActive) return

    const api = (window as any).sysinfoApi
    if (!api) return

    api.start()

    const unsub = api.onUpdate((newData: any) => {
      setData(newData)
    })

    return () => {
      unsub()
      api.stop()
    }
  }, [isActive])

  if (!data) {
    return <div style={{ padding: 12, color: '#a6adc8', fontSize: 13 }}>Loading system metrics...</div>
  }

  const cpuPct = data.cpu.toFixed(1)
  const memPct = ((data.mem.used / data.mem.total) * 100).toFixed(1)
  const memUsedGB = (data.mem.used / (1024 ** 3)).toFixed(2)
  const memTotalGB = (data.mem.total / (1024 ** 3)).toFixed(2)

  return (
    <div style={{ padding: 12, color: '#cdd6f4', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>CPU Usage</span>
          <span>{cpuPct}%</span>
        </div>
        <div style={{ width: '100%', height: 8, background: '#313244', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${data.cpu}%`, height: '100%', background: '#89b4fa', transition: 'width 0.5s' }} />
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>RAM Usage</span>
          <span>{memPct}% ({memUsedGB}GB / {memTotalGB}GB)</span>
        </div>
        <div style={{ width: '100%', height: 8, background: '#313244', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${memPct}%`, height: '100%', background: '#a6e3a1', transition: 'width 0.5s' }} />
        </div>
      </div>
    </div>
  )
}
