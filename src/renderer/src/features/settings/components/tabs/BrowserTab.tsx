import React from 'react'
import { useConfig } from '@/features/settings/useConfigStore'
import { FormLabel, FormInput, FormSelect } from '@/shared/components/FormComponents'

export const BrowserTab: React.FC = () => {
  const { config, updateConfig } = useConfig()

  const handleToggleAdblock = async (enabled: boolean) => {
    updateConfig({ browserAdblockEnabled: enabled })
    if (window.adblockerApi) {
      await window.adblockerApi.toggle(enabled)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FormLabel htmlFor="homepage-input">Homepage URL</FormLabel>
        <FormInput
          id="homepage-input"
          type="text"
          value={config.browserHomepage || 'https://duckduckgo.com'}
          onChange={(e) => updateConfig({ browserHomepage: e.target.value })}
          placeholder="e.g. https://duckduckgo.com"
        />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="search-engine-select">Default Search Engine</FormLabel>
          <FormSelect
            id="search-engine-select"
            value={config.browserSearchEngine || 'duckduckgo'}
            onChange={(e) => updateConfig({ browserSearchEngine: e.target.value as any })}
          >
            <option value="duckduckgo" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>DuckDuckGo</option>
            <option value="google" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Google</option>
            <option value="bing" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Bing</option>
          </FormSelect>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <FormLabel htmlFor="adblock-select">Global Adblocker (EasyList)</FormLabel>
          <FormSelect
            id="adblock-select"
            value={config.browserAdblockEnabled !== false ? 'true' : 'false'}
            onChange={(e) => handleToggleAdblock(e.target.value === 'true')}
          >
            <option value="true" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Enabled</option>
            <option value="false" style={{ background: 'var(--app-bg)', color: 'var(--app-fg)' }}>Disabled</option>
          </FormSelect>
        </div>
      </div>
    </div>
  )
}
