import React from 'react'
import { useConfig } from '@/features/settings/useConfigStore'
import { FormLabel, FormInput, FormSelect } from '@/shared/components/FormComponents'

export const GeneralTab: React.FC = () => {
  const { config, updateConfig, openConfig } = useConfig()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FormLabel htmlFor="shell-input">Shell</FormLabel>
        <FormInput
          id="shell-input"
          type="text"
          value={config.shell || ''}
          onChange={(e) => updateConfig({ shell: e.target.value })}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FormLabel htmlFor="font-family-input">Font Family</FormLabel>
        <FormInput
          id="font-family-input"
          type="text"
          value={config.fontFamily || ''}
          onChange={(e) => updateConfig({ fontFamily: e.target.value })}
        />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="font-size-input">Font Size</FormLabel>
          <FormInput
            id="font-size-input"
            type="number"
            value={config.fontSize || 12}
            onChange={(e) => updateConfig({ fontSize: parseInt(e.target.value) || 12 })}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="cursor-style-select">Cursor Style</FormLabel>
          <FormSelect
            id="cursor-style-select"
            value={config.cursorStyle || 'block'}
            onChange={(e) => updateConfig({ cursorStyle: e.target.value as any })}
          >
            <option value="block" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Block</option>
            <option value="underline" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Underline</option>
            <option value="bar" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Bar</option>
          </FormSelect>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="tab-bar-position-select">Tab Bar Position</FormLabel>
          <FormSelect
            id="tab-bar-position-select"
            value={config.tabBarPosition || 'top'}
            onChange={(e) => updateConfig({ tabBarPosition: e.target.value as any })}
          >
            <option value="top" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Top</option>
            <option value="left" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Left</option>
            <option value="right" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Right</option>
          </FormSelect>
        </div>
        <div style={{ flex: 1 }} />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="ssh-parse-select">Parse ~/.ssh/config</FormLabel>
          <FormSelect
            id="ssh-parse-select"
            value={config.sshParseGlobal !== false ? 'true' : 'false'}
            onChange={(e) => updateConfig({ sshParseGlobal: e.target.value === 'true' })}
          >
            <option value="true" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Enabled</option>
            <option value="false" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Disabled</option>
          </FormSelect>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="docker-shell-input">Docker Default Shell</FormLabel>
          <FormInput
            id="docker-shell-input"
            type="text"
            value={config.dockerDefaultShell || '/bin/bash'}
            onChange={(e) => updateConfig({ dockerDefaultShell: e.target.value })}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="terminal-opacity-input">Terminal Opacity ({config.opacity ?? 1})</FormLabel>
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
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="webgl-select">Hardware Acceleration (WebGL)</FormLabel>
          <FormSelect
            id="webgl-select"
            value={config.webglEnabled !== false ? 'true' : 'false'}
            onChange={(e) => updateConfig({ webglEnabled: e.target.value === 'true' })}
          >
            <option value="true" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Enabled</option>
            <option value="false" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Disabled (Canvas)</option>
          </FormSelect>
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
