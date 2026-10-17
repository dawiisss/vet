/** @jest-environment jsdom */
import { waitFor } from "@testing-library/react";
import { setupMockedApis, resetMockedApis } from "./rendererHelpers";
import { useTabStore, type TabState } from "../renderer/src/features/terminal/useTabStore";
import { getEditorDocument, setEditorDocument, saveEditorDocument } from "../renderer/src/features/workspace/editorDocumentStore";
import { hasPendingTabOperation, registerWindowCloseGuard } from "../renderer/src/features/terminal/tabLifecycle";
import { leafPaths } from "../renderer/src/features/terminal/splitTree";

let nextId = 0;
function dirtyTab(): TabState {
  const editorId = `editor-lifecycle-${++nextId}`;
  const root = { editorId, filePath: `/tmp/${editorId}.txt` };
  setEditorDocument(editorId, root.filePath, null, { content: "valuable edits", isDirty: true });
  return { id: `tab-lifecycle-${nextId}`, label: "Dirty", root, focusedPath: [] };
}

function install(tabs: TabState[]) {
  useTabStore.setState({ tabs, activeTabId: tabs[0]?.id || null, tabActivationOrder: tabs.map((tab) => tab.id) });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  setupMockedApis();
  resetMockedApis();
  useTabStore.setState({
    tabs: [], activeTabId: null, tabActivationOrder: [], hibernatedTabIds: [],
    isDetached: false, detachedTabId: null, nextTabId: 1,
  });
  jest.spyOn(window, "confirm").mockReturnValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
  expect(hasPendingTabOperation()).toBe(false);
});

test.each(["closeTab", "closeSplit"] as const)("%s preserves dirty editors on cancel and discards them only on acceptance", (action) => {
  const tab = dirtyTab();
  const mixed = { ...tab, root: { direction: "horizontal" as const, children: [tab.root, { terminalId: "pty" }], sizes: [0.5, 0.5] } };
  install([mixed]);
  const close = () => action === "closeTab"
    ? useTabStore.getState().closeTab(tab.id)
    : useTabStore.getState().closeSplit(tab.id, tab.root.editorId!);
  close();
  expect(useTabStore.getState().tabs).toEqual([mixed]);
  expect(window.terminalApi.destroy).not.toHaveBeenCalled();
  expect(getEditorDocument(tab.root.editorId!, tab.root.filePath!)?.content).toBe("valuable edits");
  expect(window.confirm).toHaveBeenCalledTimes(1);
  (window.confirm as jest.Mock).mockReturnValueOnce(true);
  close();
  expect(window.confirm).toHaveBeenCalledTimes(2);
  expect(getEditorDocument(tab.root.editorId!, tab.root.filePath!)).toBeUndefined();
  if (action === "closeTab") {
    expect(useTabStore.getState().tabs).toHaveLength(0);
    expect(window.terminalApi.destroy).toHaveBeenCalledWith("pty");
  } else {
    expect(useTabStore.getState().tabs[0]!.root).toEqual({ terminalId: "pty" });
    expect(window.terminalApi.destroy).not.toHaveBeenCalled();
  }
});

test("closing a clean tab does not prompt", () => {
  const tab = { id: "clean", label: "Shell", root: { terminalId: "pty" }, focusedPath: [] };
  install([tab]);
  useTabStore.getState().closeTab(tab.id);
  expect(window.confirm).not.toHaveBeenCalled();
  expect(window.terminalApi.destroy).toHaveBeenCalledWith("pty");
  expect(useTabStore.getState().tabs).toHaveLength(0);
});

test.each([true, false])("locks every layout mutation until detach settles with success=%s", async (success) => {
  const tab = dirtyTab();
  tab.root = { direction: "horizontal", children: [tab.root, { terminalId: "pty" }], sizes: [0.5, 0.5] };
  const other = { id: "other", label: "Other", root: { terminalId: "other-pty" }, focusedPath: [] };
  install([tab, other]);
  const response = deferred<{ success: boolean }>();
  const detach = window.terminalApi.detachTab as jest.Mock;
  detach.mockReturnValueOnce(response.promise);
  const pending = useTabStore.getState().detachTab(tab.id);
  try {
    // The lock must already hold before preparation reaches its first await.
    useTabStore.getState().openEditorInSplit("/tmp/new-dirty.txt", null);
    await waitFor(() => expect(detach).toHaveBeenCalledTimes(1));
    const store = useTabStore.getState();
    await store.splitTab("horizontal");
    await store.unsplitTab();
    await store.extractToTab(tab.id, [0]);
    store.openEditorInSplit("/tmp/new-dirty.txt", null);
    store.closeSplit(tab.id, "pty");
    store.closeTab(tab.id);
    store.onResize(tab.id, [], [0.1, 0.9]);
    store.mergeTabAsSplit(other.id, "vertical");
    await store.handleRunScript("echo bad", "/tmp");
    store.setActiveTabId(other.id);
    store.mergeTabAsSplit(tab.id, "vertical");
    store.setTabs([]);
    await store.detachTab(tab.id);
    expect(await store.loadProfileState({ tabs: [other] })).toBe(false);
    expect(useTabStore.getState().tabs).toEqual([tab, other]);
    expect(window.terminalApi.create).not.toHaveBeenCalled();
    expect(window.terminalApi.destroy).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(detach).toHaveBeenCalledTimes(1);
  } finally {
    response.resolve({ success });
    await pending;
  }
  expect(useTabStore.getState().tabs.map((entry) => entry.id)).toEqual(success ? [other.id] : [tab.id, other.id]);
  if (!success) {
    useTabStore.getState().setActiveTabId(tab.id);
    useTabStore.getState().openEditorInSplit("/tmp/retry.txt", null);
    expect(leafPaths(useTabStore.getState().tabs[0]!.root)).toHaveLength(3);
  }
});

