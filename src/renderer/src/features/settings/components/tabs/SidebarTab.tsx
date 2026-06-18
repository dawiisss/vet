import React from 'react'
import { useConfig } from '@/features/settings/useConfigStore'
import { FormInput, FormSelect } from '@/shared/components/FormComponents'
import { SettingsField } from '../SettingsField'

export const SidebarTab: React.FC = () => {
  const { config, updateConfig } = useConfig()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <SettingsField htmlFor="sidebar-status-select" label="Sidebar Status" flex={1}>
          <FormSelect
            id="sidebar-status-select"
            value={config.sidebarOpen ? 'open' : 'closed'}
            onChange={(e) => updateConfig({ sidebarOpen: e.target.value === 'open' })}
          >
            <option value="open" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Open</option>
            <option value="closed" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Closed</option>
          </FormSelect>
        </SettingsField>
        <SettingsField htmlFor="sidebar-placement-select" label="Sidebar Placement" flex={1}>
          <FormSelect
            id="sidebar-placement-select"
            value={config.sidebarPlacement || 'right'}
            onChange={(e) => updateConfig({ sidebarPlacement: e.target.value as any })}
          >
            <option value="right" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Right</option>
            <option value="left" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Left</option>
          </FormSelect>
        </SettingsField>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <SettingsField htmlFor="sidebar-width-input" label="Sidebar Width (px)" flex={1}>
          <FormInput
            id="sidebar-width-input"
            type="number"
            value={config.sidebarWidth || 250}
            onChange={(e) => updateConfig({ sidebarWidth: Math.max(150, Math.min(600, parseInt(e.target.value) || 250)) })}
          />
        </SettingsField>
        <SettingsField htmlFor="clipboard-retention-input" label="Clipboard Retention (Days)" flex={1}>
          <FormInput
            id="clipboard-retention-input"
            type="number"
            value={config.clipboardHistoryKeepDays || 7}
            onChange={(e) => updateConfig({ clipboardHistoryKeepDays: Math.max(1, Math.min(365, parseInt(e.target.value) || 7)) })}
          />
        </SettingsField>
      </div>
    </div>
  )
}

