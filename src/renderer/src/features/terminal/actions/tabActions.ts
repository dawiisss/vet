import { SplitNode } from "../splitTree";
import type { TabState, useTabStore } from "../useTabStore";
import {
  leafNode,
  getNode,
  collectTerminalIds,
  leafCount,
  collectLeafIds,
} from "../splitTree";
import { destroyTerminalCache } from "../hooks/useTerminal";
import { useConfigStore } from "@/features/settings/useConfigStore";
import { useUIStore } from "@/shared/stores/useUIStore";
import { hydrateEditorDocuments, prepareEditorTransfer, forgetEditorDocuments } from "../../workspace/editorDocumentStore";
import { isTabLocked, isWorkspaceLocked, confirmDiscardDocuments, lockWorkspaceReplacement, lockTabTransfer } from "../tabLifecycle";

async function receiveTabTransfer(transferId: string, install: (transfer: TabTransferState) => void): Promise<void> {
  const release = lockTabTransfer(`incoming:${transferId}`);
  if (!release) throw new Error("Another workspace operation is in progress");
  try {
    const api = window.terminalApi;
    const transfer = await api.getTabTransfer(transferId);
    if (!transfer) throw new Error("Tab transfer is no longer available");
    hydrateEditorDocuments(transfer.editorDocuments);
    const result = await api.completeTabTransfer(transferId);
    if (!result.success) throw new Error("Could not complete tab transfer");
    install(transfer);
  } finally {
    release();
  }
}

