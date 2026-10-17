import { SplitNode } from "../splitTree";
import type { TabState } from "../useTabStore";
import { leafPaths, getNode } from "../splitTree";
import { destroyTerminalCache } from "../hooks/useTerminal";
import { useUIStore } from "@/shared/stores/useUIStore";
import { collectTerminalIds } from "../splitTree";
import { prepareEditorTransfer } from "../../workspace/editorDocumentStore";
import { lockTabTransfer } from "../tabLifecycle";

function tabTransferData(tab: { label: string; root: SplitNode; focusedPath: number[] }, editorDocuments: EditorDocumentSnapshot[]): TabTransferState {
  const clone: SplitNode = JSON.parse(JSON.stringify(tab.root));
  const updateBrowserUrls = (node: SplitNode): void => {
    if (node.browserId) {
      const webviewEl = document.getElementById(node.browserId) as { getURL?: () => string } | null;
      try {
        if (webviewEl?.getURL) node.url = webviewEl.getURL();
      } catch { /* Use the last URL known to the tab store. */ }
    }
    node.children?.forEach(updateBrowserUrls);
  };
  updateBrowserUrls(clone);
  return { label: tab.label, root: clone, focusedPath: [...tab.focusedPath], editorDocuments };
}

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
  const prevTabs = get().tabs;
  const tab = prevTabs.find((t: any) => t.id === tabId);
  if (!tab) return;
  const releaseTab = lockTabTransfer(tabId);
  if (!releaseTab) return;
  let release: (() => void) | undefined;
  try {
    const prepared = await prepareEditorTransfer(tab.root);
    release = prepared.release;
    const terminalIds = collectTerminalIds(tab.root);
    const result = await api.detachTab(tabId, terminalIds, tabTransferData(tab, prepared.editorDocuments));
    if (!result.success) throw new Error("Could not detach this tab");
    terminalIds.forEach((id) => {
      destroyTerminalCache(id);
    });

    const currentTabs = get().tabs;
    const next = currentTabs.filter((t: any) => t.id !== tabId);
    const activeTabId = get().activeTabId;
    let newActiveTabId = activeTabId;
    if (tabId === newActiveTabId) {
      const idx = currentTabs.findIndex((t: any) => t.id === tabId);
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
    if (newActiveTabId !== activeTabId) get().setActiveTabId(newActiveTabId);
  } catch (err: any) {
    useUIStore.getState().addToast(`Failed to detach tab: ${err.message || err}`, "error");
  } finally {
    release?.();
    releaseTab();
  }
}

export async function reattachMeAction(set: any, get: any) {
  const detachedTabId = get().detachedTabId;
  if (!detachedTabId) return;
  const tab = get().tabs[0];
  if (!tab) return;
  const api = window.terminalApi;
  if (!api) return;
  const releaseTab = lockTabTransfer(tab.id);
  if (!releaseTab) return;
  let succeeded = false;
  let release: (() => void) | undefined;
  try {
    const prepared = await prepareEditorTransfer(tab.root);
    release = prepared.release;
    const terminalIds = collectTerminalIds(tab.root);
    const result = await api.reattachTab(terminalIds, tabTransferData(tab, prepared.editorDocuments));
    if (!result.success) throw new Error("Could not reattach this tab");
    terminalIds.forEach(destroyTerminalCache);
    const activeTabId = get().activeTabId;
    set((state: { tabs: TabState[]; tabActivationOrder: string[]; hibernatedTabIds: string[]; activeTabId: string | null }) => {
      const tabs = state.tabs.filter((entry) => entry.id !== tab.id);
      return {
        tabs,
        activeTabId: state.activeTabId === tab.id ? tabs[0]?.id || null : state.activeTabId,
        tabActivationOrder: state.tabActivationOrder.filter((id) => id !== tab.id),
        hibernatedTabIds: state.hibernatedTabIds.filter((id) => id !== tab.id),
      };
    });
    if (get().activeTabId !== activeTabId) get().setActiveTabId(get().activeTabId);
    succeeded = true;
  } catch (err: any) {
    useUIStore.getState().addToast(`Failed to reattach: ${err.message || err}`, "error");
  } finally {
    release?.();
    releaseTab();
  }
  // Other tabs may have been opened in this window. Keep them and their PTYs.
  // Close only after removing the moved tab so the unsaved-document window
  // guard does not mistake its transferred buffers for abandoned changes.
  if (succeeded && get().tabs.length === 0) window.windowApi?.close();
}
