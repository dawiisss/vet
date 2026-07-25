import { create } from "zustand";

export interface TerminalStatus {
  cwd: string;
  command: string;
  cols: number;
  rows: number;
  sshHostId?: string | null | undefined;
}

export interface BrowserStatus {
  url: string;
  title: string;
  blockedCount: number;
  isHttps: boolean;
}

export interface EditorStatus {
  line: number;
  col: number;
  language: string;
  isDirty: boolean;
  filePath: string;
  sshHostId?: string | null | undefined;
}

interface StatusBarState {
  activePaneType: "terminal" | "browser" | "editor" | null;
  activePaneId: string | null;
  terminalStatus: Record<string, TerminalStatus>;
  browserStatus: Record<string, BrowserStatus>;
  editorStatus: Record<string, EditorStatus>;

  setActivePane: (type: "terminal" | "browser" | "editor" | null, id: string | null) => void;
  updateTerminalStatus: (terminalId: string, status: Partial<TerminalStatus>) => void;
  updateBrowserStatus: (browserId: string, status: Partial<BrowserStatus>) => void;
  updateEditorStatus: (editorId: string, status: Partial<EditorStatus>) => void;
}

export const useStatusBarStore = create<StatusBarState>((set) => ({
  activePaneType: null,
  activePaneId: null,
  terminalStatus: {},
  browserStatus: {},
  editorStatus: {},

  setActivePane: (type, id) => set({ activePaneType: type, activePaneId: id }),
  updateTerminalStatus: (terminalId, status) =>
    set((state) => ({
      terminalStatus: {
        ...state.terminalStatus,
        [terminalId]: {
          ...(state.terminalStatus[terminalId] || {
            cwd: "",
            command: "",
            cols: 80,
            rows: 24,
            sshHostId: null,
          }),
          ...status,
        },
      },
    })),
  updateBrowserStatus: (browserId, status) =>
    set((state) => ({
      browserStatus: {
        ...state.browserStatus,
        [browserId]: {
          ...(state.browserStatus[browserId] || {
            url: "",
            title: "Web Browser",
            blockedCount: 0,
            isHttps: false,
          }),
          ...status,
        },
      },
    })),
  updateEditorStatus: (editorId, status) =>
    set((state) => ({
      editorStatus: {
        ...state.editorStatus,
        [editorId]: {
          ...(state.editorStatus[editorId] || {
            line: 1,
            col: 1,
            language: "Plain Text",
            isDirty: false,
            filePath: "",
            sshHostId: null,
          }),
          ...status,
        },
      },
    })),
}));

export default useStatusBarStore;