export function setActiveTabIdAction(set: any, get: any, id: string | null) {
  if (!id) {
    set({ activeTabId: null });
    return;
  }
  set((state: any) => {
    let config: any = undefined;
    try {
      config = useConfigStore.getState().config;
    } catch (e) {
      console.warn("Failed to get config from useConfigStore:", e);
    }
    const maxActive = config?.maxActiveTerminals ?? 4;
    const order = state.tabActivationOrder.filter((t: any) => t !== id);
    order.unshift(id);

    let hibernated = state.hibernatedTabIds.filter((t: any) => t !== id);

    if (maxActive > 0) {
      const nonHibernatedCount = state.tabs.length - hibernated.length;
      let excess = nonHibernatedCount - maxActive;
      let i = order.length - 1;
      while (excess > 0 && i >= 0) {
        const candidateId = order[i];
        if (candidateId !== id && !hibernated.includes(candidateId)) {
          const tab = state.tabs.find((t: any) => t.id === candidateId);
          const terminalIds = tab ? collectTerminalIds(tab.root) : [];
          if (terminalIds.length > 0) {
            terminalIds.forEach((termId) => {
              destroyTerminalCache(termId);
            });
            hibernated = [...hibernated, candidateId];
            excess--;
          }
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

  const activeTab = get().tabs.find((t: any) => t.id === id);
  if (activeTab) {
    const termIds = collectTerminalIds(activeTab.root);
    try {
      const api = window.terminalApi;
      if (api) api.setForeground(termIds);
    } catch (e) {
      console.error("Failed to set foreground terminals:", e);
    }
  }
}

export function initializeTabsAction(set: any, get: any, initializedRef: any) {
  if (initializedRef.current) return;
  initializedRef.current = true;

  const params = new URLSearchParams(window.location.search);
  const detached = params.get("detached");
  const terminals = params.get("terminals");
  if (detached) {
    const rawIds = terminals ? terminals.split(",").filter(Boolean) : [];
    const transferId = params.get("transfer");
    if (transferId) {
      set({ isDetached: true, detachedTabId: detached, detachedTerminalIds: rawIds });
      void receiveTabTransfer(transferId, (transfer) => {
        set({
          tabs: [{ id: detached, label: transfer.label, root: transfer.root, focusedPath: transfer.focusedPath }],
          activeTabId: detached,
          tabActivationOrder: [detached],
        });
      }).catch((error) => {
        useUIStore.getState().setError(`Failed to receive tab: ${error.message || error}`);
      });
      return;
    }
    let transfer: { label: string; root: SplitNode; focusedPath: number[] } | null = null;
    try {
      const rawTab = params.get("tab");
      if (rawTab) transfer = JSON.parse(rawTab);
    } catch { /* Fall back to a terminal-only detached tab for older links. */ }
    const root = transfer?.root || (rawIds.length === 1 ? leafNode(rawIds[0]!) : {
      direction: "horizontal" as const,
      children: rawIds.map((id) => leafNode(id)),
      sizes: rawIds.map(() => 1 / rawIds.length),
    });
    set({
      isDetached: true,
      detachedTabId: detached,
      detachedTerminalIds: rawIds,
      tabs: [
        {
          id: detached,
          label: transfer?.label || "detached",
          root,
          focusedPath: transfer?.focusedPath || [],
        },
      ],
      activeTabId: detached,
      tabActivationOrder: [detached],
    });
    return;
  }

  const api = window.terminalApi;
  if (!api) {
    useUIStore.getState().setError("terminalApi not available — IPC not bridged");
    return;
  }

  // Helper to recursively recreate terminal sessions for leaf nodes
  async function recreateTerminalNodes(node: any): Promise<any> {
    if (node.terminalId) {
      try {
        const { id: newId } = await api.create();
        return { terminalId: newId };
      } catch (err) {
        console.error("Failed to recreate terminal node", err);
        throw err;
      }
    } else if (node.browserId) {
      return { browserId: node.browserId, url: node.url };
    } else if (node.editorId) {
      return {
        editorId: node.editorId,
        filePath: node.filePath,
        sshHostId: node.sshHostId,
      };
    } else if (node.children) {
      const newChildren = await Promise.all(
        node.children.map((child: any) => recreateTerminalNodes(child))
      );
      return {
        direction: node.direction,
        children: newChildren,
        sizes: node.sizes,
      };
    }
    return node;
  }

  api.getSession()
    .then(async (session: any) => {
      if (session && session.tabs && session.tabs.length > 0) {
        try {
          const restoredTabs = await Promise.all(
            session.tabs.map(async (tab: any) => {
              const restoredRoot = await recreateTerminalNodes(tab.root);
              return {
                id: tab.id,
                label: tab.label,
                root: restoredRoot,
                focusedPath: tab.focusedPath || [],
              };
            })
          );
          
          const restoredActiveId = session.activeTabId && restoredTabs.some(t => t.id === session.activeTabId)
            ? session.activeTabId
            : restoredTabs[0].id;

          // Find max tab ID number and shell counter to avoid collision on new tab creation
          let maxTabNum = 0;
          let maxShellNum = 0;
          for (const tab of restoredTabs) {
            const tabMatch = tab.id.match(/^tab-(\d+)$/);
            if (tabMatch) {
              const num = parseInt(tabMatch[1], 10);
              if (num > maxTabNum) maxTabNum = num;
            }
            const labelMatch = tab.label.match(/^shell (\d+)$/);
            if (labelMatch) {
              const num = parseInt(labelMatch[1], 10);
              if (num > maxShellNum) maxShellNum = num;
            }
          }

          set({
            tabs: restoredTabs,
            activeTabId: restoredActiveId,
            tabActivationOrder: restoredTabs.map(t => t.id),
            nextTabId: maxTabNum + 1,
            tabCounter: maxShellNum + 1,
          });
          return;
        } catch (err) {
          console.error("Error restoring session, falling back to default tab", err);
        }
      }

      // Default fallback if no session exists
      api
        .create()
        .then(async ({ id }) => {
          const tabId = get().generateTabId();
          let label: string | undefined;
          try {
            const info = await api.getTerminalInfo(id);
            if (info.title) label = info.title;
          } catch (e) {
            console.warn(`Failed to get terminal info for ${id}:`, e);
          }
          set({
            tabs: [get().newTabState(tabId, id, label)],
            activeTabId: tabId,
            tabActivationOrder: [tabId],
          });
        })
        .catch((err: any) => {
          useUIStore.getState().addToast(`Failed to create terminal: ${err.message || err}`, "error");
        });
    })
    .catch((err: any) => {
      console.warn("Failed to get session from database:", err);
      // Fallback
      api
        .create()
        .then(async ({ id }) => {
          const tabId = get().generateTabId();
          let label: string | undefined;
          try {
            const info = await api.getTerminalInfo(id);
            if (info.title) label = info.title;
          } catch (e) {
            console.warn(`Failed to get terminal info for fallback ${id}:`, e);
          }
          set({
            tabs: [get().newTabState(tabId, id, label)],
            activeTabId: tabId,
            tabActivationOrder: [tabId],
          });
        });
    });
}

export async function loadProfileStateAction(set: any, get: any, profileState: any): Promise<boolean> {
  if (!window.terminalApi || !profileState?.tabs?.length) return false;
  const releaseWorkspace = lockWorkspaceReplacement();
  if (!releaseWorkspace) return false;
  let releaseDocuments: (() => void) | undefined;
  const roots = get().tabs.map((tab: { root: SplitNode }) => tab.root);
  try {
    if (!confirmDiscardDocuments(roots)) return false;
    const prepared = await prepareEditorTransfer({ children: roots });
    releaseDocuments = prepared.release;
    const loaded = await replaceProfileState(set, get, profileState);
    if (loaded) roots.forEach(forgetEditorDocuments);
    return loaded;
  } finally {
    releaseDocuments?.();
    releaseWorkspace();
  }
}

async function replaceProfileState(
  set: typeof useTabStore.setState,
  get: typeof useTabStore.getState,
  profileState: { tabs: TabState[]; activeTabId?: string | null | undefined },
): Promise<boolean> {
  const api = window.terminalApi;
  if (!api) return false;

  const prevTabs = get().tabs;
  for (const tab of prevTabs) {
    collectTerminalIds(tab.root).forEach((id) => {
      api.destroy(id);
      destroyTerminalCache(id);
    });
  }

  async function recreateTerminalNodes(node: any): Promise<any> {
    if (node.terminalId) {
      try {
        const { id: newId } = await api.create();
        return { terminalId: newId };
      } catch (err) {
        console.error("Failed to recreate terminal node", err);
        throw err;
      }
    } else if (node.browserId) {
      return { browserId: node.browserId, url: node.url };
    } else if (node.editorId) {
      return {
        editorId: `editor-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        filePath: node.filePath,
        sshHostId: node.sshHostId,
      };
    } else if (node.children) {
      const newChildren = await Promise.all(
        node.children.map((child: any) => recreateTerminalNodes(child))
      );
      return {
        direction: node.direction,
        children: newChildren,
        sizes: node.sizes,
      };
    }
    return node;
  }

  if (profileState && profileState.tabs && profileState.tabs.length > 0) {
    try {
      const restoredTabs = await Promise.all(
        profileState.tabs.map(async (tab: any) => {
          const restoredRoot = await recreateTerminalNodes(tab.root);
          return {
            id: tab.id,
            label: tab.label,
            root: restoredRoot,
            focusedPath: tab.focusedPath || [],
          };
        })
      );
      
      const restoredActiveId = profileState.activeTabId && restoredTabs.some(t => t.id === profileState.activeTabId)
        ? profileState.activeTabId
        : restoredTabs[0]!.id;

      let maxTabNum = 0;
      let maxShellNum = 0;
      for (const tab of restoredTabs) {
        const tabMatch = tab.id.match(/^tab-(\d+)$/);
        if (tabMatch) {
          const num = parseInt(tabMatch[1], 10);
          if (num > maxTabNum) maxTabNum = num;
        }
        const labelMatch = tab.label.match(/^shell (\d+)$/);
        if (labelMatch) {
          const num = parseInt(labelMatch[1], 10);
          if (num > maxShellNum) maxShellNum = num;
        }
      }

      set({
        tabs: restoredTabs,
        activeTabId: restoredActiveId,
        tabActivationOrder: restoredTabs.map((t: any) => t.id),
        nextTabId: maxTabNum + 1,
        tabCounter: maxShellNum + 1,
      });
      return true;
    } catch (err) {
      console.error("Error restoring profile, falling back", err);
      try {
        const { id } = await api.create();
        const tabId = get().generateTabId();
        set({
          tabs: [get().newTabState(tabId, id, "shell 1")],
          activeTabId: tabId,
          tabActivationOrder: [tabId],
        });
        return true;
      } catch (fallbackErr) {
        console.error("Failed to create fallback terminal after profile error", fallbackErr);
      }
    }
  }
  return false;
}


export function onReattachTabAction(set: any, get: any) {
  const api = window.terminalApi;
  if (!api) return () => {};

  return api.onReattachTab((transferId) => {
    void receiveTabTransfer(transferId, (transfer) => {
      const tabId = get().generateTabId();
      set((state: any) => ({
        tabs: [...state.tabs, { id: tabId, label: transfer.label, root: transfer.root, focusedPath: transfer.focusedPath }],
        activeTabId: tabId,
        tabActivationOrder: [tabId, ...state.tabActivationOrder],
      }));
    }).catch((error) => {
      useUIStore.getState().addToast(`Failed to receive tab: ${error.message || error}`, "error");
    });
  });
}

export function pollTabLabelsAction(set: any, get: any) {
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
          const base = tab.label.replace(/ \+ \d+$/, "");
          targetLabel = base + suffix;
        }

        if (targetLabel && targetLabel !== tab.label) {
          updates.set(tab.id, targetLabel);
          changed = true;
        }
      } catch (e) {
        console.warn(`Failed to poll terminal info for tab ${tab.id}:`, e);
      }
    }

    if (active && changed) {
      set((state: any) => ({
        tabs: state.tabs.map((t: any) => {
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
}

export async function newTabAction(
  set: any,
  get: any,
  profileId?: string,
  sshHostId?: string,
) {
  if (isWorkspaceLocked()) return;
  const api = window.terminalApi;
  if (!api) return;
  try {
    const { id } = await api.create({ profileId, sshHostId });
    const tabId = get().generateTabId();
    let label: string | undefined;
    try {
      const info = await api.getTerminalInfo(id);
      if (info.title) label = info.title;
    } catch (e) {
      console.warn(`Failed to get terminal info for new tab ${id}:`, e);
    }
    if (isWorkspaceLocked()) {
      api.destroy(id);
      return;
    }
    set((state: any) => ({
      tabs: [...state.tabs, get().newTabState(tabId, id, label)],
      activeTabId: tabId,
      tabActivationOrder: [tabId, ...state.tabActivationOrder],
    }));
  } catch (err: any) {
    useUIStore.getState().addToast(`Failed to create terminal: ${err.message || err}`, "error");
  }
}

export function newBrowserTabAction(set: any, get: any, url?: string) {
  if (isWorkspaceLocked()) return;
  const browserId = `browser-${Date.now()}`;
  const tabId = get().generateTabId();
  set((state: any) => {
    const browserTab = get().newBrowserTabState(tabId, browserId);
    if (url) {
      browserTab.root = { ...browserTab.root, url };
    }
    return {
      tabs: [...state.tabs, browserTab],
      activeTabId: tabId,
      tabActivationOrder: [tabId, ...state.tabActivationOrder],
    };
  });
}

export function closeTabAction(set: any, get: any, tabId: string) {
  if (isTabLocked(tabId)) return;
  const api = window.terminalApi;
  if (!api) return;
  const activeTabId = get().activeTabId;
  const prevTabs = get().tabs;
  const tab = prevTabs.find((t: any) => t.id === tabId);
  if (tab && !confirmDiscardDocuments([tab.root])) return;
  if (tab) {
    collectTerminalIds(tab.root).forEach((id) => {
      api.destroy(id);
      destroyTerminalCache(id);
    });
    forgetEditorDocuments(tab.root);
  }
  const next = prevTabs.filter((t: any) => t.id !== tabId);
  let newActiveTabId = activeTabId;
  if (tabId === activeTabId) {
    const idx = prevTabs.findIndex((t: any) => t.id === tabId);
    const newActive = next[Math.min(idx, next.length - 1)];
    newActiveTabId = newActive ? newActive.id : null;
  }
  set({
    tabs: next,
    activeTabId: newActiveTabId,
    tabActivationOrder: get().tabActivationOrder.filter((t: any) => t !== tabId),
    hibernatedTabIds: get().hibernatedTabIds.filter((t: any) => t !== tabId),
  });
  // Automatic selection must wake the next tab just like clicking its tab.
  if (newActiveTabId !== activeTabId) get().setActiveTabId(newActiveTabId);
}

export function renameTabAction(set: any, get: any, tabId: string, newLabel: string) {
  if (isTabLocked(tabId)) return;
  set((state: any) => ({
    tabs: state.tabs.map((t: any) =>
      t.id === tabId ? { ...t, label: newLabel } : t,
    ),
  }));
}

export function updateBrowserUrlAction(set: any, get: any, browserId: string, url: string) {
  set((state: any) => ({
    tabs: state.tabs.map((tab: any) => {
      if (isTabLocked(tab.id)) return tab;
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
}

export async function handleRunScriptAction(set: any, get: any, cmd: string, cwd: string) {
  const api = window.terminalApi;
  if (!api) return;
  const activeTabId = get().activeTabId;
  if (isWorkspaceLocked() || (activeTabId && isTabLocked(activeTabId))) return;
  const prevTabs = get().tabs;
  try {
    const { id } = await api.create({ cwd });
    const activeTab = prevTabs.find((t: any) => t.id === activeTabId);
    const { newTabState, generateTabId } = get();
    const { insertLeaves } = await import("../splitTree");
    if (isWorkspaceLocked() || (activeTabId && (isTabLocked(activeTabId) ||
        get().tabs.find((tab: { id: string }) => tab.id === activeTabId)?.root !== activeTab?.root))) {
      api.destroy(id);
      return;
    }
    if (activeTab) {
      set((state: any) => ({
        tabs: state.tabs.map((t: any) => {
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
      set((state: any) => ({
        tabs: [...state.tabs, newTabState(tabId, id, "Script")],
        activeTabId: tabId,
        tabActivationOrder: [tabId, ...state.tabActivationOrder],
      }));
    }
    setTimeout(() => {
      api.write(id, cmd + "\r");
    }, 100);
  } catch (e: any) {
    useUIStore.getState().addToast(`Failed to run script: ${e.message || e}`, "error");
  }
}

export function handleInjectSnippetAction(set: any, get: any, snippet: string) {
  const api = window.terminalApi;
  const activeTabId = get().activeTabId;
  if (!api || !activeTabId) return;
  const activeTab = get().tabs.find((t: any) => t.id === activeTabId);
  if (!activeTab) return;
  const node = getNode(activeTab.root, activeTab.focusedPath);
  if (node && node.terminalId) {
    api.write(node.terminalId, snippet);
  }
}

export function reorderTabsAction(
  set: any,
  get: any,
  draggedTabId: string,
  targetTabId: string,
) {
  if (draggedTabId === targetTabId) return;

  set((state: any) => {
    const currentTabs = [...state.tabs];
    const fromIndex = currentTabs.findIndex((t) => t.id === draggedTabId);
    const toIndex = currentTabs.findIndex((t) => t.id === targetTabId);

    if (fromIndex === -1 || toIndex === -1) return state;

    const [movedTab] = currentTabs.splice(fromIndex, 1);
    currentTabs.splice(toIndex, 0, movedTab);

    return {
      tabs: currentTabs,
    };
  });
}
