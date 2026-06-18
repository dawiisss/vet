import { create } from "zustand";

export interface ToastNotification {
  id: string;
  message: string;
  type: "error" | "warning" | "info";
}

interface UIStore {
  error: string | null;
  configError: string | null;
  dbError: string | null;
  toasts: ToastNotification[];
  isSettingsOpen: boolean;
  isAboutOpen: boolean;
  isUpdateModalOpen: boolean;
  viewingHistorySessionId: string | null;
  isCommandPaletteOpen: boolean;
  previewFilePath: string | null;
  previewClipboardItem: { id: string; text: string; timestamp: number } | null;

  setError: (err: string | null) => void;
  setConfigError: (err: string | null) => void;
  setDbError: (err: string | null) => void;
  addToast: (message: string, type?: "error" | "warning" | "info") => void;
  removeToast: (id: string) => void;
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
  configError: null,
  dbError: null,
  toasts: [],
  isSettingsOpen: false,
  isAboutOpen: false,
  isUpdateModalOpen: false,
  viewingHistorySessionId: null,
  isCommandPaletteOpen: false,
  previewFilePath: null,
  previewClipboardItem: null,

  setError: (err) => set({ error: err }),
  setConfigError: (err) => set({ configError: err }),
  setDbError: (err) => set({ dbError: err }),
  addToast: (message, type = "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 5000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
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
