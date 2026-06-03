import React, { useState } from 'react'
import { useConfig } from '../ConfigContext'
import { builtinThemes } from '../themes'
import { ThemeEditor } from './ThemeEditor'
import { KeybindingsManager } from './KeybindingsManager'

interface SettingsModalProps {
  onClose: () => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { config, updateConfig, openConfig } = useConfig()
  const [activeTab, setActiveTab] = useState<'general' | 'themes' | 'keybindings' | 'profiles' | 'history'>('general')

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editShell, setEditShell] = useState('')
  const [editArgs, setEditArgs] = useState('')
  const [editCwd, setEditCwd] = useState('')
  const [editEnv, setEditEnv] = useState('')
  const [isEditingNew, setIsEditingNew] = useState(false)

  const selectProfile = (profile: any) => {
    setSelectedProfileId(profile.id)
    setEditName(profile.name || '')
    setEditShell(profile.shell || '')
    setEditArgs(profile.args ? profile.args.join(' ') : '')
    setEditCwd(profile.cwd || '')
    setEditEnv(
      profile.env
        ? Object.entries(profile.env)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n')
        : ''
    )
    setIsEditingNew(false)
  }

  const initNewProfile = () => {
    setSelectedProfileId(null)
    setEditName('New Profile')
    setEditShell('/bin/bash')
    setEditArgs('')
    setEditCwd('~')
    setEditEnv('')
    setIsEditingNew(true)
  }

  const saveProfile = () => {
    if (!editName.trim() || !editShell.trim()) {
      alert('Name and Shell path are required.')
      return
    }

    const args = editArgs.trim().split(/\s+/).filter(Boolean)
    const env: Record<string, string> = {}
    const envLines = editEnv.split('\n')
    for (const line of envLines) {
      const idx = line.indexOf('=')
      if (idx > -1) {
        const k = line.substring(0, idx).trim()
        const v = line.substring(idx + 1).trim()
        if (k) env[k] = v
      }
    }

    const currentProfiles = config.profiles || []
    let updatedProfiles = [ ...currentProfiles ]

    if (isEditingNew) {
      const newId = `profile-${Date.now()}`
      const newProfile = {
        id: newId,
        name: editName.trim(),
        shell: editShell.trim(),
        args,
        cwd: editCwd.trim() || '~',
        ...(Object.keys(env).length > 0 ? { env } : {})
      }
      updatedProfiles.push(newProfile)
      updateConfig({ profiles: updatedProfiles })
      setSelectedProfileId(newId)
      setIsEditingNew(false)
    } else if (selectedProfileId) {
      updatedProfiles = currentProfiles.map((p: any) => {
        if (p.id === selectedProfileId) {
          return {
            id: p.id,
            name: editName.trim(),
            shell: editShell.trim(),
            args,
            cwd: editCwd.trim() || '~',
            ...(Object.keys(env).length > 0 ? { env } : {})
          }
        }
        return p
      })
      updateConfig({ profiles: updatedProfiles })
    }
  }

  const deleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const currentProfiles = config.profiles || []
    if (currentProfiles.length <= 1) {
      alert('You must keep at least one profile.')
      return
    }
    if (window.confirm('Are you sure you want to delete this profile?')) {
      const updated = currentProfiles.filter((p: any) => p.id !== id)
      updateConfig({ profiles: updated })
      if (selectedProfileId === id) {
        selectProfile(updated[0])
      }
    }
  }

  React.useEffect(() => {
    if (activeTab === 'profiles' && !selectedProfileId && config.profiles && config.profiles.length > 0) {
      selectProfile(config.profiles[0])
    }
  }, [activeTab, config.profiles])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div
        style={{
          width: activeTab === 'profiles' ? 680 : 500,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundColor: 'rgba(30, 30, 46, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#cdd6f4'
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a6adc8',
              cursor: 'pointer',
              fontSize: 20
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <button
            onClick={() => setActiveTab('general')}
            style={{
              flex: 1,
              padding: '12px 0',
              background: activeTab === 'general' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'general' ? '#cdd6f4' : '#6c7086',
              cursor: 'pointer',
              fontWeight: activeTab === 'general' ? 600 : 400
            }}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            style={{
              flex: 1,
              padding: '12px 0',
              background: activeTab === 'themes' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'themes' ? '#cdd6f4' : '#6c7086',
              cursor: 'pointer',
              fontWeight: activeTab === 'themes' ? 600 : 400
            }}
          >
            Themes
          </button>
          <button
            onClick={() => setActiveTab('keybindings')}
            style={{
              flex: 1,
              padding: '12px 0',
              background: activeTab === 'keybindings' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'keybindings' ? '#cdd6f4' : '#6c7086',
              cursor: 'pointer',
              fontWeight: activeTab === 'keybindings' ? 600 : 400
            }}
          >
            Keybindings
          </button>
          <button
            onClick={() => setActiveTab('profiles')}
            style={{
              flex: 1,
              padding: '12px 0',
              background: activeTab === 'profiles' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'profiles' ? '#cdd6f4' : '#6c7086',
              cursor: 'pointer',
              fontWeight: activeTab === 'profiles' ? 600 : 400
            }}
          >
            Profiles
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '12px 0',
              background: activeTab === 'history' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'history' ? '#cdd6f4' : '#6c7086',
              cursor: 'pointer',
              fontWeight: activeTab === 'history' ? 600 : 400
            }}
          >
            History
          </button>
        </div>

        <div style={{ padding: 24, minHeight: 300 }}>
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, color: '#bac2de' }}>Shell</label>
                <input
                  type="text"
                  value={config.shell}
                  onChange={(e) => updateConfig({ shell: e.target.value })}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    color: '#cdd6f4',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, color: '#bac2de' }}>Font Family</label>
                <input
                  type="text"
                  value={config.fontFamily}
                  onChange={(e) => updateConfig({ fontFamily: e.target.value })}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    color: '#cdd6f4',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#bac2de' }}>Font Size</label>
                  <input
                    type="number"
                    value={config.fontSize}
                    onChange={(e) => updateConfig({ fontSize: parseInt(e.target.value) || 12 })}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      color: '#cdd6f4',
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#bac2de' }}>Cursor Style</label>
                  <select
                    value={config.cursorStyle}
                    onChange={(e) => updateConfig({ cursorStyle: e.target.value as any })}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      color: '#cdd6f4',
                      outline: 'none'
                    }}
                  >
                    <option value="block" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Block</option>
                    <option value="underline" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Underline</option>
                    <option value="bar" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Bar</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#bac2de' }}>Sidebar Status</label>
                  <select
                    value={config.sidebarOpen ? 'open' : 'closed'}
                    onChange={(e) => updateConfig({ sidebarOpen: e.target.value === 'open' })}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      color: '#cdd6f4',
                      outline: 'none'
                    }}
                  >
                    <option value="open" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Open</option>
                    <option value="closed" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Closed</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#bac2de' }}>Sidebar Placement</label>
                  <select
                    value={config.sidebarPlacement || 'right'}
                    onChange={(e) => updateConfig({ sidebarPlacement: e.target.value as any })}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      color: '#cdd6f4',
                      outline: 'none'
                    }}
                  >
                    <option value="right" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Right</option>
                    <option value="left" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Left</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#bac2de' }}>Parse ~/.ssh/config</label>
                  <select
                    value={config.sshParseGlobal !== false ? 'true' : 'false'}
                    onChange={(e) => updateConfig({ sshParseGlobal: e.target.value === 'true' })}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      color: '#cdd6f4',
                      outline: 'none'
                    }}
                  >
                    <option value="true" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Enabled</option>
                    <option value="false" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Disabled</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#bac2de' }}>Docker Default Shell</label>
                  <input
                    type="text"
                    value={config.dockerDefaultShell || '/bin/bash'}
                    onChange={(e) => updateConfig({ dockerDefaultShell: e.target.value })}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      color: '#cdd6f4',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  onClick={openConfig}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    color: '#cdd6f4',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  Open config.json5 in Editor
                </button>
              </div>
            </div>
          )}

          {activeTab === 'themes' && (
            <ThemeEditor />
          )}

          {activeTab === 'keybindings' && (
            <KeybindingsManager />
          )}

          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#bac2de' }}>Enable History Logging</label>
                  <select
                    value={config.historyLoggingEnabled !== false ? 'true' : 'false'}
                    onChange={(e) => updateConfig({ historyLoggingEnabled: e.target.value === 'true' })}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: '#cdd6f4', outline: 'none' }}
                  >
                    <option value="true" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Enabled</option>
                    <option value="false" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Disabled</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#bac2de' }}>DB Size Limit (MB)</label>
                  <input
                    type="number"
                    value={config.historyDatabaseLimitMb || 500}
                    onChange={(e) => updateConfig({ historyDatabaseLimitMb: parseInt(e.target.value) || 500 })}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: '#cdd6f4', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#bac2de' }}>Keep History (Days)</label>
                  <input
                    type="number"
                    value={config.historyKeepDays || 30}
                    onChange={(e) => updateConfig({ historyKeepDays: parseInt(e.target.value) || 30 })}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: '#cdd6f4', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#bac2de' }}>Virtual Scrollback</label>
                  <select
                    value={config.virtualScrollbackEnabled !== false ? 'true' : 'false'}
                    onChange={(e) => updateConfig({ virtualScrollbackEnabled: e.target.value === 'true' })}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: '#cdd6f4', outline: 'none' }}
                  >
                    <option value="true" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Enabled</option>
                    <option value="false" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>Disabled</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, color: '#bac2de' }}>Virtual Scrollback Buffer Limit (Lines)</label>
                <input
                  type="number"
                  value={config.virtualScrollbackBufferSize || 1000}
                  onChange={(e) => updateConfig({ virtualScrollbackBufferSize: parseInt(e.target.value) || 1000 })}
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, color: '#cdd6f4', outline: 'none' }}
                />
              </div>

              <div style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
                <button
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to permanently clear all terminal history from the SQLite database?')) {
                      try {
                        await window.historyApi?.clear()
                        alert('History successfully cleared!')
                      } catch (err) {
                        alert('Failed to clear history')
                      }
                    }
                  }}
                  style={{
                    background: 'rgba(243, 139, 168, 0.15)',
                    border: '1px solid #f38ba8',
                    padding: '8px 16px',
                    borderRadius: 6,
                    color: '#f38ba8',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  Clear History Database
                </button>
              </div>
            </div>
          )}

          {activeTab === 'profiles' && (
            <div style={{ display: 'flex', gap: 16, height: 350 }}>
              {/* Profiles List */}
              <div style={{
                width: 200,
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                paddingRight: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                overflowY: 'auto'
              }}>
                <button
                  onClick={initNewProfile}
                  style={{
                    background: 'rgba(166, 227, 161, 0.15)',
                    border: '1px solid #a6e3a1',
                    padding: '8px 12px',
                    borderRadius: 6,
                    color: '#a6e3a1',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 8
                  }}
                >
                  + Add Profile
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {config.profiles?.map((p) => {
                    const isSel = p.id === selectedProfileId && !isEditingNew
                    return (
                      <div
                        key={p.id}
                        onClick={() => selectProfile(p)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          background: isSel ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                          border: `1px solid ${isSel ? 'rgba(255,255,255,0.15)' : 'transparent'}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: isSel ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                          {p.name}
                        </span>
                        {config.profiles && config.profiles.length > 1 && (
                          <button
                            onClick={(e) => deleteProfile(p.id, e)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#f38ba8',
                              cursor: 'pointer',
                              padding: 4,
                              fontSize: 12
                            }}
                            title="Delete Profile"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Edit Form */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: '#bac2de' }}>Profile Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: '#cdd6f4', fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: '#bac2de' }}>Shell/Executable Path</label>
                  <input
                    type="text"
                    value={editShell}
                    onChange={(e) => setEditShell(e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: '#cdd6f4', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <label style={{ fontSize: 12, color: '#bac2de' }}>Arguments (space separated)</label>
                    <input
                      type="text"
                      value={editArgs}
                      onChange={(e) => setEditArgs(e.target.value)}
                      placeholder="e.g. -l -v"
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: '#cdd6f4', fontSize: 13, outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <label style={{ fontSize: 12, color: '#bac2de' }}>Default Directory (CWD)</label>
                    <input
                      type="text"
                      value={editCwd}
                      onChange={(e) => setEditCwd(e.target.value)}
                      placeholder="e.g. ~/Downloads"
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: '#cdd6f4', fontSize: 13, outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: '#bac2de' }}>Environment Variables (KEY=VALUE lines)</label>
                  <textarea
                    value={editEnv}
                    onChange={(e) => setEditEnv(e.target.value)}
                    placeholder="e.g.&#10;NODE_ENV=production&#10;MY_VAR=hello"
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: '#cdd6f4', fontSize: 13, outline: 'none', height: 80, resize: 'none', fontFamily: 'monospace' }}
                  />
                </div>

                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={saveProfile}
                    style={{
                      background: 'rgba(137, 180, 250, 0.15)',
                      border: '1px solid #89b4fa',
                      padding: '8px 16px',
                      borderRadius: 6,
                      color: '#89b4fa',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600
                    }}
                  >
                    {isEditingNew ? 'Create Profile' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
