import { useEffect, useState } from 'react'

export default function ScriptRunnerPanel({ 
  isActive, 
  onRunScript 
}: { 
  isActive: boolean
  onRunScript: (cmd: string, cwd: string) => void 
}) {
  const [scripts, setScripts] = useState<Record<string, string> | null>(null)
  const [workspaceDir, setWorkspaceDir] = useState<string>('')

  useEffect(() => {
    if (!isActive) return
    const api = (window as any).workspaceApi
    if (!api) return

    api.getScripts().then((res: any) => {
      if (res) {
        setScripts(res.scripts)
        setWorkspaceDir(res.cwd)
      } else {
        setScripts(null)
      }
    })
  }, [isActive])

  return (
    <div style={{ padding: 12, color: '#cdd6f4', fontSize: 13, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#bac2de' }}>Project Scripts</h3>
      
      {!scripts && (
        <div style={{ color: '#6c7086' }}>No package.json scripts found in project root.</div>
      )}

      {scripts && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, color: '#6c7086', marginBottom: 8, wordBreak: 'break-all' }}>
            Workspace: {workspaceDir}
          </div>
          {Object.entries(scripts).map(([name, cmd]) => (
            <div key={name} style={{ marginBottom: 8 }}>
              <button
                onClick={() => onRunScript(`npm run ${name}`, workspaceDir)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: '#313244',
                  border: '1px solid #45475a',
                  color: '#cdd6f4',
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: 'bold', color: '#89b4fa' }}>{name}</span>
                <span style={{ fontSize: 16 }}>▶</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
