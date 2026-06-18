import React from 'react'
import { useConfig } from '@/features/settings/useConfigStore'
import { FormInput, FormSelect } from '@/shared/components/FormComponents'
import { SettingsField } from '../SettingsField'

export const HistoryTab: React.FC = () => {
  const { config, updateConfig } = useConfig()

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to permanently clear all terminal history from the SQLite database?')) {
      try {
        await window.historyApi?.clear()
        alert('History successfully cleared!')
      } catch (err) {
        alert('Failed to clear history')
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <SettingsField htmlFor="history-logging-select" label="Enable History Logging" flex={1}>
          <FormSelect
            id="history-logging-select"
            value={config.historyLoggingEnabled !== false ? 'true' : 'false'}
            onChange={(e) => updateConfig({ historyLoggingEnabled: e.target.value === 'true' })}
          >
            <option value="true" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Enabled</option>
            <option value="false" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Disabled</option>
          </FormSelect>
        </SettingsField>
        <SettingsField htmlFor="db-size-limit-input" label="DB Size Limit (MB)" flex={1}>
          <FormInput
            id="db-size-limit-input"
            type="number"
            value={config.historyDatabaseLimitMb || 100}
            onChange={(e) => updateConfig({ historyDatabaseLimitMb: parseInt(e.target.value) || 100 })}
          />
        </SettingsField>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <SettingsField htmlFor="keep-history-input" label="Keep History (Days)" flex={1}>
          <FormInput
            id="keep-history-input"
            type="number"
            value={config.historyKeepDays || 30}
            onChange={(e) => updateConfig({ historyKeepDays: parseInt(e.target.value) || 30 })}
          />
        </SettingsField>
        <SettingsField htmlFor="virtual-scrollback-select" label="Virtual Scrollback" flex={1}>
          <FormSelect
            id="virtual-scrollback-select"
            value={config.virtualScrollbackEnabled !== false ? 'true' : 'false'}
            onChange={(e) => updateConfig({ virtualScrollbackEnabled: e.target.value === 'true' })}
          >
            <option value="true" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Enabled</option>
            <option value="false" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Disabled</option>
          </FormSelect>
        </SettingsField>
      </div>

      <SettingsField htmlFor="virtual-scrollback-buffer-input" label="Virtual Scrollback Buffer Limit (Lines)">
        <FormInput
          id="virtual-scrollback-buffer-input"
          type="number"
          value={config.virtualScrollbackBufferSize || 1000}
          onChange={(e) => updateConfig({ virtualScrollbackBufferSize: parseInt(e.target.value) || 1000 })}
        />
      </SettingsField>

      <div style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
        <button
          onClick={handleClearHistory}
          style={{
            background: 'rgba(243, 139, 168, 0.15)',
            border: '1px solid var(--app-red)',
            padding: '8px 16px',
            borderRadius: 6,
            color: 'var(--app-red)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          Clear History Database
        </button>
      </div>
    </div>
  )
}

