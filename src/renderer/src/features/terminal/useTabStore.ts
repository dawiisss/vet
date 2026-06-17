import { create } from "zustand";
import {
  leafNode,
  browserLeafNode,
  collectTerminalIds,
  collectLeafIds,
  leafCount,
  navigatePath,
  insertLeaves,
  removeLeaf,
  setNode,
  getNode,
  leafPaths,
} from "./splitTree";
import type { SplitNode } from "./splitTree";

// Helper to destroy terminal instances from memory/DOM cache
// (import dynamically or define placeholder to be set by active views)
let _destroyTerminalCache: ((id: string) => void) | null = null;
export function registerDestroyTerminalCache(fn: (id: string) => void) {
  _destroyTerminalCache = fn;
}

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

let tabCounter = 1;
let nextTabId = 1;

function generateTabId(): string {
  return `tab-${nextTabId++}`;
}

function newTabState(
  tabId: string,
  terminalId: string,
  label?: string,
): TabState {
  return {
    id: tabId,
    label: label || `shell ${tabCounter++}`,
    root: leafNode(terminalId),
    focusedPath: [],
  };
}

function newBrowserTabState(
  tabId: string,
  browserId: string,
  label?: string,
): TabState {
  return {
    id: tabId,
    label: label || "Web Browser",
    root: browserLeafNode(browserId),
    focusedPath: [],
  };
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export const useTabStore = create<TabStore>((set, get) => {
  let initialized = false;

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

    setDragState: (dragState) =>
      set((state) => ({
        dragState:
          typeof dragState === "function"
            ? dragState(state.dragState)
            : dragState,
      })),
    setActiveTabId: (id) => {
      if (!id) {
        set({ activeTabId: null });
        return;
      }
      set((state) => {
        let config: any = undefined;
        try {
          config = (window as any).__configStore?.getState?.()?.config;
        } catch {}
        const maxActive = config?.maxActiveTerminals ?? 4;
        const order = state.tabActivationOrder.filter((t) => t !== id);
        order.unshift(id);

        let hibernated = state.hibernatedTabIds.filter((t) => t !== id);

        if (maxActive > 0) {
          const nonHibernatedCount = state.tabs.length - hibernated.length;
          let excess = nonHibernatedCount - maxActive;
          let i = order.length - 1;
          while (excess > 0 && i >= 0) {
            const candidateId = order[i];
            if (candidateId !== id && !hibernated.includes(candidateId)) {
              const tab = state.tabs.find((t) => t.id === candidateId);
              if (tab) {
                collectTerminalIds(tab.root).forEach((termId) => {
                  if (_destroyTerminalCache) _destroyTerminalCache(termId);
                });
                hibernated = [...hibernated, candidateId];
              }
              excess--;
            }
            i--;
          }
        }

        return {
          activeTabId: id,
          tabActivationOrder: order,
          hibernatedTabIds: hibernated,
        };
      });
      // Notify main process of foreground terminals
      const activeTab = get().tabs.find((t) => t.id === id);
      if (activeTab) {
        const termIds = collectTerminalIds(activeTab.root);
        try {
          const api = (window as any).terminalApi;
          if (api) api.setForeground(termIds);
        } catch {}
      }
    },
    setTabs: (tabs) =>
      set((state) => ({
        tabs: typeof tabs === "function" ? tabs(state.tabs) : tabs,
      })),

    initializeTabs: () => {
      if (initialized) return;
      initialized = true;

      const params = new URLSearchParams(window.location.search);
      const detached = params.get("detached");
      const terminals = params.get("terminals");
      if (detached) {
        const rawIds = terminals ? terminals.split(",").filter(Boolean) : [];
        const parsed = rawIds.map((raw) => {
          const firstColonIdx = raw.indexOf(":");
          if (firstColonIdx === -1) return { id: raw };
          const id = raw.substring(0, firstColonIdx);
          const url = raw.substring(firstColonIdx + 1);
          return { id, url: url ? decodeURIComponent(url) : undefined };
        });
        let root: SplitNode;
        if (parsed.length <= 1) {
          const item = parsed[0] || { id: "" };
          root = item.id.startsWith("browser-")
            ? { ...browserLeafNode(item.id), url: item.url }
            : leafNode(item.id);
        } else {
          root = {
            direction: "horizontal",
            children: parsed.map((item) =>
              item.id.startsWith("browser-")
                ? { ...browserLeafNode(item.id), url: item.url }
                : leafNode(item.id),
            ),
            sizes: parsed.map(() => 1 / parsed.length),
          };
        }
        set({
          isDetached: true,
          detachedTabId: detached,
          detachedTerminalIds: rawIds,
          tabs: [
            {
              id: detached,
              label: "detached",
              root,
              focusedPath: [],
            },
          ],
          activeTabId: detached,
          tabActivationOrder: [detached],
        });
        return;
      }

      const api = window.terminalApi;
      if (!api) {
        set({ error: "terminalApi not available — IPC not bridged" });
        return;
      }

      api
        .create()
        .then(async ({ id }) => {
          const tabId = generateTabId();
          let label: string | undefined;
          try {
            const info = await api.getTerminalInfo(id);
            if (info.title) label = info.title;
          } catch {}
          set({
            tabs: [newTabState(tabId, id, label)],
            activeTabId: tabId,
            tabActivationOrder: [tabId],
          });
        })
        .catch((err) => {
          set({ error: `Failed to create terminal: ${err}` });
        });
    },

    onReattachTab: () => {
      const api = window.terminalApi;
      if (!api) return () => {};

      return api.onReattachTab((rawIds: string[]) => {
        const tabId = generateTabId();

        const parsed = rawIds.map((raw) => {
          const firstColonIdx = raw.indexOf(":");
          if (firstColonIdx === -1) return { id: raw };
          const id = raw.substring(0, firstColonIdx);
          const url = raw.substring(firstColonIdx + 1);
          return { id, url: url ? decodeURIComponent(url) : undefined };
        });

        let root: SplitNode;
        if (parsed.length <= 1) {
          const item = parsed[0] || { id: "" };
          root = item.id.startsWith("browser-")
            ? { ...browserLeafNode(item.id), url: item.url }
            : leafNode(item.id);
        } else {
          root = {
            direction: "horizontal",
            children: parsed.map((item) =>
              item.id.startsWith("browser-")
                ? { ...browserLeafNode(item.id), url: item.url }
                : leafNode(item.id),
            ),
            sizes: parsed.map(() => 1 / parsed.length),
          };
        }
        const fetchLabel = async () => {
          const firstItem = parsed[0] || { id: "" };
          let label = firstItem.id.startsWith("browser-")
            ? "Web Browser"
            : `shell ${tabCounter++}`;
          if (!firstItem.id.startsWith("browser-")) {
            try {
              const info = await api.getTerminalInfo(firstItem.id);
              const suffix = parsed.length > 1 ? ` + ${parsed.length - 1}` : "";
              if (info.title) label = info.title + suffix;
            } catch {}
          }
          set((state) => ({
            tabs: [
              ...state.tabs,
              {
                id: tabId,
                label,
                root,
                focusedPath: [],
              },
            ],
            activeTabId: tabId,
            tabActivationOrder: [tabId, ...state.tabActivationOrder],
          }));
        };
        fetchLabel();
      });
    },

    pollTabLabels: () => {
      const api = window.terminalApi;
      if (!api) return () => {};

      let active = true;
      const poll = async () => {
        if (!active) return;

        let changed = false;
        const updates = new Map<string, string>();

        for (const tab of get().tabs) {
          const targetNode = getNode(tab.root, tab.focusedPath);
          if (!targetNode) continue;

          try {
            const totalLeaves = leafCount(tab.root);
            const suffix = totalLeaves > 1 ? ` + ${totalLeaves - 1}` : "";

            let targetLabel: string;
            if (targetNode.terminalId) {
              const info = await api.getTerminalInfo(targetNode.terminalId);
              const hasBrowser = collectLeafIds(tab.root).some((id) =>
                id.startsWith("browser-"),
              );
              if (hasBrowser) {
                const base = tab.label.replace(/ \+ \d+$/, "");
                targetLabel = base + suffix;
              } else {
                targetLabel = info.title ? info.title + suffix : "";
              }
            } else {
              // Focused node is a browser — keep existing base label, update suffix
              const base = tab.label.replace(/ \+ \d+$/, "");
              targetLabel = base + suffix;
            }

            if (targetLabel && targetLabel !== tab.label) {
              updates.set(tab.id, targetLabel);
              changed = true;
            }
          } catch {
            // ignore
          }
        }

        if (active && changed) {
          set((state) => ({
            tabs: state.tabs.map((t) => {
              const newLabel = updates.get(t.id);
              return newLabel ? { ...t, label: newLabel } : t;
            }),
          }));
        }

        if (active) setTimeout(poll, 1000);
      };

      poll();

      return () => {
        active = false;
      };
    },

    newTab: async (profileId, sshHostId) => {
      const api = window.terminalApi;
      if (!api) return;
      try {
        const { id } = await api.create({ profileId, sshHostId });
        const tabId = generateTabId();
        let label: string | undefined;
        try {
          const info = await api.getTerminalInfo(id);
          if (info.title) label = info.title;
        } catch {}
        set((state) => ({
          tabs: [...state.tabs, newTabState(tabId, id, label)],
          activeTabId: tabId,
          tabActivationOrder: [tabId, ...state.tabActivationOrder],
        }));
      } catch (err) {
        set({ error: `Failed to create terminal: ${err}` });
      }
    },

    newBrowserTab: (url?: string) => {
      const browserId = `browser-${Date.now()}`;
      const tabId = generateTabId();
      set((state) => {
        const browserTab = newBrowserTabState(tabId, browserId);
        if (url) {
          browserTab.root = { ...browserTab.root, url };
        }
        return {
          tabs: [...state.tabs, browserTab],
          activeTabId: tabId,
          tabActivationOrder: [tabId, ...state.tabActivationOrder],
        };
      });
    },

    closeTab: (tabId) => {
      const api = window.terminalApi;
      if (!api) return;
      const activeTabId = get().activeTabId;
      const prevTabs = get().tabs;
      const tab = prevTabs.find((t) => t.id === tabId);
      if (tab) {
        collectTerminalIds(tab.root).forEach((id) => {
          api.destroy(id);
          if (_destroyTerminalCache) _destroyTerminalCache(id);
        });
      }
      const next = prevTabs.filter((t) => t.id !== tabId);
      let newActiveTabId = activeTabId;
      if (tabId === activeTabId) {
        const idx = prevTabs.findIndex((t) => t.id === tabId);
        const newActive = next[Math.min(idx, next.length - 1)];
        newActiveTabId = newActive ? newActive.id : null;
      }
      set({
        tabs: next,
        activeTabId: newActiveTabId,
        tabActivationOrder: get().tabActivationOrder.filter((t) => t !== tabId),
        hibernatedTabIds: get().hibernatedTabIds.filter((t) => t !== tabId),
      });
    },

    selectTab: (id) => {
      set({ activeTabId: id });
    },

    detachTab: async (tabId) => {
      const api = window.terminalApi;
      if (!api) return;
      const activeTabId = get().activeTabId;
      const prevTabs = get().tabs;
      const tab = prevTabs.find((t) => t.id === tabId);
      if (!tab) return;
      try {
        const leafNodes = leafPaths(tab.root).map((p) => getNode(tab.root, p));
        const terminalIds = leafNodes
          .map((node) => {
            if (node.browserId) {
              const webviewEl = document.getElementById(node.browserId) as any;
              let activeUrl = node.url || "";
              if (webviewEl && typeof webviewEl.getURL === "function") {
                try {
                  activeUrl = webviewEl.getURL();
                } catch (e) {
                  console.error("Failed to get URL from webview:", e);
                }
              }
              return activeUrl
                ? `${node.browserId}:${encodeURIComponent(activeUrl)}`
                : node.browserId;
            }
            return node.terminalId || "";
          })
          .filter(Boolean);

        await api.detachTab(tabId, terminalIds);
        terminalIds.forEach((id) => {
          const cleanId = id.split(":")[0];
          if (_destroyTerminalCache) _destroyTerminalCache(cleanId);
        });

        const next = prevTabs.filter((t) => t.id !== tabId);
        let newActiveTabId = activeTabId;
        if (tabId === activeTabId) {
          const idx = prevTabs.findIndex((t) => t.id === tabId);
          const newActive = next[Math.min(idx, next.length - 1)];
          newActiveTabId = newActive ? newActive.id : null;
        }
        set({
          tabs: next,
          activeTabId: newActiveTabId,
          tabActivationOrder: get().tabActivationOrder.filter(
            (t) => t !== tabId,
          ),
          hibernatedTabIds: get().hibernatedTabIds.filter((t) => t !== tabId),
        });
      } catch (err) {
        set({ error: `Failed to detach tab: ${err}` });
      }
    },

    reattachMe: async () => {
      const detachedTabId = get().detachedTabId;
      if (!detachedTabId) return;
      const tab = get().tabs[0];
      if (!tab) return;
      const api = window.terminalApi;
      if (!api) return;
      try {
        const leafNodes = leafPaths(tab.root).map((p) => getNode(tab.root, p));
        const terminalIds = leafNodes
          .map((node) => {
            if (node.browserId) {
              const webviewEl = document.getElementById(node.browserId) as any;
              let activeUrl = node.url || "";
              if (webviewEl && typeof webviewEl.getURL === "function") {
                try {
                  activeUrl = webviewEl.getURL();
                } catch (e) {
                  console.error("Failed to get URL from webview:", e);
                }
              }
              return activeUrl
                ? `${node.browserId}:${encodeURIComponent(activeUrl)}`
                : node.browserId;
            }
            return node.terminalId || "";
          })
          .filter(Boolean);

        await api.reattachTab(terminalIds);
      } catch (err) {
        set({ error: `Failed to reattach: ${err}` });
      }
    },

    mergeTabAsSplit: (fromTabId, direction) => {
      const activeTabId = get().activeTabId;
      const prevTabs = get().tabs;
      if (!activeTabId || fromTabId === activeTabId) return;
      const fromTab = prevTabs.find((t) => t.id === fromTabId);
      if (!fromTab) return;

      const activeTab = prevTabs.find((t) => t.id === activeTabId);
      if (!activeTab) return;

      // Capture the browser URL from the source tab before it's removed.
      const fromNode = getNode(fromTab.root, []);
      const fromBrowserId = fromNode.browserId;
      let browserUrl = fromNode.url;
      if (!browserUrl && fromBrowserId) {
        try {
          const wv = document.getElementById(fromBrowserId) as any;
          if (wv && typeof wv.getURL === "function") {
            const url = wv.getURL();
            if (url && url !== "about:blank") browserUrl = url;
          }
        } catch {}
      }

      const newTerminalIds = collectLeafIds(fromTab.root);
      const updated = prevTabs.map((tab) => {
        if (tab.id !== activeTabId) return tab;

        const result = insertLeaves(
          tab.root,
          tab.focusedPath,
          direction,
          newTerminalIds,
        );

        // Set the URL on the newly inserted browser node so it doesn't
        // fall back to the homepage.
        if (browserUrl && fromBrowserId) {
          const newPath = leafPaths(result.root).find((p) => {
            const n = getNode(result.root, p);
            return n.browserId === fromBrowserId;
          });
          if (newPath) {
            const node = getNode(result.root, newPath);
            result.root = setNode(result.root, newPath, {
              ...node,
              url: browserUrl,
            });
          }
        }

        return {
          ...tab,
          root: result.root,
          focusedPath: result.focusedPath,
        };
      });
      set({
        tabs: updated.filter((t) => t.id !== fromTabId),
        tabActivationOrder: get().tabActivationOrder.filter(
          (t) => t !== fromTabId,
        ),
        hibernatedTabIds: get().hibernatedTabIds.filter((t) => t !== fromTabId),
      });
    },

    splitTab: async (direction, targetTabId, targetPath) => {
      const activeTabId = get().activeTabId;
      const tabId = targetTabId || activeTabId;
      if (!tabId) return;

      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab) return;

      const path = targetPath || tab.focusedPath;
      const targetNode = getNode(tab.root, path);
      const isBrowser = targetNode && targetNode.browserId !== undefined;

      if (isBrowser) {
        const browserId = `browser-${Date.now()}`;
        let currentUrl = targetNode.url;
        const origBrowserId = targetNode.browserId!;
        try {
          const webviewEl = document.getElementById(origBrowserId) as any;
          if (webviewEl) {
            const url = webviewEl.getURL();
            if (url && url !== "about:blank") currentUrl = url;
          }
        } catch {}

        // Fallback to the configured homepage if no URL was captured.
        // This happens when the browser tab was just created and did-navigate
        // hasn't fired yet, so targetNode.url is still undefined.
        if (!currentUrl) {
          try {
            const cfg = (window as any).__configStore?.getState?.()?.config;
            currentUrl = cfg?.browserHomepage || "https://duckduckgo.com";
          } catch {
            currentUrl = "https://duckduckgo.com";
          }
        }

        set((state) => {
          const currentTab = state.tabs.find((t) => t.id === tabId);
          if (!currentTab) return state;
          const result = insertLeaves(currentTab.root, path, direction, [
            browserId,
          ]);

          // Always set the URL on both browser nodes
          if (currentUrl) {
            const newPaths = leafPaths(result.root);

            // Update the new browser node
            const newBrowserPath = newPaths.find((p) => {
              const n = getNode(result.root, p);
              return n.browserId === browserId;
            });
            if (newBrowserPath) {
              const node = getNode(result.root, newBrowserPath);
              result.root = setNode(result.root, newBrowserPath, {
                ...node,
                url: currentUrl,
              });
            }

            // Also sync/update the original browser node
            const origBrowserPath = newPaths.find((p) => {
              const n = getNode(result.root, p);
              return n.browserId === origBrowserId;
            });
            if (origBrowserPath) {
              const node = getNode(result.root, origBrowserPath);
              result.root = setNode(result.root, origBrowserPath, {
                ...node,
                url: currentUrl,
              });
            }
          }
          return {
            tabs: state.tabs.map((t) => {
              if (t.id !== tabId) return t;
              return {
                ...t,
                root: result.root,
                focusedPath: result.focusedPath,
              };
            }),
          };
        });

        // After state update, ensure the original webview navigates to the correct URL.
        // If React reused the BrowserView instance, its webview might still show the
        // old page. Force-navigate it to currentUrl.
        if (currentUrl) {
          setTimeout(() => {
            try {
              const webviewEl = document.getElementById(origBrowserId) as any;
              if (webviewEl && typeof webviewEl.getURL === "function") {
                const nowUrl = webviewEl.getURL();
                if (nowUrl !== currentUrl) {
                  webviewEl.src = currentUrl;
                }
              }
            } catch {}
          }, 0);
        }
      } else {
        const api = window.terminalApi;
        if (!api) return;
        try {
          const { id } = await api.create();
          set((state) => {
            const currentTab = state.tabs.find((t) => t.id === tabId);
            if (!currentTab) {
              api.destroy(id);
              return state;
            }
            const result = insertLeaves(currentTab.root, path, direction, [id]);
            return {
              tabs: state.tabs.map((t) => {
                if (t.id !== tabId) return t;
                return {
                  ...t,
                  root: result.root,
                  focusedPath: result.focusedPath,
                };
              }),
            };
          });
        } catch (err) {
          set({ error: `Failed to split: ${err}` });
        }
      }
    },

    unsplitTab: async () => {
      const activeTabId = get().activeTabId;
      if (!activeTabId) return;
      const prevTabs = get().tabs;
      const activeTab = prevTabs.find((t) => t.id === activeTabId);
      if (!activeTab) return;

      const focusedNode = getNode(activeTab.root, activeTab.focusedPath);
      if (!focusedNode) return;

      const targetId = focusedNode.terminalId || focusedNode.browserId;
      if (!targetId) return;

      // Find all leaf nodes except the focused one
      const allPaths = leafPaths(activeTab.root);
      const toExtract = allPaths
        .map((p) => getNode(activeTab.root, p))
        .filter(
          (node) =>
            (node.terminalId || node.browserId) &&
            node.terminalId !== targetId &&
            node.browserId !== targetId,
        );

      if (toExtract.length === 0) return;

      const api = window.terminalApi;
      const baseLabel = activeTab.label.replace(/ \+ \d+$/, "");

      const extractedTabs: TabState[] = await Promise.all(
        toExtract.map(async (node) => {
          const tabId = generateTabId();
          if (node.browserId) {
            const tab = newBrowserTabState(tabId, node.browserId);
            if (node.url) {
              tab.root = { ...tab.root, url: node.url };
            }
            return tab;
          } else {
            let label = baseLabel;
            if (api && node.terminalId) {
              try {
                const info = await api.getTerminalInfo(node.terminalId);
                if (info?.title) label = info.title;
              } catch {}
            }
            return newTabState(tabId, node.terminalId!, label);
          }
        }),
      );

      set((state) => {
        const next = [...state.tabs];
        const tabIdx = next.findIndex((t) => t.id === activeTabId);
        if (tabIdx === -1) return state;

        next[tabIdx] = {
          ...next[tabIdx],
          root: focusedNode.terminalId
            ? leafNode(focusedNode.terminalId)
            : browserLeafNode(focusedNode.browserId!),
          focusedPath: [],
        };

        next.splice(tabIdx + 1, 0, ...extractedTabs);
        return { tabs: next };
      });
    },

    closeSplit: (tabId, terminalId) => {
      if (!terminalId.startsWith("browser-")) {
        const api = window.terminalApi;
        if (api) {
          api.destroy(terminalId);
        }
        if (_destroyTerminalCache) _destroyTerminalCache(terminalId);
      }

      const activeTabId = get().activeTabId;
      const prevTabs = get().tabs;

      const tabIdx = prevTabs.findIndex((t) => t.id === tabId);
      if (tabIdx === -1) return;

      const tab = prevTabs[tabIdx];

      // Find path of this terminal or browser leaf in the tree
      const foundPath = leafPaths(tab.root).find((p) => {
        const node = getNode(tab.root, p);
        return node.terminalId === terminalId || node.browserId === terminalId;
      });

      if (!foundPath) return;

      const result = removeLeaf(tab.root, foundPath);
      const next = [...prevTabs];

      if (!result.root) {
        next.splice(tabIdx, 1);
        let newActiveTabId = activeTabId;
        if (activeTabId === tabId) {
          const newActive = next[Math.min(tabIdx, next.length - 1)];
          newActiveTabId = newActive ? newActive.id : null;
        }
        set({
          tabs: next,
          activeTabId: newActiveTabId,
        });
        return;
      }

      const root = result.root;
      let newFocusedPath = result.newPath;
      const remaining = leafPaths(root).map((p) => getNode(root, p));
      if (remaining.length > 0) {
        const paths = leafPaths(root);
        if (
          paths.length > 0 &&
          !paths.some((p) => pathsEqual(p, result.newPath))
        ) {
          newFocusedPath = paths[paths.length - 1];
        }
      }

      next[tabIdx] = {
        ...tab,
        root,
        focusedPath: newFocusedPath,
      };
      set({ tabs: next });
    },

    extractToTab: async (tabId, path) => {
      const prevTabs = get().tabs;
      const tab = prevTabs.find((t) => t.id === tabId);
      if (!tab) return;

      if (tab.root.direction === undefined || !tab.root.children) {
        return;
      }

      const targetNode = getNode(tab.root, path);
      if (!targetNode) return;
      const isBrowser = targetNode.browserId !== undefined;
      const leafId = targetNode.terminalId || targetNode.browserId;
      if (!leafId) return;

      let label = tab.label.replace(/ \+ \d+$/, "");
      if (!isBrowser) {
        const api = window.terminalApi;
        if (!api) return;
        try {
          const info = await api.getTerminalInfo(leafId);
          if (info?.title) label = info.title;
        } catch {}
      }

      const tIndex = prevTabs.findIndex((t) => t.id === tabId);
      if (tIndex === -1) return;
      const currentTab = prevTabs[tIndex];

      const { root: newRoot, newPath } = removeLeaf(currentTab.root, path);
      if (!newRoot) return;

      const updated = [...prevTabs];
      updated[tIndex] = { ...currentTab, root: newRoot, focusedPath: newPath };

      const extractedTabId = generateTabId();
      const extractedTab = isBrowser
        ? (() => {
            const tab = newBrowserTabState(extractedTabId, leafId, label);
            if (targetNode.url) {
              tab.root = { ...tab.root, url: targetNode.url };
            }
            return tab;
          })()
        : newTabState(extractedTabId, leafId, label);

      updated.splice(tIndex + 1, 0, extractedTab);
      set({
        tabs: updated,
        activeTabId: extractedTabId,
        tabActivationOrder: [
          extractedTabId,
          ...get().tabActivationOrder.filter((t) => t !== extractedTabId),
        ],
      });
    },

    navigateSplit: (delta) => {
      const activeTabId = get().activeTabId;
      if (!activeTabId) return;
      set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          const newPath = navigatePath(tab.root, tab.focusedPath, delta);
          return { ...tab, focusedPath: newPath };
        }),
      }));
    },

    onResize: (tabId, path, newSizes) => {
      set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== tabId) return tab;
          if (path.length === 0) {
            return {
              ...tab,
              root: { ...tab.root, sizes: newSizes } as SplitNode,
            };
          }
          const updated = setNode(tab.root, path, {
            ...getNode(tab.root, path),
            sizes: newSizes,
          });
          return { ...tab, root: updated };
        }),
      }));
    },

    onFocusSplit: (tabId, path) => {
      set((state) => ({
        tabs: state.tabs.map((tab) =>
          tab.id === tabId ? { ...tab, focusedPath: path } : tab,
        ),
      }));
    },

    renameTab: (tabId, newLabel) => {
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, label: newLabel } : t,
        ),
      }));
    },

    updateBrowserUrl: (browserId, url) => {
      set((state) => ({
        tabs: state.tabs.map((tab) => {
          const updateUrl = (node: SplitNode): SplitNode => {
            if (node.browserId === browserId) {
              return { ...node, url };
            }
            if (node.children) {
              return { ...node, children: node.children.map(updateUrl) };
            }
            return node;
          };
          return { ...tab, root: updateUrl(tab.root) };
        }),
      }));
    },

    handleRunScript: async (cmd, cwd) => {
      const api = window.terminalApi;
      if (!api) return;
      const activeTabId = get().activeTabId;
      const prevTabs = get().tabs;
      try {
        const { id } = await api.create({ cwd });
        const activeTab = prevTabs.find((t) => t.id === activeTabId);
        if (activeTab) {
          set((state) => ({
            tabs: state.tabs.map((t) => {
              if (t.id !== activeTabId) return t;
              const result = insertLeaves(t.root, t.focusedPath, "horizontal", [
                id,
              ]);
              return {
                ...t,
                root: result.root,
                focusedPath: result.focusedPath,
              };
            }),
          }));
        } else {
          const tabId = generateTabId();
          set((state) => ({
            tabs: [...state.tabs, newTabState(tabId, id, "Script")],
            activeTabId: tabId,
            tabActivationOrder: [tabId, ...state.tabActivationOrder],
          }));
        }
        setTimeout(() => {
          api.write(id, cmd + "\r");
        }, 100);
      } catch (e) {
        set({ error: `Failed to run script: ${e}` });
      }
    },

    handleInjectSnippet: (snippet) => {
      const api = window.terminalApi;
      const activeTabId = get().activeTabId;
      if (!api || !activeTabId) return;
      const activeTab = get().tabs.find((t) => t.id === activeTabId);
      if (!activeTab) return;
      const node = getNode(activeTab.root, activeTab.focusedPath);
      if (node && node.terminalId) {
        api.write(node.terminalId, snippet);
      }
    },
  };
});
