import React, { useState, useEffect } from 'react'
import { useConfig } from '@/features/settings/useConfigStore'

const isSshHost = (h: SshHost | { name: string; command: string }): h is SshHost => 'host' in h

export const SshProfilesManager: React.FC = () => {
  const { config, updateConfig } = useConfig()
  const sshHosts = (config.sshHosts || []).filter(isSshHost)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
  const [editName, setEditName] = useState('')
  const [editHost, setEditHost] = useState('')
  const [editPort, setEditPort] = useState('22')
  const [editUser, setEditUser] = useState('')
  const [editAuthType, setEditAuthType] = useState<'password' | 'key' | 'agent'>('password')
  const [editPassword, setEditPassword] = useState('')
  const [editKeyPath, setEditKeyPath] = useState('')
  const [editPassphrase, setEditPassphrase] = useState('')
  
  const [isEditingNew, setIsEditingNew] = useState(false)

  const selectHost = (h: any) => {
    setSelectedId(h.id)
    setEditName(h.name || '')
    setEditHost(h.host || '')
    setEditPort(String(h.port || 22))
    setEditUser(h.username || '')
    setEditAuthType(h.authType || 'password')
    setEditPassword(h.password || '')
    setEditKeyPath(h.privateKeyPath || '')
    setEditPassphrase(h.passphrase || '')
    setIsEditingNew(false)
  }

  const initNewHost = () => {
    setSelectedId(null)
    setEditName('New SSH Host')
    setEditHost('')
    setEditPort('22')
    setEditUser('')
    setEditAuthType('password')
    setEditPassword('')
    setEditKeyPath('~/.ssh/id_rsa')
    setEditPassphrase('')
    setIsEditingNew(true)
  }

  useEffect(() => {
    if (!selectedId && sshHosts.length > 0) {
      selectHost(sshHosts[0])
    }
  }, [sshHosts])

  const saveHost = () => {
    if (!editName.trim() || !editHost.trim() || !editUser.trim()) {
      alert('Name, Host, and Username are required.')
      return
    }

    let updated: SshHost[] = [...sshHosts]
    
    const hostData = {
      name: editName.trim(),
      host: editHost.trim(),
      port: parseInt(editPort) || 22,
      username: editUser.trim(),
      authType: editAuthType,
      password: editAuthType === 'password' ? editPassword : '',
      privateKeyPath: editAuthType === 'key' ? editKeyPath.trim() : '',
      passphrase: editAuthType === 'key' ? editPassphrase : ''
    }

    if (isEditingNew) {
      const newId = `ssh-${Date.now()}`
      updated.push({ id: newId, ...hostData })
      updateConfig({ sshHosts: updated })
      setSelectedId(newId)
      setIsEditingNew(false)
    } else if (selectedId) {
      updated = updated.map(h => h.id === selectedId ? { id: h.id, ...hostData } : h)
      updateConfig({ sshHosts: updated })
    }
  }

  const deleteHost = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this SSH host?')) {
      const updated = sshHosts.filter(h => h.id !== id)
      updateConfig({ sshHosts: updated })
      if (selectedId === id) {
        if (updated.length > 0) selectHost(updated[0])
        else initNewHost()
      }
    }
  }

  return (
    <div style={{ display: 'flex', gap: 16, height: 350 }}>
      {/* List */}
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
          onClick={initNewHost}
          style={{
            background: 'color-mix(in srgb, var(--app-green) 15%, transparent)',
            border: '1px solid var(--app-green)',
            padding: '8px 12px',
            borderRadius: 6,
            color: 'var(--app-green)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 8
          }}
        >
          + Add SSH Host
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sshHosts.map((h) => {
            const isSel = h.id === selectedId && !isEditingNew
            return (
              <div
                key={h.id}
                onClick={() => selectHost(h)}
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
                  {h.name}
                </span>
                <button
                  onClick={(e) => deleteHost(h.id, e)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--app-red)',
                    cursor: 'pointer',
                    padding: 4,
                    fontSize: 12
                  }}
                >
                  🗑
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit Form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <label style={{ fontSize: 12, color: '#bac2de' }}>Profile Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: 'var(--app-fg)', fontSize: 13, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 2 }}>
            <label style={{ fontSize: 12, color: '#bac2de' }}>Host / IP</label>
            <input
              type="text"
              value={editHost}
              onChange={(e) => setEditHost(e.target.value)}
              placeholder="e.g. 192.168.1.10"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: 'var(--app-fg)', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <label style={{ fontSize: 12, color: '#bac2de' }}>Port</label>
            <input
              type="number"
              value={editPort}
              onChange={(e) => setEditPort(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: 'var(--app-fg)', fontSize: 13, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#bac2de' }}>Username</label>
          <input
            type="text"
            value={editUser}
            onChange={(e) => setEditUser(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: 'var(--app-fg)', fontSize: 13, outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <label style={{ fontSize: 12, color: '#bac2de', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="radio" name="authType" value="password" checked={editAuthType === 'password'} onChange={() => setEditAuthType('password')} /> Password
          </label>
          <label style={{ fontSize: 12, color: '#bac2de', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="radio" name="authType" value="key" checked={editAuthType === 'key'} onChange={() => setEditAuthType('key')} /> Private Key
          </label>
          <label style={{ fontSize: 12, color: '#bac2de', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="radio" name="authType" value="agent" checked={editAuthType === 'agent'} onChange={() => setEditAuthType('agent')} /> SSH Agent
          </label>
        </div>

        {editAuthType === 'password' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: '#bac2de' }}>Password</label>
            <input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: 'var(--app-fg)', fontSize: 13, outline: 'none' }}
            />
          </div>
        )}

        {editAuthType === 'key' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: '#bac2de' }}>Private Key Path</label>
              <input
                type="text"
                value={editKeyPath}
                onChange={(e) => setEditKeyPath(e.target.value)}
                placeholder="~/.ssh/id_rsa"
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: 'var(--app-fg)', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: '#bac2de' }}>Passphrase (optional)</label>
              <input
                type="password"
                value={editPassphrase}
                onChange={(e) => setEditPassphrase(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6, color: 'var(--app-fg)', fontSize: 13, outline: 'none' }}
              />
            </div>
          </>
        )}

        <div style={{ marginTop: 8 }}>
          <button
            onClick={saveHost}
            style={{
              background: 'color-mix(in srgb, var(--app-blue) 15%, transparent)',
              border: '1px solid var(--app-blue)',
              padding: '8px 16px',
              borderRadius: 6,
              color: 'var(--app-blue)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            {isEditingNew ? 'Create SSH Host' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
