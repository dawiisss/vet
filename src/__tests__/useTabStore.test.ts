/**
 * @jest-environment jsdom
 */

import { useTabStore } from "../renderer/src/features/terminal/useTabStore";
import {
  leafNode,
  browserLeafNode,
} from "../renderer/src/features/terminal/splitTree";
import { setupMockedApis } from "./rendererHelpers";
import { jest } from "@jest/globals";
import { getEditorDocument, setEditorDocument } from "../renderer/src/features/workspace/editorDocumentStore";

describe("useTabStore", () => {
  beforeEach(() => {
    setupMockedApis();
    const store = useTabStore.getState();
    store.setTabs([]);
    store.setActiveTabId(null);
    store.setDragState(null);

    // Clear mock functions
    const api = window.terminalApi as any;
    if (api) {
      api.detachTab.mockClear();
      api.reattachTab.mockClear();
      api.onReattachTab.mockClear();
    }
  });

  it("setActiveTabId correctly sets active tab ID", () => {
    const store = useTabStore.getState();
    expect(store.activeTabId).toBeNull();

    store.setActiveTabId("tab-123");
    expect(useTabStore.getState().activeTabId).toBe("tab-123");
  });

  it("setDragState correctly updates the drag state", () => {
    const store = useTabStore.getState();
    expect(store.dragState).toBeNull();

    store.setDragState({ tabId: "tab-99", zone: "right" });
    expect(useTabStore.getState().dragState).toEqual({
      tabId: "tab-99",
      zone: "right",
    });
  });

  it("renameTab updates the label of the correct tab", () => {
    const store = useTabStore.getState();

    // Set up a mock tab
    store.setTabs([
      {
        id: "tab-1",
        label: "Old Label",
        root: leafNode("term-1"),
        focusedPath: [],
      },
      {
        id: "tab-2",
        label: "Another Tab",
        root: leafNode("term-2"),
        focusedPath: [],
      },
    ]);

    expect(useTabStore.getState().tabs[0].label).toBe("Old Label");

    // Rename
    store.renameTab("tab-1", "New Label");

    const newTabs = useTabStore.getState().tabs;
    expect(newTabs.find((t) => t.id === "tab-1")?.label).toBe("New Label");
    // Ensure the other tab isn't affected
    expect(newTabs.find((t) => t.id === "tab-2")?.label).toBe("Another Tab");
  });

  it("detachTab transfers browser panes separately from PTY ownership", async () => {
    const store = useTabStore.getState();
    store.setTabs([
      {
        id: "tab-browser",
        label: "Web Browser",
        root: browserLeafNode("browser-123"),
        focusedPath: [],
      },
    ]);

    await store.detachTab("tab-browser");

    const api = window.terminalApi as any;
    expect(api.detachTab).toHaveBeenCalledWith("tab-browser", [], {
      label: "Web Browser",
      root: { browserId: "browser-123" },
      focusedPath: [],
      editorDocuments: [],
    });
    expect(useTabStore.getState().tabs).toHaveLength(0);
  });

  it("detachTab includes the browser URL in pane state", async () => {
    const store = useTabStore.getState();
    const browserNode = browserLeafNode("browser-123");
    browserNode.url = "https://google.com/search";
    store.setTabs([
      {
        id: "tab-browser",
        label: "Web Browser",
        root: browserNode,
        focusedPath: [],
      },
    ]);

    await store.detachTab("tab-browser");

    const api = window.terminalApi as any;
    expect(api.detachTab).toHaveBeenCalledWith("tab-browser", [], {
      label: "Web Browser",
      root: { browserId: "browser-123", url: "https://google.com/search" },
      focusedPath: [],
      editorDocuments: [],
    });
  });

  it("detachTab queries DOM webview element for URL if node.url is missing", async () => {
    const store = useTabStore.getState();
    store.setTabs([
      {
        id: "tab-browser",
        label: "Web Browser",
        root: browserLeafNode("browser-123"),
        focusedPath: [],
      },
    ]);

    // Create a mock webview element in document body
    const mockWebview = document.createElement("div");
    mockWebview.id = "browser-123";
    (mockWebview as any).getURL = () => "https://youtube.com";
    document.body.appendChild(mockWebview);

    await store.detachTab("tab-browser");

    const api = window.terminalApi as any;
    expect(api.detachTab).toHaveBeenCalledWith("tab-browser", [], {
      label: "Web Browser",
      root: { browserId: "browser-123", url: "https://youtube.com" },
      focusedPath: [],
      editorDocuments: [],
    });

    // Cleanup mock element
    document.body.removeChild(mockWebview);
  });

  it("initializeTabs reconstructs browser leaf nodes correctly when detached", () => {
    // Mock URL search params using history.pushState
    const transfer = encodeURIComponent(JSON.stringify({
      label: "Web Browser",
      root: { browserId: "browser-123", url: "https://google.com/search" },
      focusedPath: [],
    }));
    window.history.pushState(
      {},
      "",
      `?detached=tab-browser&terminals=&tab=${transfer}`,
    );

    // Run inside isolateModules to get a fresh copy of useTabStore
    jest.isolateModules(() => {
      const { useTabStore: freshUseTabStore } =
        require("../renderer/src/features/terminal/useTabStore") as any;
      freshUseTabStore.getState().initializeTabs();

      const updatedStore = freshUseTabStore.getState();
      expect(updatedStore.isDetached).toBe(true);
      const expectedNode = {
        ...browserLeafNode("browser-123"),
        url: "https://google.com/search",
      };
      expect(updatedStore.tabs[0].root).toEqual(expectedNode);
    });

    // Restore location
    window.history.pushState({}, "", "/");
  });

  it("onReattachTab reconstructs browser leaf nodes correctly", async () => {
    const store = useTabStore.getState();
    let callback: any;
    const api = window.terminalApi as any;
    api.onReattachTab.mockImplementation((cb: any) => {
      callback = cb;
      return () => {};
    });

    store.onReattachTab();
    expect(callback).toBeDefined();

    api.getTabTransfer.mockResolvedValueOnce({
      label: "Web Browser",
      root: { browserId: "browser-123", url: "https://google.com/search" },
      focusedPath: [],
      editorDocuments: [],
    });
    callback("reattach-browser");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const tabs = useTabStore.getState().tabs;
    const newTab = tabs[tabs.length - 1];
    expect(newTab.label).toBe("Web Browser");
    const expectedNode = {
      ...browserLeafNode("browser-123"),
      url: "https://google.com/search",
    };
    expect(newTab.root).toEqual(expectedNode);
  });

  it("keeps dirty editor panes until detach succeeds and restores editing on failure", async () => {
    const store = useTabStore.getState();
    const root = { editorId: "detach-dirty", filePath: "/tmp/dirty.txt" };
    store.setTabs([{ id: "dirty-tab", label: "Dirty", root, focusedPath: [] }]);
    store.setActiveTabId("dirty-tab");
    setEditorDocument(root.editorId, root.filePath, undefined, { content: "valuable edits", isDirty: true });
    const api = window.terminalApi as any;
    let finish!: (result: { success: boolean }) => void;
    api.detachTab.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = store.detachTab("dirty-tab");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useTabStore.getState().tabs).toHaveLength(1);
    expect(api.detachTab).toHaveBeenCalledWith("dirty-tab", [], expect.objectContaining({
      editorDocuments: [{ ...root, sshHostId: undefined, content: "valuable edits", isDirty: true }],
    }));
    expect(getEditorDocument(root.editorId, root.filePath)?.isTransferring).toBe(true);
    finish({ success: false });
    await pending;
    expect(useTabStore.getState().tabs).toHaveLength(1);
    expect(getEditorDocument(root.editorId, root.filePath)).toMatchObject({ content: "valuable edits", isDirty: true, isTransferring: false });
  });

  it("hydrates detached documents over IPC before acknowledging them", async () => {
    const api = window.terminalApi as any;
    const root = { editorId: "incoming-detach", filePath: "/tmp/incoming.txt" };
    api.getTabTransfer.mockResolvedValueOnce({
      label: "Incoming", root, focusedPath: [],
      editorDocuments: [{ ...root, content: "unsaved incoming", isDirty: true }],
    });
    api.completeTabTransfer.mockImplementationOnce(async () => {
      expect(getEditorDocument(root.editorId, root.filePath)?.content).toBe("unsaved incoming");
      return { success: true };
    });
    window.history.pushState({}, "", "?detached=incoming&transfer=opaque-id");
    try {
      useTabStore.getState().initializeTabs();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(api.getTabTransfer).toHaveBeenCalledWith("opaque-id");
      expect(api.completeTabTransfer).toHaveBeenCalledWith("opaque-id");
      expect(useTabStore.getState().tabs[0]?.root).toEqual(root);
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("reattaches dirty editor content over stale destination cache", async () => {
    const api = window.terminalApi as any;
    const root = { editorId: "reattach-dirty", filePath: "/tmp/reattach.txt" };
    setEditorDocument(root.editorId, root.filePath, undefined, { content: "old main-window text", isDirty: false });
    api.getTabTransfer.mockResolvedValueOnce({ label: "Reattached", root, focusedPath: [], editorDocuments: [
      { ...root, content: "edited in detached window", isDirty: true },
    ] });
    let callback!: (id: string) => void;
    api.onReattachTab.mockImplementationOnce((handler: (id: string) => void) => { callback = handler; return () => {}; });
    useTabStore.getState().onReattachTab();
    callback("reattach-editor");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useTabStore.getState().tabs[0]?.root).toEqual(root);
    expect(getEditorDocument(root.editorId, root.filePath)).toMatchObject({ content: "edited in detached window", isDirty: true });
  });

  it("initializeTabs restores saved session tabs and splits correctly", async () => {
    const api = window.terminalApi as any;
    api.getSession.mockResolvedValueOnce({
      activeTabId: "tab-saved-1",
      tabs: [
        {
          id: "tab-saved-1",
          label: "saved shell",
          root: { terminalId: "term-old" },
          focusedPath: [],
        },
      ],
    });
    api.create.mockResolvedValueOnce({ id: "term-new" });

    await new Promise<void>((resolve) => {
      jest.isolateModules(async () => {
        const { useTabStore: freshUseTabStore } =
          require("../renderer/src/features/terminal/useTabStore") as any;
        
        freshUseTabStore.getState().initializeTabs();

        // Allow microtasks/promises to resolve
        await new Promise((r) => setTimeout(r, 10));

        const updatedStore = freshUseTabStore.getState();
        expect(updatedStore.tabs.length).toBe(1);
        expect(updatedStore.tabs[0].id).toBe("tab-saved-1");
        expect(updatedStore.tabs[0].root).toEqual({ terminalId: "term-new" });
        expect(updatedStore.activeTabId).toBe("tab-saved-1");
        resolve();
      });
    });
  });

  it("openEditorInSplit falls back to opening in a new tab when no tabs exist", () => {
    const store = useTabStore.getState();
    expect(store.tabs).toHaveLength(0);

    store.openEditorInSplit("/path/to/main.ts", null);

    const tabs = useTabStore.getState().tabs;
    expect(tabs).toHaveLength(1);
    expect(tabs[0].label).toBe("Edit: main.ts");
  });

  it("reorderTabs correctly changes tab positions", () => {
    const store = useTabStore.getState();
    store.setTabs([
      { id: "tab-1", label: "Tab One", root: leafNode("term-1"), focusedPath: [] },
      { id: "tab-2", label: "Tab Two", root: leafNode("term-2"), focusedPath: [] },
      { id: "tab-3", label: "Tab Three", root: leafNode("term-3"), focusedPath: [] },
    ]);

    store.reorderTabs("tab-3", "tab-1");

    const tabs = useTabStore.getState().tabs;
    expect(tabs.map((t) => t.id)).toEqual(["tab-3", "tab-1", "tab-2"]);
  });
});
