import { create } from 'zustand'

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

interface ConfigState {
  config: Config
  isInitialized: boolean
  updateConfig: (partial: Partial<Config>) => Promise<void>
  openConfig: () => Promise<void>
  initialize: () => void
}

export const useConfigStore = create<ConfigState>((set, get) => {
  return {
    config: defaultConfig,
    isInitialized: false,
    updateConfig: async (partial) => {
      if (window.configApi) {
        await window.configApi.set(partial)
      }
    },
    openConfig: async () => {
      if (window.configApi) {
        await window.configApi.openInEditor()
      }
    },
    initialize: () => {
      if (get().isInitialized || !window.configApi) return
      set({ isInitialized: true })

      window.configApi.get().then((cfg) => {
        set({ config: cfg })
      })

      window.configApi.onChanged((newConfig) => {
        set({ config: newConfig })
      })
    }
  }
})

// Seamless compatibility wrapper hook
export const useConfig = () => {
  const config = useConfigStore((state) => state.config)
  const updateConfig = useConfigStore((state) => state.updateConfig)
  const openConfig = useConfigStore((state) => state.openConfig)
  return { config, updateConfig, openConfig }
}
