import React from 'react'
import { useConfig } from '@/features/settings/useConfigStore'
import { FormInput, FormSelect } from '@/shared/components/FormComponents'
import { SettingsField } from '../SettingsField'
import { SIDEBAR_PANELS } from '@/shared/components/Sidebar'

export const SidebarTab: React.FC = () => {
  const { config, updateConfig } = useConfig()
  const disabledPanels = config.disabledSidebarPanels || []
  const panelOrder = config.sidebarPanelsOrder || SIDEBAR_PANELS.map((p) => p.key)

  const sortedPanels = [...SIDEBAR_PANELS].sort((a, b) => {
    const indexA = panelOrder.indexOf(a.key)
    const indexB = panelOrder.indexOf(b.key)
    const posA = indexA === -1 ? 999 : indexA
    const posB = indexB === -1 ? 999 : indexB
    return posA - posB
  })

  const togglePanel = (key: string, enabled: boolean) => {
    if (!enabled) {
      const enabledCount = SIDEBAR_PANELS.filter((p) => !disabledPanels.includes(p.key)).length
      if (enabledCount <= 1) return
      updateConfig({ disabledSidebarPanels: [...disabledPanels, key] })
    } else {
      updateConfig({ disabledSidebarPanels: disabledPanels.filter((k) => k !== key) })
    }
  }

  const movePanel = (key: string, direction: number) => {
    const currentOrder = [...panelOrder]
    const fromIdx = currentOrder.indexOf(key)
    if (fromIdx === -1) return
    const toIdx = fromIdx + direction
    if (toIdx >= 0 && toIdx < currentOrder.length) {
      const [removed] = currentOrder.splice(fromIdx, 1)
      if (removed) {
        currentOrder.splice(toIdx, 0, removed)
        updateConfig({ sidebarPanelsOrder: currentOrder })
      }
    }
  }

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
            onChange={(e) => updateConfig({ sidebarPlacement: e.target.value as 'left' | 'right' })}
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

      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-fg)' }}>
            Sidebar Panels Order & Visibility
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => updateConfig({ sidebarPanelsOrder: SIDEBAR_PANELS.map((p) => p.key) })}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--app-accent, #89b4fa)',
                cursor: 'pointer',
                fontSize: 11,
                padding: 0,
              }}
            >
              Reset Order
            </button>
            {disabledPanels.length > 0 && (
              <button
                onClick={() => updateConfig({ disabledSidebarPanels: [] })}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--app-accent, #89b4fa)',
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: 0,
                }}
              >
                Enable All
              </button>
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            background: 'var(--app-bg-surface, #1e1e2e)',
            padding: 8,
            borderRadius: 6,
            border: '1px solid var(--app-border, #313244)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
          className="app-scrollbar"
        >
          {sortedPanels.map((panel, index) => {
            const isChecked = !disabledPanels.includes(panel.key)
            return (
              <div
                key={panel.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: 'color-mix(in srgb, var(--app-bg, #11111b) 50%, transparent)',
                  fontSize: 12,
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: isChecked ? 'var(--app-fg, #cdd6f4)' : 'var(--app-fg-muted, #6c7086)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    flex: 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => togglePanel(panel.key, e.target.checked)}
                  />
                  <span>
                    {panel.icon} {panel.name}
                  </span>
                </label>

                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    disabled={index === 0}
                    onClick={() => movePanel(panel.key, -1)}
                    title="Move Up"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: index === 0 ? 'var(--app-fg-subtle, #45475a)' : 'var(--app-fg, #cdd6f4)',
                      cursor: index === 0 ? 'default' : 'pointer',
                      padding: '2px 4px',
                      fontSize: 11,
                    }}
                  >
                    ▲
                  </button>
                  <button
                    disabled={index === sortedPanels.length - 1}
                    onClick={() => movePanel(panel.key, 1)}
                    title="Move Down"
                    style={{
                      background: 'none',
                      border: 'none',
                      color:
                        index === sortedPanels.length - 1
                          ? 'var(--app-fg-subtle, #45475a)'
                          : 'var(--app-fg, #cdd6f4)',
                      cursor: index === sortedPanels.length - 1 ? 'default' : 'pointer',
                      padding: '2px 4px',
                      fontSize: 11,
                    }}
                  >
                    ▼
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
