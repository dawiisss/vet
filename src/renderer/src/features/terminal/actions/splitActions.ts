import { SplitNode } from "../splitTree";
import {
  getNode,
  insertLeaves,
  leafPaths,
  setNode,
  collectLeafIds,
  removeLeaf,
  navigatePath,
  leafNode,
  browserLeafNode,
} from "../splitTree";
import { destroyTerminalCache } from "../hooks/useTerminal";
import { useConfigStore } from "@/features/settings/useConfigStore";
import { useUIStore } from "@/shared/stores/useUIStore";
import { pathsEqual, DEFAULT_BROWSER_HOMEPAGE } from "../../../../../shared/utils/pathUtils";

export async function splitTabAction(
  set: any,
  get: any,
  direction: "horizontal" | "vertical",
  targetTabId?: string,
  targetPath?: number[],
) {
  const activeTabId = get().activeTabId;
  const tabId = targetTabId || activeTabId;
  if (!tabId) return;

  const tab = get().tabs.find((t: any) => t.id === tabId);
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
    } catch {
      // webview element may not be mounted yet or getURL unavailable
    }

    if (!currentUrl) {
      try {
        const cfg = useConfigStore.getState().config;
        currentUrl = cfg?.browserHomepage || DEFAULT_BROWSER_HOMEPAGE;
      } catch (err) {
        console.warn("Failed to retrieve config for browser homepage:", err);
        currentUrl = DEFAULT_BROWSER_HOMEPAGE;
      }
    }

    set((state: any) => {
      const currentTab = state.tabs.find((t: any) => t.id === tabId);
      if (!currentTab) return state;
      const result = insertLeaves(currentTab.root, path, direction, [
        browserId,
      ]);

      if (currentUrl) {
        const newPaths = leafPaths(result.root);

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
        tabs: state.tabs.map((t: any) => {
          if (t.id !== tabId) return t;
          return {
            ...t,
            root: result.root,
            focusedPath: result.focusedPath,
          };
        }),
      };
    });

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
        } catch {
          // webview state access is best-effort
        }
      }, 0);
    }
  } else {
    const api = window.terminalApi;
    if (!api) return;
    try {
      const { id } = await api.create();
      set((state: any) => {
        const currentTab = state.tabs.find((t: any) => t.id === tabId);
        if (!currentTab) {
          api.destroy(id);
          return state;
        }
        const result = insertLeaves(currentTab.root, path, direction, [id]);
        return {
          tabs: state.tabs.map((t: any) => {
            if (t.id !== tabId) return t;
            return {
              ...t,
              root: result.root,
              focusedPath: result.focusedPath,
            };
          }),
        };
      });
    } catch (err: any) {
      useUIStore.getState().addToast(`Failed to split: ${err.message || err}`, "error");
    }
  }
}

export async function unsplitTabAction(set: any, get: any) {
  const activeTabId = get().activeTabId;
  if (!activeTabId) return;
  const prevTabs = get().tabs;
  const activeTab = prevTabs.find((t: any) => t.id === activeTabId);
  if (!activeTab) return;

  const focusedNode = getNode(activeTab.root, activeTab.focusedPath);
  if (!focusedNode) return;

  const targetId = focusedNode.terminalId || focusedNode.browserId;
  if (!targetId) return;

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

  const { newTabState, newBrowserTabState, generateTabId } = get();

  const extractedTabs: any[] = await Promise.all(
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
          } catch {
            // terminal info may not be available during split
          }
        }
        return newTabState(tabId, node.terminalId!, label);
      }
    }),
  );

  set((state: any) => {
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
}

export function closeSplitAction(
  set: any,
  get: any,
  tabId: string,
  terminalId: string,
) {
  if (!terminalId.startsWith("browser-")) {
    const api = window.terminalApi;
    if (api) {
      api.destroy(terminalId);
    }
    destroyTerminalCache(terminalId);
  }

  const activeTabId = get().activeTabId;
  const prevTabs = get().tabs;

  const tabIdx = prevTabs.findIndex((t: any) => t.id === tabId);
  if (tabIdx === -1) return;

  const tab = prevTabs[tabIdx];

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
      newFocusedPath = paths[paths.length - 1]!;
    }
  }

  next[tabIdx] = {
    ...tab,
    root,
    focusedPath: newFocusedPath,
  };
  set({ tabs: next });
}

export async function extractToTabAction(
  set: any,
  get: any,
  tabId: string,
  path: number[],
) {
  const prevTabs = get().tabs;
  const tab = prevTabs.find((t: any) => t.id === tabId);
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
    } catch {
      // terminal info may not be available
    }
  }

  const tIndex = prevTabs.findIndex((t: any) => t.id === tabId);
  if (tIndex === -1) return;
  const currentTab = prevTabs[tIndex];

  const { root: newRoot, newPath } = removeLeaf(currentTab.root, path);
  if (!newRoot) return;

  const updated = [...prevTabs];
  updated[tIndex] = { ...currentTab, root: newRoot, focusedPath: newPath };

  const { newTabState, newBrowserTabState, generateTabId } = get();

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
      ...get().tabActivationOrder.filter((t: any) => t !== extractedTabId),
    ],
  });
}

export function navigateSplitAction(set: any, get: any, delta: number) {
  const activeTabId = get().activeTabId;
  if (!activeTabId) return;
  set((state: any) => ({
    tabs: state.tabs.map((tab: any) => {
      if (tab.id !== activeTabId) return tab;
      const newPath = navigatePath(tab.root, tab.focusedPath, delta);
      return { ...tab, focusedPath: newPath };
    }),
  }));
}

export function onResizeAction(
  set: any,
  get: any,
  tabId: string,
  path: number[],
  newSizes: number[],
) {
  set((state: any) => ({
    tabs: state.tabs.map((tab: any) => {
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
}

export function onFocusSplitAction(
  set: any,
  get: any,
  tabId: string,
  path: number[],
) {
  set((state: any) => ({
    tabs: state.tabs.map((tab: any) =>
      tab.id === tabId ? { ...tab, focusedPath: path } : tab,
    ),
  }));
}

export function mergeTabAsSplitAction(
  set: any,
  get: any,
  fromTabId: string,
  direction: "horizontal" | "vertical",
) {
  const activeTabId = get().activeTabId;
  const prevTabs = get().tabs;
  if (!activeTabId || fromTabId === activeTabId) return;
  const fromTab = prevTabs.find((t: any) => t.id === fromTabId);
  if (!fromTab) return;

  const activeTab = prevTabs.find((t: any) => t.id === activeTabId);
  if (!activeTab) return;

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
    } catch {
      // webview may not be available during drag merge
    }
  }

  const newTerminalIds = collectLeafIds(fromTab.root);
  const updated = prevTabs.map((tab: any) => {
    if (tab.id !== activeTabId) return tab;

    const result = insertLeaves(
      tab.root,
      tab.focusedPath,
      direction,
      newTerminalIds,
    );

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
    tabs: updated.filter((t: any) => t.id !== fromTabId),
    tabActivationOrder: get().tabActivationOrder.filter(
      (t: any) => t !== fromTabId,
    ),
    hibernatedTabIds: get().hibernatedTabIds.filter((t: any) => t !== fromTabId),
  });
}
