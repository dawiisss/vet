import React, { useState, useEffect, useRef } from 'react'
import { ModalOverlay } from '@/shared/components/ModalOverlay'
import { useEscapeKey } from '@/shared/hooks/useEscapeKey'
import { useFocusTrap } from '@/shared/hooks/useFocusTrap'
import { ThemeEditor } from './ThemeEditor'
import { KeybindingsManager } from './KeybindingsManager'
import { SshProfilesManager } from '@/features/connections/components/SshProfilesManager'
import { GeneralTab } from './tabs/GeneralTab'
import { SidebarTab } from './tabs/SidebarTab'
import { ProfilesTab } from './tabs/ProfilesTab'
import { HistoryTab } from './tabs/HistoryTab'
import { BrowserTab } from './tabs/BrowserTab'

interface SettingsModalProps {
  onClose: () => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'sidebar' | 'themes' | 'keybindings' | 'profiles' | 'ssh-profiles' | 'history' | 'browser'>('general')
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus()
    }
  }, [])

  useEscapeKey(onClose)
  useFocusTrap(modalRef)

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <ModalOverlay
      containerRef={modalRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        style={{
          width: activeTab === 'profiles' || activeTab === 'ssh-profiles' ? 680 : 500,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundColor: 'color-mix(in srgb, var(--app-bg) 75%, transparent)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--app-fg)'
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:outline-none"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--app-fg-subtle)',
              cursor: 'pointer',
              fontSize: 20
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('general')}
            style={{
              flex: 1,
              minWidth: 85,
              padding: '12px 0',
              background: activeTab === 'general' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'general' ? 'var(--app-fg)' : 'var(--app-fg-muted)',
              cursor: 'pointer',
              fontWeight: activeTab === 'general' ? 600 : 400
            }}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('sidebar')}
            style={{
              flex: 1,
              minWidth: 85,
              padding: '12px 0',
              background: activeTab === 'sidebar' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'sidebar' ? 'var(--app-fg)' : 'var(--app-fg-muted)',
              cursor: 'pointer',
              fontWeight: activeTab === 'sidebar' ? 600 : 400
            }}
          >
            Sidebar
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            style={{
              flex: 1,
              minWidth: 85,
              padding: '12px 0',
              background: activeTab === 'themes' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'themes' ? 'var(--app-fg)' : 'var(--app-fg-muted)',
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
              minWidth: 85,
              padding: '12px 0',
              background: activeTab === 'keybindings' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'keybindings' ? 'var(--app-fg)' : 'var(--app-fg-muted)',
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
              minWidth: 85,
              padding: '12px 0',
              background: activeTab === 'profiles' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'profiles' ? 'var(--app-fg)' : 'var(--app-fg-muted)',
              cursor: 'pointer',
              fontWeight: activeTab === 'profiles' ? 600 : 400
            }}
          >
            Profiles
          </button>
          <button
            onClick={() => setActiveTab('ssh-profiles')}
            style={{
              flex: 1,
              minWidth: 105,
              padding: '12px 0',
              background: activeTab === 'ssh-profiles' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'ssh-profiles' ? 'var(--app-fg)' : 'var(--app-fg-muted)',
              cursor: 'pointer',
              fontWeight: activeTab === 'ssh-profiles' ? 600 : 400
            }}
          >
            SSH Profiles
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              minWidth: 85,
              padding: '12px 0',
              background: activeTab === 'history' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'history' ? 'var(--app-fg)' : 'var(--app-fg-muted)',
              cursor: 'pointer',
              fontWeight: activeTab === 'history' ? 600 : 400
            }}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('browser')}
            style={{
              flex: 1,
              minWidth: 85,
              padding: '12px 0',
              background: activeTab === 'browser' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              color: activeTab === 'browser' ? 'var(--app-fg)' : 'var(--app-fg-muted)',
              cursor: 'pointer',
              fontWeight: activeTab === 'browser' ? 600 : 400
            }}
          >
            Browser
          </button>
        </div>

        <div style={{ padding: 24, minHeight: 300 }}>
          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'sidebar' && <SidebarTab />}
          {activeTab === 'themes' && <ThemeEditor />}
          {activeTab === 'keybindings' && <KeybindingsManager />}
          {activeTab === 'ssh-profiles' && <SshProfilesManager />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'profiles' && <ProfilesTab />}
          {activeTab === 'browser' && <BrowserTab />}
        </div>
      </div>
    </ModalOverlay>
  )
}

export default SettingsModal
