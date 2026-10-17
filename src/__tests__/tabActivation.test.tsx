/** @jest-environment jsdom */
import { renderHook, fireEvent, act } from "@testing-library/react";
import { setupMockedApis, resetMockedApis } from "./rendererHelpers";
import { useTabStore, type TabState } from "../renderer/src/features/terminal/useTabStore";
import { useConfigStore } from "../renderer/src/features/settings/useConfigStore";
import { useKeybindings } from "../renderer/src/shared/hooks/useKeybindings";

jest.mock("../renderer/src/features/terminal/hooks/useTerminal", () => ({ destroyTerminalCache: jest.fn() }));

const originalConfig = useConfigStore.getState().config;
const tabs: TabState[] = Array.from({ length: 5 }, (_, index) => ({
  id: `tab-${index}`, label: `Shell ${index}`, root: { terminalId: `pty-${index}` }, focusedPath: [],
}));

beforeEach(() => {
  setupMockedApis();
  resetMockedApis();
  useConfigStore.setState({ config: {
    ...originalConfig, maxActiveTerminals: 2,
    keybindings: { "ctrl+shift+w": "tab:close" },
  } });
  useTabStore.setState({
    tabs, activeTabId: "tab-0", tabActivationOrder: ["tab-0", "tab-4", "tab-3", "tab-2", "tab-1"],
    hibernatedTabIds: ["tab-1", "tab-2", "tab-3"], isDetached: false, detachedTabId: null,
  });
});

afterEach(() => {
  useConfigStore.setState({ config: originalConfig });
});

function expectNextTabAwake() {
  const state = useTabStore.getState();
  expect(state.activeTabId).toBe("tab-1");
  expect(state.hibernatedTabIds).not.toContain("tab-1");
  expect(state.tabActivationOrder[0]).toBe("tab-1");
  expect(window.terminalApi.setForeground).toHaveBeenLastCalledWith(["pty-1"]);
  expect(window.terminalApi.destroy).not.toHaveBeenCalledWith("pty-1");
  expect(window.terminalApi.create).not.toHaveBeenCalled();
}

test("the close-tab keyboard shortcut wakes a hibernated neighbor", () => {
  const hook = renderHook(() => useKeybindings());
  try {
    act(() => { fireEvent.keyDown(document, { key: "w", ctrlKey: true, shiftKey: true }); });
    expectNextTabAwake();
  } finally {
    hook.unmount();
  }
});

test.each(["closeTab", "closeSplit", "detachTab", "reattachMe"] as const)("%s wakes the next tab without replacing its shell", async (action) => {
  const store = useTabStore.getState();
  if (action === "closeTab") store.closeTab("tab-0");
  else if (action === "closeSplit") store.closeSplit("tab-0", "pty-0");
  else if (action === "detachTab") await store.detachTab("tab-0");
  else {
    useTabStore.setState({ isDetached: true, detachedTabId: "tab-0" });
    await store.reattachMe();
  }
  expectNextTabAwake();
});

test("closing a background tab keeps the active tab and its activation order", () => {
  useTabStore.getState().closeTab("tab-4");
  const state = useTabStore.getState();
  expect(state.activeTabId).toBe("tab-0");
  expect(state.hibernatedTabIds).toEqual(["tab-1", "tab-2", "tab-3"]);
  expect(state.tabActivationOrder).toEqual(["tab-0", "tab-3", "tab-2", "tab-1"]);
  expect(window.terminalApi.destroy).toHaveBeenCalledTimes(1);
  expect(window.terminalApi.destroy).toHaveBeenCalledWith("pty-4");
});

test("repeated keyboard closes keep every remaining active terminal awake through the final tab", () => {
  const hook = renderHook(() => useKeybindings());
  try {
    for (let index = 0; index < tabs.length; index++) {
      act(() => { fireEvent.keyDown(document, { key: "w", ctrlKey: true, shiftKey: true }); });
      const state = useTabStore.getState();
      const expected = tabs[index + 1];
      expect(state.activeTabId).toBe(expected?.id || null);
      if (expected) {
        expect(state.hibernatedTabIds).not.toContain(expected.id);
        expect(state.tabActivationOrder[0]).toBe(expected.id);
        expect(window.terminalApi.setForeground).toHaveBeenLastCalledWith([expected.root.terminalId]);
      } else {
        expect(state.tabs).toEqual([]);
        expect(state.hibernatedTabIds).toEqual([]);
        expect(state.tabActivationOrder).toEqual([]);
      }
    }
    expect(window.terminalApi.create).not.toHaveBeenCalled();
    expect(window.terminalApi.destroy).toHaveBeenCalledTimes(tabs.length);
  } finally {
    hook.unmount();
  }
});
