import { create } from "zustand";
import { leafNode, browserLeafNode } from "./splitTree";
import type { SplitNode } from "./splitTree";
import {
  setActiveTabIdAction,
  initializeTabsAction,
  onReattachTabAction,
  pollTabLabelsAction,
  newTabAction,
  newBrowserTabAction,
  closeTabAction,
  renameTabAction,
  updateBrowserUrlAction,
  handleRunScriptAction,
  handleInjectSnippetAction,
} from "./actions/tabActions";
import {
  splitTabAction,
  unsplitTabAction,
  closeSplitAction,
  extractToTabAction,
  navigateSplitAction,
  onResizeAction,
  onFocusSplitAction,
  mergeTabAsSplitAction,
} from "./actions/splitActions";
import { detachTabAction, reattachMeAction } from "./actions/windowActions";

export interface TabState {
  id: string;
  label: string;
  root: SplitNode;
  focusedPath: number[];
}

export type DropZone = "none" | "right" | "bottom" | "outside";

export interface DragState {
  tabId: string;
  zone: DropZone;
}

interface TabStore {
  tabs: TabState[];
  activeTabId: string | null;
  isDetached: boolean;
  detachedTabId: string | null;
  detachedTerminalIds: string[];
  dragState: DragState | null;
  tabActivationOrder: string[];
  hibernatedTabIds: string[];
  error: string | null;
  nextTabId: number;
  tabCounter: number;

  // Basic helpers accessible inside actions
  generateTabId: () => string;
  newTabState: (tabId: string, terminalId: string, label?: string) => TabState;
  newBrowserTabState: (tabId: string, browserId: string, label?: string) => TabState;
  getTabCounter: () => number;

  // UI state setters
  setDragState: (
    dragState:
      | DragState
      | null
      | ((prev: DragState | null) => DragState | null),
  ) => void;
  setActiveTabId: (id: string | null) => void;
  setTabs: (tabs: TabState[] | ((prev: TabState[]) => TabState[])) => void;

  // Logical Actions
  initializeTabs: () => void;
  onReattachTab: () => () => void;
  pollTabLabels: () => () => void;
  newTab: (profileId?: string, sshHostId?: string) => Promise<void>;
  newBrowserTab: (url?: string) => void;
  closeTab: (tabId: string) => void;
  selectTab: (id: string) => void;
  detachTab: (tabId: string) => Promise<void>;
  reattachMe: () => Promise<void>;
  mergeTabAsSplit: (
    fromTabId: string,
    direction: "horizontal" | "vertical",
  ) => void;
  splitTab: (
    direction: "horizontal" | "vertical",
    targetTabId?: string,
    targetPath?: number[],
  ) => Promise<void>;
  unsplitTab: () => void;
  closeSplit: (tabId: string, terminalId: string) => void;
  extractToTab: (tabId: string, path: number[]) => Promise<void>;
  navigateSplit: (delta: number) => void;
  onResize: (tabId: string, path: number[], newSizes: number[]) => void;
  onFocusSplit: (tabId: string, path: number[]) => void;
  renameTab: (tabId: string, newLabel: string) => void;
  updateBrowserUrl: (browserId: string, url: string) => void;
  handleRunScript: (cmd: string, cwd: string) => Promise<void>;
  handleInjectSnippet: (snippet: string) => void;
}

export const useTabStore = create<TabStore>((set, get) => {
  const initializedRef = { current: false };

  return {
    tabs: [],
    activeTabId: null,
    isDetached: false,
    detachedTabId: null,
    detachedTerminalIds: [],
    dragState: null,
    tabActivationOrder: [],
    hibernatedTabIds: [],
    error: null,
    nextTabId: 1,
    tabCounter: 1,

    // Helper implementations
    generateTabId: () => {
      const currentId = get().nextTabId;
      set({ nextTabId: currentId + 1 });
      return `tab-${currentId}`;
    },
    newTabState: (tabId: string, terminalId: string, label?: string) => ({
      id: tabId,
      label: label || `shell ${get().getTabCounter()}`,
      root: leafNode(terminalId),
      focusedPath: [],
    }),
    newBrowserTabState: (tabId: string, browserId: string, label?: string) => ({
      id: tabId,
      label: label || "Web Browser",
      root: browserLeafNode(browserId),
      focusedPath: [],
    }),
    getTabCounter: () => {
      const current = get().tabCounter;
      set({ tabCounter: current + 1 });
      return current;
    },

    setDragState: (dragState) =>
      set((state) => ({
        dragState:
          typeof dragState === "function"
            ? dragState(state.dragState)
            : dragState,
      })),
    setActiveTabId: (id) => setActiveTabIdAction(set, get, id),
    setTabs: (tabs) =>
      set((state) => ({
        tabs: typeof tabs === "function" ? tabs(state.tabs) : tabs,
      })),

    initializeTabs: () => initializeTabsAction(set, get, initializedRef),
    onReattachTab: () => onReattachTabAction(set, get),
    pollTabLabels: () => pollTabLabelsAction(set, get),
    newTab: (profileId, sshHostId) => newTabAction(set, get, profileId, sshHostId),
    newBrowserTab: (url) => newBrowserTabAction(set, get, url),
    closeTab: (tabId) => closeTabAction(set, get, tabId),
    selectTab: (id) => get().setActiveTabId(id),
    detachTab: (tabId) => detachTabAction(set, get, tabId),
    reattachMe: () => reattachMeAction(set, get),
    mergeTabAsSplit: (fromTabId, direction) =>
      mergeTabAsSplitAction(set, get, fromTabId, direction),
    splitTab: (direction, targetTabId, targetPath) =>
      splitTabAction(set, get, direction, targetTabId, targetPath),
    unsplitTab: () => unsplitTabAction(set, get),
    closeSplit: (tabId, terminalId) => closeSplitAction(set, get, tabId, terminalId),
    extractToTab: (tabId, path) => extractToTabAction(set, get, tabId, path),
    navigateSplit: (delta) => navigateSplitAction(set, get, delta),
    onResize: (tabId, path, newSizes) => onResizeAction(set, get, tabId, path, newSizes),
    onFocusSplit: (tabId, path) => onFocusSplitAction(set, get, tabId, path),
    renameTab: (tabId, newLabel) => renameTabAction(set, get, tabId, newLabel),
    updateBrowserUrl: (browserId, url) => updateBrowserUrlAction(set, get, browserId, url),
    handleRunScript: (cmd, cwd) => handleRunScriptAction(set, get, cmd, cwd),
    handleInjectSnippet: (snippet) => handleInjectSnippetAction(set, get, snippet),
  };
});
