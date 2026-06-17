import { useUIStore } from "../renderer/src/shared/stores/useUIStore";

describe("useUIStore", () => {
  beforeEach(() => {
    const store = useUIStore.getState();
    store.setError(null);
    store.setIsSettingsOpen(false);
    store.setIsAboutOpen(false);
    store.setIsCommandPaletteOpen(false);
    store.setViewingHistorySessionId(null);
    store.setPreviewFilePath(null);
    store.setPreviewClipboardItem(null);
  });

  it("setError correctly sets the error message", () => {
    const store = useUIStore.getState();
    expect(store.error).toBeNull();

    store.setError("Connection failed");
    expect(useUIStore.getState().error).toBe("Connection failed");
  });

  it("setIsSettingsOpen updates correctly using boolean and callback", () => {
    const store = useUIStore.getState();
    expect(store.isSettingsOpen).toBe(false);

    store.setIsSettingsOpen(true);
    expect(useUIStore.getState().isSettingsOpen).toBe(true);

    useUIStore.getState().setIsSettingsOpen((prev) => !prev);
    expect(useUIStore.getState().isSettingsOpen).toBe(false);
  });

  it("setIsAboutOpen updates correctly using boolean and callback", () => {
    const store = useUIStore.getState();
    expect(store.isAboutOpen).toBe(false);

    store.setIsAboutOpen(true);
    expect(useUIStore.getState().isAboutOpen).toBe(true);

    useUIStore.getState().setIsAboutOpen((prev) => !prev);
    expect(useUIStore.getState().isAboutOpen).toBe(false);
  });

  it("setIsCommandPaletteOpen updates correctly", () => {
    const store = useUIStore.getState();
    expect(store.isCommandPaletteOpen).toBe(false);

    store.setIsCommandPaletteOpen(true);
    expect(useUIStore.getState().isCommandPaletteOpen).toBe(true);
  });

  it("setViewingHistorySessionId correctly updates session ID", () => {
    const store = useUIStore.getState();
    expect(store.viewingHistorySessionId).toBeNull();

    store.setViewingHistorySessionId("session-456");
    expect(useUIStore.getState().viewingHistorySessionId).toBe("session-456");
  });

  it("setPreviewFilePath correctly updates file path", () => {
    const store = useUIStore.getState();
    expect(store.previewFilePath).toBeNull();

    store.setPreviewFilePath("/path/to/preview.txt");
    expect(useUIStore.getState().previewFilePath).toBe("/path/to/preview.txt");
  });

  it("setPreviewClipboardItem correctly updates item", () => {
    const store = useUIStore.getState();
    expect(store.previewClipboardItem).toBeNull();

    const mockItem = { id: "1", text: "hello", timestamp: 123456 };
    store.setPreviewClipboardItem(mockItem);
    expect(useUIStore.getState().previewClipboardItem).toEqual(mockItem);
  });
});
