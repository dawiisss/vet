import React from 'react'
import { useConfig } from '@/features/settings/useConfigStore'
import { FormInput, FormSelect } from '@/shared/components/FormComponents'
import { SettingsField } from '../SettingsField'

export const GeneralTab: React.FC = () => {
  const { config, updateConfig, openConfig } = useConfig()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SettingsField htmlFor="shell-input" label="Shell">
        <FormInput
          id="shell-input"
          type="text"
          value={config.shell || ''}
          onChange={(e) => updateConfig({ shell: e.target.value })}
        />
      </SettingsField>

      <SettingsField htmlFor="font-family-input" label="Font Family">
        <FormInput
          id="font-family-input"
          type="text"
          value={config.fontFamily || ''}
          onChange={(e) => updateConfig({ fontFamily: e.target.value })}
        />
      </SettingsField>

      <div style={{ display: 'flex', gap: 16 }}>
        <SettingsField htmlFor="font-size-input" label="Font Size" flex={1}>
          <FormInput
            id="font-size-input"
            type="number"
            value={config.fontSize || 12}
            onChange={(e) => updateConfig({ fontSize: parseInt(e.target.value) || 12 })}
          />
        </SettingsField>
        <SettingsField htmlFor="cursor-style-select" label="Cursor Style" flex={1}>
          <FormSelect
            id="cursor-style-select"
            value={config.cursorStyle || 'block'}
            onChange={(e) => updateConfig({ cursorStyle: e.target.value as any })}
          >
            <option value="block" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Block</option>
            <option value="underline" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Underline</option>
            <option value="bar" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Bar</option>
          </FormSelect>
        </SettingsField>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <SettingsField htmlFor="tab-bar-position-select" label="Tab Bar Position" flex={1}>
          <FormSelect
            id="tab-bar-position-select"
            value={config.tabBarPosition || 'top'}
            onChange={(e) => updateConfig({ tabBarPosition: e.target.value as any })}
          >
            <option value="top" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Top</option>
            <option value="left" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Left</option>
            <option value="right" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Right</option>
          </FormSelect>
        </SettingsField>
        <SettingsField htmlFor="max-active-terminals-input" label="Max Active Terminals (0 = unlimited)" flex={1}>
          <FormInput
            id="max-active-terminals-input"
            type="number"
            min="0"
            max="20"
            value={config.maxActiveTerminals ?? 4}
            onChange={(e) => updateConfig({ maxActiveTerminals: parseInt(e.target.value) || 0 })}
          />
        </SettingsField>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <SettingsField htmlFor="ssh-parse-select" label="Parse ~/.ssh/config" flex={1}>
          <FormSelect
            id="ssh-parse-select"
            value={config.sshParseGlobal !== false ? 'true' : 'false'}
            onChange={(e) => updateConfig({ sshParseGlobal: e.target.value === 'true' })}
          >
            <option value="true" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Enabled</option>
            <option value="false" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Disabled</option>
          </FormSelect>
        </SettingsField>
        <SettingsField htmlFor="docker-shell-input" label="Docker Default Shell" flex={1}>
          <FormInput
            id="docker-shell-input"
            type="text"
            value={config.dockerDefaultShell || '/bin/bash'}
            onChange={(e) => updateConfig({ dockerDefaultShell: e.target.value })}
          />
        </SettingsField>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <SettingsField htmlFor="terminal-opacity-input" label={`Terminal Opacity (${config.opacity ?? 1})`} flex={1}>
          <input
            id="terminal-opacity-input"
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={config.opacity ?? 1}
            onChange={(e) => updateConfig({ opacity: parseFloat(e.target.value) })}
            style={{ accentColor: 'var(--app-accent)', width: '100%' }}
          />
        </SettingsField>
        <SettingsField htmlFor="webgl-select" label="Hardware Acceleration (WebGL)" flex={1}>
          <FormSelect
            id="webgl-select"
            value={config.webglEnabled !== false ? 'true' : 'false'}
            onChange={(e) => updateConfig({ webglEnabled: e.target.value === 'true' })}
          >
            <option value="true" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Enabled</option>
            <option value="false" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Disabled (Canvas)</option>
          </FormSelect>
        </SettingsField>
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={openConfig}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            color: 'var(--app-fg)',
            cursor: 'pointer',
            fontSize: 13
          }}
        >
          Open config.json5 in Editor
        </button>
      </div>
    </div>
  )
}

