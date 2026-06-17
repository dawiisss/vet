import { create } from "zustand";

interface UIStore {
  error: string | null;
  isSettingsOpen: boolean;
  isAboutOpen: boolean;
  isUpdateModalOpen: boolean;
  viewingHistorySessionId: string | null;
  isCommandPaletteOpen: boolean;
  previewFilePath: string | null;
  previewClipboardItem: { id: string; text: string; timestamp: number } | null;

  setError: (err: string | null) => void;
  setIsSettingsOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void;
  setIsAboutOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void;
  setIsUpdateModalOpen: (
    isOpen: boolean | ((prev: boolean) => boolean),
  ) => void;
  setIsCommandPaletteOpen: (
    isOpen: boolean | ((prev: boolean) => boolean),
  ) => void;
  setViewingHistorySessionId: (id: string | null) => void;
  setPreviewFilePath: (path: string | null) => void;
  setPreviewClipboardItem: (
    item: { id: string; text: string; timestamp: number } | null,
  ) => void;
}

/**
 * Zustand store for UI states (modal open states, previews, notifications).
 * Separates volatile UI modal toggles from core terminal tab logical states.
 */
export const useUIStore = create<UIStore>((set) => ({
  error: null,
  isSettingsOpen: false,
  isAboutOpen: false,
  isUpdateModalOpen: false,
  viewingHistorySessionId: null,
  isCommandPaletteOpen: false,
  previewFilePath: null,
  previewClipboardItem: null,

  setError: (err) => set({ error: err }),
  setIsSettingsOpen: (isOpen) =>
    set((state) => ({
      isSettingsOpen:
        typeof isOpen === "function" ? isOpen(state.isSettingsOpen) : isOpen,
    })),
  setIsAboutOpen: (isOpen) =>
    set((state) => ({
      isAboutOpen:
        typeof isOpen === "function" ? isOpen(state.isAboutOpen) : isOpen,
    })),
  setIsUpdateModalOpen: (isOpen) =>
    set((state) => ({
      isUpdateModalOpen:
        typeof isOpen === "function" ? isOpen(state.isUpdateModalOpen) : isOpen,
    })),
  setIsCommandPaletteOpen: (isOpen) =>
    set((state) => ({
      isCommandPaletteOpen:
        typeof isOpen === "function"
          ? isOpen(state.isCommandPaletteOpen)
          : isOpen,
    })),
  setViewingHistorySessionId: (id) => set({ viewingHistorySessionId: id }),
  setPreviewFilePath: (path) => set({ previewFilePath: path }),
  setPreviewClipboardItem: (item) => set({ previewClipboardItem: item }),
}));
export default useUIStore;
