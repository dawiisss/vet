import { create } from 'zustand'

export interface ClipboardItem {
  id: string
  text: string
  timestamp: number
}

interface ClipboardStore {
  history: ClipboardItem[]
  maxItems: number
  add: (text: string) => void
  remove: (id: string) => void
  clear: () => void
  initialize: () => Promise<void>
}

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  history: [],
  maxItems: 50,

  add: (text: string) => {
    if (!text || text.trim() === '') return

    const { history, maxItems } = get()

    // Don't add duplicate consecutively
    if (history.length > 0 && history[0].text === text) return

    const newItem: ClipboardItem = {
      id: Date.now().toString(),
      text,
      timestamp: Date.now()
    }

    const newHistory = [newItem, ...history].slice(0, maxItems)

    set({ history: newHistory })

    if (window.clipboardApi) {
      window.clipboardApi.setHistory(newHistory).catch(() => {})
    }
  },

  remove: (id: string) => {
    const newHistory = get().history.filter(item => item.id !== id)
    set({ history: newHistory })

    if (window.clipboardApi) {
      window.clipboardApi.setHistory(newHistory).catch(() => {})
    }
  },

  clear: () => {
    set({ history: [] })

    if (window.clipboardApi) {
      window.clipboardApi.setHistory([]).catch(() => {})
    }
  },

  initialize: async () => {
    if (!window.clipboardApi) return
    try {
      const items = await window.clipboardApi.getHistory()
      if (Array.isArray(items)) {
        set({ history: items })
      }
    } catch {
      // ignore
    }
  }
}))
