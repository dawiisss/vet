import type { SplitNode } from "../splitTree";
import { isWorkspaceSnapshot } from "../../../../../shared/utils/workspaceSnapshot";
import type { TabState, TabStore, TabStoreGet, TabStoreSet } from "../useTabStore";
import {
  leafNode,
  leafPaths,
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

export function setActiveTabIdAction(set: TabStoreSet, get: TabStoreGet, id: string | null) {
  if (!id) {
    set({ activeTabId: null });
    return;
  }
  set((state) => {
    let config: Config | undefined;
    try {
      config = useConfigStore.getState().config;
    } catch (e) {
      console.warn("Failed to get config from useConfigStore:", e);
    }
    const maxActive = config?.maxActiveTerminals ?? 4;
    const order = state.tabActivationOrder.filter((t) => t !== id);
    order.unshift(id);

    let hibernated = state.hibernatedTabIds.filter((t) => t !== id);

    if (maxActive > 0) {
      const nonHibernatedCount = state.tabs.length - hibernated.length;
      let excess = nonHibernatedCount - maxActive;
      let i = order.length - 1;
      while (excess > 0 && i >= 0) {
        const candidateId = order[i]!;
        if (candidateId !== id && !hibernated.includes(candidateId)) {
          const tab = state.tabs.find((t) => t.id === candidateId);
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

  const activeTab = get().tabs.find((t) => t.id === id);
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

export function initializeTabsAction(
  set: (state: Partial<TabStore>) => void,
  get: () => TabStore,
  initializedRef: { current: boolean },
) {
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

  const releaseWorkspace = lockWorkspaceReplacement();
  void (async () => {
    try {
      const saved: unknown = await api.getSession();
      if (isWorkspaceSnapshot(saved) && saved.tabs.length > 0) {
        set({ ...await restoreWorkspace(api, saved), tabsReady: true });
        return;
      }
    } catch (error) {
      console.warn("Failed to restore previous workspace:", error);
    }

    try {
      const { id } = await api.create();
      if (!id) throw new Error("Terminal creation returned no ID");
      const tabId = get().generateTabId();
      let label: string | undefined;
      try {
        const info = await api.getTerminalInfo(id);
        label = info?.title;
      } catch (error) {
        console.warn("Failed to get initial terminal info:", error);
      }
      set({
        tabs: [get().newTabState(tabId, id, label)],
        activeTabId: tabId,
        tabActivationOrder: [tabId],
        tabsReady: true,
      });
    } catch (error) {
      useUIStore.getState().addToast(`Failed to create terminal: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  })().finally(() => releaseWorkspace?.());
}

async function restoreEditor(node: SplitNode, newEditorIds: boolean): Promise<SplitNode> {
  const editorId = newEditorIds ? `editor-${globalThis.crypto.randomUUID()}` : node.editorId;
  const filePath = node.filePath!;
  const sshHostId = node.sshHostId;
  if (node.editorOptions) {
    const editorOptions = { ...node.editorOptions };
    delete editorOptions.sshConnectionId; // Connection IDs belong to the previous runtime.
    return { editorId, filePath, sshHostId, editorOptions };
  }

  const suffix = /#(git-diff|L(\d+)(?::(\d+))?)$/i.exec(filePath);
  if (suffix?.index) {
    // Old layouts encoded view options in the path. Only fall back if the
    // literal path is confirmed missing. An inaccessible file is ambiguous.
    try {
      const exists = sshHostId
        ? await window.sftpApi.fileExists(sshHostId, filePath)
        : await window.workspaceApi.fileExists(filePath);
      if (!exists) {
        const editorOptions: EditorOpenOptions = suffix[2]
          ? { line: Number(suffix[2]), column: suffix[3] ? Number(suffix[3]) : undefined }
          : { view: "git-diff" };
        return { editorId, filePath: filePath.slice(0, suffix.index), sshHostId, editorOptions };
      }
    } catch {
      // Leave the legacy marker pending so a later restore can resolve it.
      return { ...node, editorId };
    }
  }
  return { editorId, filePath, sshHostId, editorOptions: {} };
}

async function restoreWorkspace(api: TerminalApi, snapshot: WorkspaceSnapshot, newEditorIds = false) {
  const createdIds: string[] = [];

  const restoreNode = async (node: SplitNode): Promise<SplitNode> => {
    if (node.terminalId) {
      const { id } = await api.create();
      if (!id) throw new Error("Terminal creation returned no ID");
      createdIds.push(id);
      return leafNode(id);
    }
    if (node.editorId) return restoreEditor(node, newEditorIds);
    if (node.browserId) return { browserId: node.browserId, url: node.url };

    const children: SplitNode[] = [];
    for (const child of node.children!) children.push(await restoreNode(child));
    return { direction: node.direction, sizes: node.sizes, children };
  };

  const tabs: TabState[] = [];
  // Wait for all pane creation attempts before releasing any staged PTYs.
  const restored = await Promise.allSettled(snapshot.tabs.map(async (tab) => {
    const root = await restoreNode(tab.root);
    const paths = leafPaths(root);
    const focusedPath = paths.find((path) =>
      path.length === tab.focusedPath?.length && path.every((part, index) => tab.focusedPath?.[index] === part),
    ) ?? paths[0] ?? [];
    return { id: tab.id, label: tab.label, root, focusedPath };
  }));
  for (const tab of restored) {
    if (tab.status === "rejected") {
      await destroyWorkspaceTerminals(api, createdIds);
      throw tab.reason;
    }
    tabs.push(tab.value);
  }

  const activeTabId = tabs.find((tab) => tab.id === snapshot.activeTabId)?.id ?? tabs[0]?.id ?? null;
  let nextTabId = 1;
  let tabCounter = 1;
  for (const tab of tabs) {
    nextTabId = Math.max(nextTabId, Number(/^tab-(\d+)$/.exec(tab.id)?.[1] ?? 0) + 1);
    tabCounter = Math.max(tabCounter, Number(/^shell (\d+)$/.exec(tab.label)?.[1] ?? 0) + 1);
  }
  return { tabs, activeTabId, tabActivationOrder: tabs.map((tab) => tab.id), hibernatedTabIds: [], nextTabId, tabCounter };
}

async function destroyWorkspaceTerminals(api: TerminalApi, ids: string[]): Promise<void> {
  await Promise.allSettled(ids.map(async (id) => {
    destroyTerminalCache(id);
    await api.destroy(id);
  }));
}

export async function loadProfileStateAction(
  set: (state: Partial<TabStore>) => void,
  get: () => TabStore,
  profileState: unknown,
): Promise<boolean> {
  const api = window.terminalApi;
  if (!api) return false;
  if (!isWorkspaceSnapshot(profileState) || profileState.tabs.length === 0) {
    throw new Error("Saved workspace layout is invalid or empty");
  }
  const releaseWorkspace = lockWorkspaceReplacement();
  if (!releaseWorkspace) return false;
  let releaseDocuments: (() => void) | undefined;
  const roots = get().tabs.map((tab) => tab.root);
  try {
    if (!confirmDiscardDocuments(roots)) return false;
    const prepared = await prepareEditorTransfer({ children: roots });
    releaseDocuments = prepared.release;
    const next = await restoreWorkspace(api, profileState, true);
    set(next);
    roots.forEach(forgetEditorDocuments);
    await destroyWorkspaceTerminals(api, roots.flatMap(collectTerminalIds));
    return true;
  } finally {
    releaseDocuments?.();
    releaseWorkspace();
  }
}


export function onReattachTabAction(set: TabStoreSet, get: TabStoreGet) {
  const api = window.terminalApi;
  if (!api) return () => {};

  return api.onReattachTab((transferId) => {
    void receiveTabTransfer(transferId, (transfer) => {
      const tabId = get().generateTabId();
      set((state) => ({
        tabs: [...state.tabs, { id: tabId, label: transfer.label, root: transfer.root, focusedPath: transfer.focusedPath }],
        activeTabId: tabId,
        tabActivationOrder: [tabId, ...state.tabActivationOrder],
      }));
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      useUIStore.getState().addToast(`Failed to receive tab: ${message}`, "error");
    });
  });
}

export function pollTabLabelsAction(set: TabStoreSet, get: TabStoreGet) {
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
}

export async function newTabAction(
  set: TabStoreSet,
  get: TabStoreGet,
  profileId?: string,
  sshHostId?: string,
) {
  if (isWorkspaceLocked()) return;
  const api = window.terminalApi;
  if (!api) return;
  try {
    const { id } = await api.create({ profileId, sshHostId });
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
    const tabId = get().generateTabId();
    set((state) => ({
      tabs: [...state.tabs, get().newTabState(tabId, id, label)],
      activeTabId: tabId,
      tabActivationOrder: [tabId, ...state.tabActivationOrder],
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    useUIStore.getState().addToast(`Failed to create terminal: ${message}`, "error");
  }
}

export function newBrowserTabAction(set: TabStoreSet, get: TabStoreGet, url?: string) {
  if (isWorkspaceLocked()) return;
  const browserId = `browser-${Date.now()}`;
  const tabId = get().generateTabId();
  set((state) => {
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

export function closeTabAction(set: TabStoreSet, get: TabStoreGet, tabId: string) {
  if (isTabLocked(tabId)) return;
  const api = window.terminalApi;
  if (!api) return;
  const activeTabId = get().activeTabId;
  const prevTabs = get().tabs;
  const tab = prevTabs.find((t) => t.id === tabId);
  if (tab && !confirmDiscardDocuments([tab.root])) return;
  if (tab) {
    collectTerminalIds(tab.root).forEach((id) => {
      api.destroy(id);
      destroyTerminalCache(id);
    });
    forgetEditorDocuments(tab.root);
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
  // Automatic selection must wake the next tab just like clicking its tab.
  if (newActiveTabId !== activeTabId) get().setActiveTabId(newActiveTabId);
}

export function renameTabAction(set: TabStoreSet, _get: TabStoreGet, tabId: string, newLabel: string) {
  if (isTabLocked(tabId)) return;
  set((state) => ({
    tabs: state.tabs.map((t) =>
      t.id === tabId ? { ...t, label: newLabel } : t,
    ),
  }));
}

export function updateBrowserUrlAction(set: TabStoreSet, _get: TabStoreGet, browserId: string, url: string) {
  set((state) => ({
    tabs: state.tabs.map((tab) => {
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

export async function handleRunScriptAction(set: TabStoreSet, get: TabStoreGet, cmd: string, cwd: string) {
  const api = window.terminalApi;
  if (!api) return;
  const activeTabId = get().activeTabId;
  if (isWorkspaceLocked() || (activeTabId && isTabLocked(activeTabId))) return;
  const prevTabs = get().tabs;
  try {
    const { id } = await api.create({ cwd });
    const activeTab = prevTabs.find((t) => t.id === activeTabId);
    const { newTabState, generateTabId } = get();
    const { insertLeaves } = await import("../splitTree");
    if (isWorkspaceLocked() || (activeTabId && (isTabLocked(activeTabId) ||
        get().tabs.find((tab) => tab.id === activeTabId)?.root !== activeTab?.root))) {
      api.destroy(id);
      return;
    }
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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    useUIStore.getState().addToast(`Failed to run script: ${message}`, "error");
  }
}

export function handleInjectSnippetAction(_set: TabStoreSet, get: TabStoreGet, snippet: string) {
  const api = window.terminalApi;
  const activeTabId = get().activeTabId;
  if (!api || !activeTabId) return;
  const activeTab = get().tabs.find((t) => t.id === activeTabId);
  if (!activeTab) return;
  const node = getNode(activeTab.root, activeTab.focusedPath);
  if (node && node.terminalId) {
    api.write(node.terminalId, snippet);
  }
}

export function reorderTabsAction(
  set: TabStoreSet,
  _get: TabStoreGet,
  draggedTabId: string,
  targetTabId: string,
) {
  if (draggedTabId === targetTabId) return;

  set((state) => {
    const currentTabs = [...state.tabs];
    const fromIndex = currentTabs.findIndex((t) => t.id === draggedTabId);
    const toIndex = currentTabs.findIndex((t) => t.id === targetTabId);

    if (fromIndex === -1 || toIndex === -1) return state;

    const [movedTab] = currentTabs.splice(fromIndex, 1);
    if (!movedTab) return state;
    currentTabs.splice(toIndex, 0, movedTab);

    return {
      tabs: currentTabs,
    };
  });
}