test("a split started before detach cleans up its new PTY instead of changing the snapshot", async () => {
  const tab = dirtyTab();
  install([tab]);
  const created = deferred<{ id: string }>();
  (window.terminalApi.create as jest.Mock).mockReturnValueOnce(created.promise);
  const split = useTabStore.getState().splitTab("horizontal");
  const response = deferred<{ success: boolean }>();
  (window.terminalApi.detachTab as jest.Mock).mockReturnValueOnce(response.promise);
  const transfer = useTabStore.getState().detachTab(tab.id);
  try {
    created.resolve({ id: "late-pty" });
    await split;
    expect(window.terminalApi.destroy).toHaveBeenCalledWith("late-pty");
    expect(useTabStore.getState().tabs[0]!.root).toEqual(tab.root);
  } finally {
    response.resolve({ success: false });
    await transfer;
  }
});

test.each([false, true])("reattachment keeps additional tabs; extra tab=%s", async (extra) => {
  const tab = dirtyTab();
  install([tab]);
  useTabStore.setState({ isDetached: true, detachedTabId: tab.id });
  const response = deferred<{ success: boolean }>();
  (window.terminalApi.reattachTab as jest.Mock).mockReturnValueOnce(response.promise);
  const pending = useTabStore.getState().reattachMe();
  try {
    await waitFor(() => expect(window.terminalApi.reattachTab).toHaveBeenCalledTimes(1));
    useTabStore.getState().openEditorInSplit("/tmp/blocked.txt", null);
    if (extra) useTabStore.getState().openEditorInNewTab("/tmp/keep.txt", null);
    expect(useTabStore.getState().tabs[0]!.root).toEqual(tab.root);
    expect(window.windowApi.close).not.toHaveBeenCalled();
  } finally {
    response.resolve({ success: true });
    await pending;
  }
  expect(useTabStore.getState().tabs.some((entry) => entry.id === tab.id)).toBe(false);
  if (extra) {
    expect(useTabStore.getState().tabs[0]!.root.filePath).toBe("/tmp/keep.txt");
    expect(window.windowApi.close).not.toHaveBeenCalled();
  } else {
    expect(window.windowApi.close).toHaveBeenCalledTimes(1);
  }
});

test("profile replacement prompts before destroying terminals and reads fresh editor documents", async () => {
  const tab = dirtyTab();
  install([tab, { id: "shell", label: "Shell", root: { terminalId: "old-pty" }, focusedPath: [] }]);
  const profile = { tabs: [tab] };
  expect(await useTabStore.getState().loadProfileState(profile)).toBe(false);
  expect(window.terminalApi.destroy).not.toHaveBeenCalled();
  expect(useTabStore.getState().tabs).toHaveLength(2);
  (window.confirm as jest.Mock).mockReturnValueOnce(true);
  expect(await useTabStore.getState().loadProfileState(profile)).toBe(true);
  expect(window.terminalApi.destroy).toHaveBeenCalledWith("old-pty");
  expect(useTabStore.getState().tabs[0]!.root.editorId).not.toBe(tab.root.editorId);
  expect(getEditorDocument(tab.root.editorId!, tab.root.filePath!)).toBeUndefined();
});

test("profile replacement blocks layout and window closure while a pending save settles", async () => {
  const tab = dirtyTab();
  install([tab]);
  const saved = deferred<void>();
  const save = saveEditorDocument(tab.root.editorId!, tab.root.filePath!, null, () => saved.promise);
  (window.confirm as jest.Mock).mockReturnValueOnce(true);
  const loading = useTabStore.getState().loadProfileState({ tabs: [{ id: "new", label: "New", root: { terminalId: "old" } }] });
  const removeGuard = registerWindowCloseGuard(() => useTabStore.getState().tabs.map((entry) => entry.root));
  try {
    expect(getEditorDocument(tab.root.editorId!, tab.root.filePath!)?.isTransferring).toBe(true);
    useTabStore.getState().openEditorInNewTab("/tmp/blocked.txt", null);
    await useTabStore.getState().newTab();
    useTabStore.getState().newBrowserTab();
    useTabStore.getState().closeTab(tab.id);
    const closing = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(closing);
    expect(closing.defaultPrevented).toBe(true);
    expect(useTabStore.getState().tabs).toEqual([tab]);
    expect(window.terminalApi.create).not.toHaveBeenCalled();
  } finally {
    removeGuard();
    saved.resolve();
    await save;
    await loading;
  }
});

test("native window closure checks current dirty documents and supports cancellation", () => {
  const tab = dirtyTab();
  install([tab]);
  const removeGuard = registerWindowCloseGuard(() => useTabStore.getState().tabs.map((entry) => entry.root));
  try {
    const cancel = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    (window.confirm as jest.Mock).mockReturnValueOnce(true);
    const accept = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(accept);
    expect(accept.defaultPrevented).toBe(false);
    install([]);
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    expect(window.confirm).toHaveBeenCalledTimes(2);
  } finally {
    removeGuard();
  }
});

test("closing during a save does not resurrect the discarded document when the write finishes", async () => {
  const tab = dirtyTab();
  install([tab]);
  const saved = deferred<void>();
  const pending = saveEditorDocument(tab.root.editorId!, tab.root.filePath!, null, () => saved.promise);
  (window.confirm as jest.Mock).mockReturnValueOnce(true);
  useTabStore.getState().closeTab(tab.id);
  saved.resolve();
  await pending;
  expect(getEditorDocument(tab.root.editorId!, tab.root.filePath!)).toBeUndefined();
});
