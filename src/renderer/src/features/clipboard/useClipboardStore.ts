import { create } from 'zustand'

export interface ClipboardItem {
  id: string
  text: string
  timestamp: number
}

interface ClipboardState {
  history: ClipboardItem[]
  maxItems: number
  add: (text: string) => void
  clear: () => void
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  history: [],
  maxItems: 50,

  add: (text: string) => {
    if (!text || text.trim() === '') return

    set((state) => {
      const { history, maxItems } = state

      // Don't add duplicate if it matches the most recent one
      if (history.length > 0 && history[0].text === text) {
        return state
      }

      const newItem: ClipboardItem = {
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        text,
        timestamp: Date.now()
      }

      const newHistory = [newItem, ...history].slice(0, maxItems)
      return { history: newHistory }
    })
  },

  clear: () => set({ history: [] })
}))
