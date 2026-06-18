import React, { useState, useEffect } from 'react'
import { useConfig } from '@/features/settings/useConfigStore'
import { FormInput } from '@/shared/components/FormComponents'
import { SettingsField } from '../SettingsField'

export const ProfilesTab: React.FC = () => {
  const { config, updateConfig } = useConfig()
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

  useEffect(() => {
    if (!selectedProfileId && config.profiles && config.profiles.length > 0) {
      selectProfile(config.profiles[0])
    }
  }, [config.profiles, selectedProfileId])

  return (
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
                    aria-label="Delete Profile"
                    className="focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--app-red)',
                      cursor: 'pointer',
                      padding: 4,
                      fontSize: 12,
                      borderRadius: 4
                    }}
                    title="Delete Profile"
                  >
                    <span aria-hidden="true">🗑</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit Form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        <SettingsField htmlFor="profile-name-input" label="Profile Name">
          <FormInput
            id="profile-name-input"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </SettingsField>

        <SettingsField htmlFor="profile-shell-input" label="Shell/Executable Path">
          <FormInput
            id="profile-shell-input"
            type="text"
            value={editShell}
            onChange={(e) => setEditShell(e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
        </SettingsField>

        <div style={{ display: 'flex', gap: 12 }}>
          <SettingsField htmlFor="profile-args-input" label="Arguments (space separated)" flex={1}>
            <FormInput
              id="profile-args-input"
              type="text"
              value={editArgs}
              onChange={(e) => setEditArgs(e.target.value)}
              placeholder="e.g. -l -v"
            />
          </SettingsField>
          <SettingsField htmlFor="profile-cwd-input" label="Default Directory (CWD)" flex={1}>
            <FormInput
              id="profile-cwd-input"
              type="text"
              value={editCwd}
              onChange={(e) => setEditCwd(e.target.value)}
              placeholder="e.g. ~/Downloads"
            />
          </SettingsField>
        </div>

        <SettingsField htmlFor="profile-env-input" label="Environment Variables (KEY=VALUE lines)">
          <textarea
            id="profile-env-input"
            value={editEnv}
            onChange={(e) => setEditEnv(e.target.value)}
            placeholder="e.g.&#10;NODE_ENV=production&#10;MY_VAR=hello"
            style={{
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '6px 10px',
              borderRadius: 6,
              color: 'var(--app-fg)',
              fontSize: 13,
              height: 80,
              resize: 'none',
              fontFamily: 'monospace',
              outline: 'none'
            }}
          />
        </SettingsField>

        <div style={{ marginTop: 8 }}>
          <button
            onClick={saveProfile}
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
            {isEditingNew ? 'Create Profile' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
