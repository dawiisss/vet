import { create } from "zustand";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "uptodate"
  | "downloading"
  | "downloaded"
  | "error";

interface UpdaterState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  isInitialized: boolean;

  setStatus: (status: UpdateStatus) => void;
  setUpdateInfo: (info: UpdateInfo | null) => void;
  setProgress: (progress: UpdateProgress | null) => void;
  setError: (error: string | null) => void;

  init: () => () => void;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  quitAndInstall: () => Promise<void>;
  simulateUpdate: () => Promise<void>;
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  status: "idle",
  updateInfo: null,
  progress: null,
  error: null,
  isInitialized: false,

  setStatus: (status) => set({ status }),
  setUpdateInfo: (updateInfo) => set({ updateInfo }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),

  init: () => {
    if (get().isInitialized) {
      return () => {};
    }

    set({ isInitialized: true });

    const api = window.updaterApi;
    if (!api) {
      console.warn(
        "Updater API is not available on window. Make sure you are running in Electron.",
      );
      return () => {};
    }

    // Subscribe to IPC status changes
    const unsubStatus = api.onStatusChange((status, info) => {
      set({ status });
      if (status === "available" || status === "downloaded") {
        if (info && typeof info === "object") {
          set({ updateInfo: info as UpdateInfo, error: null });
        }
      } else if (status === "error") {
        set({
          error:
            typeof info === "string"
              ? info
              : "An unknown updater error occurred.",
        });
      } else if (status === "checking") {
        set({ error: null });
      }
    });

    // Subscribe to download progress
    const unsubProgress = api.onDownloadProgress((progress) => {
      set({ status: "downloading", progress, error: null });
    });

    // Return cleanup function to unsubscribe
    return () => {
      unsubStatus();
      unsubProgress();
      set({ isInitialized: false });
    };
  },

  checkForUpdates: async () => {
    const api = window.updaterApi;
    if (!api) return;
    set({ status: "checking", error: null });
    const res = await api.checkForUpdates();
    if (!res.success) {
      set({ status: "error", error: res.error || "Check failed" });
    }
  },

  downloadUpdate: async () => {
    const api = window.updaterApi;
    if (!api) return;
    set({ status: "downloading", error: null });
    const res = await api.downloadUpdate();
    if (!res.success) {
      set({ status: "error", error: res.error || "Download failed" });
    }
  },

  quitAndInstall: async () => {
    const api = window.updaterApi;
    if (!api) return;
    const res = await api.quitAndInstall();
    if (!res.success) {
      set({ status: "error", error: res.error || "Installation failed" });
    }
  },

  simulateUpdate: async () => {
    const api = window.updaterApi;
    if (!api) return;
    await api.simulateUpdate();
  },
}));

export default useUpdaterStore;
