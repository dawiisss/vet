import React, { createContext, useContext, useEffect, useState } from 'react'

const defaultConfig: Config = {
  shell: '/bin/bash',
  fontFamily: 'monospace',
  fontSize: 14,
  opacity: 1.0,
  theme: 'catppuccin-mocha',
  cursorStyle: 'block',
  cursorBlink: true,
  keybindings: {}
}

const ConfigContext = createContext<{
  config: Config
  updateConfig: (partial: Partial<Config>) => Promise<void>
  openConfig: () => Promise<void>
}>({
  config: defaultConfig,
  updateConfig: async () => {},
  openConfig: async () => {}
})

export const useConfig = () => useContext(ConfigContext)

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<Config>(defaultConfig)

  useEffect(() => {
    const api = window.configApi
    if (!api) return

    api.get().then(setConfig)

    const unsub = api.onChanged((newConfig) => {
      setConfig(newConfig)
    })

    return () => unsub()
  }, [])

  const updateConfig = async (partial: Partial<Config>) => {
    await window.configApi.set(partial)
  }

  const openConfig = async () => {
    await window.configApi.openInEditor()
  }

  return (
    <ConfigContext.Provider value={{ config, updateConfig, openConfig }}>
      {children}
    </ConfigContext.Provider>
  )
}
