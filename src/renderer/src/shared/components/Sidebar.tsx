import { useState } from 'react'
import SystemMonitorPanel from './SystemMonitorPanel'
import PortMonitorPanel from './PortMonitorPanel'
import ScriptRunnerPanel from './ScriptRunnerPanel'
import SnippetLibraryPanel from './SnippetLibraryPanel'
import ConnectionsPanel from '@/features/connections/components/ConnectionsPanel'
import WorkspacePanel from '@/features/workspace/components/WorkspacePanel'
import HistoryPanel from './HistoryPanel'

export default function Sidebar({ 
  onRunScript, 
  onInjectSnippet,
  onViewSession,
  activeTerminalId,
  onViewFile,
  onLaunchConnection
}: { 
  onRunScript: (cmd: string, cwd: string) => void
  onInjectSnippet: (snippet: string) => void
  onViewSession: (sessionId: string) => void
  activeTerminalId: string | null
  onViewFile: (filePath: string) => void
  onLaunchConnection?: (id: string) => void
}) {
  const [activeTab, setActiveTab] = useState(0)

  const tabs = [
    { icon: '📁', name: 'Workspace' },
    { icon: '📊', name: 'System' },
    { icon: '🔌', name: 'Ports' },
    { icon: '⚡', name: 'Scripts' },
    { icon: '📋', name: 'Snippets' },
    { icon: '🌐', name: 'Connections' },
    { icon: '📜', name: 'History' }
  ]

  return (
    <div style={{ 
      width: 250, 
      height: '100%', 
      display: 'flex', 
      background: 'color-mix(in srgb, var(--app-bg) 60%, transparent)', 
      backdropFilter: 'blur(10px)',
      borderLeft: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
      borderRight: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)'
    }}>
      <div style={{ 
        width: 48, 
        background: 'color-mix(in srgb, var(--app-bg) 80%, transparent)', 
        borderRight: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12
      }}>
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            title={t.name}
            style={{
              width: 36,
              height: 36,
              marginBottom: 8,
              borderRadius: 8,
              background: activeTab === i ? 'var(--app-border)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              transition: 'background 0.2s'
            }}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ display: activeTab === 0 ? 'block' : 'none', height: '100%' }}>
          <WorkspacePanel isActive={activeTab === 0} activeTerminalId={activeTerminalId} onViewFile={onViewFile} />
        </div>
        <div style={{ display: activeTab === 1 ? 'block' : 'none', height: '100%' }}>
          <SystemMonitorPanel isActive={activeTab === 1} />
        </div>
        <div style={{ display: activeTab === 2 ? 'block' : 'none', height: '100%' }}>
          <PortMonitorPanel isActive={activeTab === 2} />
        </div>
        <div style={{ display: activeTab === 3 ? 'block' : 'none', height: '100%' }}>
          <ScriptRunnerPanel isActive={activeTab === 3} onRunScript={onRunScript} />
        </div>
        <div style={{ display: activeTab === 4 ? 'block' : 'none', height: '100%' }}>
          <SnippetLibraryPanel isActive={activeTab === 4} onInjectSnippet={onInjectSnippet} />
        </div>
        <div style={{ display: activeTab === 5 ? 'block' : 'none', height: '100%' }}>
          <ConnectionsPanel isActive={activeTab === 5} onRunScript={onRunScript} onLaunchConnection={onLaunchConnection} />
        </div>
        <div style={{ display: activeTab === 6 ? 'block' : 'none', height: '100%' }}>
          <HistoryPanel isActive={activeTab === 6} onViewSession={onViewSession} />
        </div>
      </div>
    </div>
  )
}
