import React from 'react'
import { useConfig } from '@/features/settings/useConfigStore'
import { FormLabel, FormInput, FormSelect } from '@/shared/components/FormComponents'

export const SidebarTab: React.FC = () => {
  const { config, updateConfig } = useConfig()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="sidebar-status-select">Sidebar Status</FormLabel>
          <FormSelect
            id="sidebar-status-select"
            value={config.sidebarOpen ? 'open' : 'closed'}
            onChange={(e) => updateConfig({ sidebarOpen: e.target.value === 'open' })}
          >
            <option value="open" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Open</option>
            <option value="closed" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Closed</option>
          </FormSelect>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="sidebar-placement-select">Sidebar Placement</FormLabel>
          <FormSelect
            id="sidebar-placement-select"
            value={config.sidebarPlacement || 'right'}
            onChange={(e) => updateConfig({ sidebarPlacement: e.target.value as any })}
          >
            <option value="right" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Right</option>
            <option value="left" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Left</option>
          </FormSelect>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="sidebar-width-input">Sidebar Width (px)</FormLabel>
          <FormInput
            id="sidebar-width-input"
            type="number"
            value={config.sidebarWidth || 250}
            onChange={(e) => updateConfig({ sidebarWidth: Math.max(150, Math.min(600, parseInt(e.target.value) || 250)) })}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="clipboard-retention-input">Clipboard Retention (Days)</FormLabel>
          <FormInput
            id="clipboard-retention-input"
            type="number"
            value={config.clipboardHistoryKeepDays || 7}
            onChange={(e) => updateConfig({ clipboardHistoryKeepDays: Math.max(1, Math.min(365, parseInt(e.target.value) || 7)) })}
          />
        </div>
      </div>
    </div>
  )
}
