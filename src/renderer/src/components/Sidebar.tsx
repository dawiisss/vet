import { useState } from 'react'
import SystemMonitorPanel from './SystemMonitorPanel'
import PortMonitorPanel from './PortMonitorPanel'
import ScriptRunnerPanel from './ScriptRunnerPanel'
import SnippetLibraryPanel from './SnippetLibraryPanel'
import ConnectionsPanel from './ConnectionsPanel'
import HistoryPanel from './HistoryPanel'
import WorkspacePanel from './WorkspacePanel'

export default function Sidebar({ 
  onRunScript, 
  onInjectSnippet,
  onViewSession,
  activeTerminalId,
  onViewFile
}: { 
  onRunScript: (cmd: string, cwd: string) => void
  onInjectSnippet: (snippet: string) => void
  onViewSession: (sessionId: string) => void
  activeTerminalId: string | null
  onViewFile: (filePath: string) => void
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
      background: 'rgba(30, 30, 46, 0.6)', 
      backdropFilter: 'blur(10px)',
      borderLeft: '1px solid rgba(49, 50, 68, 0.5)',
      borderRight: '1px solid rgba(49, 50, 68, 0.5)'
    }}>
      <div style={{ 
        width: 48, 
        background: 'rgba(24, 24, 37, 0.8)', 
        borderRight: '1px solid rgba(49, 50, 68, 0.5)',
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
              background: activeTab === i ? '#313244' : 'transparent',
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
          <ConnectionsPanel isActive={activeTab === 5} onRunScript={onRunScript} />
        </div>
        <div style={{ display: activeTab === 6 ? 'block' : 'none', height: '100%' }}>
          <HistoryPanel isActive={activeTab === 6} onViewSession={onViewSession} />
        </div>
      </div>
    </div>
  )
}
