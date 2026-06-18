import { SplitNode } from "../splitTree";
import { leafPaths, getNode } from "../splitTree";
import { destroyTerminalCache } from "../hooks/useTerminal";
import { useUIStore } from "@/shared/stores/useUIStore";

export function collectLeafIdsWithBrowserUrls(root: SplitNode): string[] {
  const leafNodes = leafPaths(root).map((p) => getNode(root, p));
  return leafNodes
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
}

export async function detachTabAction(
  set: any,
  get: any,
  tabId: string,
) {
  const api = window.terminalApi;
  if (!api) return;
  const activeTabId = get().activeTabId;
  const prevTabs = get().tabs;
  const tab = prevTabs.find((t: any) => t.id === tabId);
  if (!tab) return;
  try {
    const terminalIds = collectLeafIdsWithBrowserUrls(tab.root);

    await api.detachTab(tabId, terminalIds);
    terminalIds.forEach((id) => {
      const cleanId = id.split(":")[0]!;
      destroyTerminalCache(cleanId);
    });

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
      tabActivationOrder: get().tabActivationOrder.filter(
        (t: any) => t !== tabId,
      ),
      hibernatedTabIds: get().hibernatedTabIds.filter((t: any) => t !== tabId),
    });
  } catch (err: any) {
    useUIStore.getState().addToast(`Failed to detach tab: ${err.message || err}`, "error");
  }
}

export async function reattachMeAction(set: any, get: any) {
  const detachedTabId = get().detachedTabId;
  if (!detachedTabId) return;
  const tab = get().tabs[0];
  if (!tab) return;
  const api = window.terminalApi;
  if (!api) return;
  try {
    const terminalIds = collectLeafIdsWithBrowserUrls(tab.root);
    await api.reattachTab(terminalIds);
  } catch (err: any) {
    useUIStore.getState().addToast(`Failed to reattach: ${err.message || err}`, "error");
  }
}
