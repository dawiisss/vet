import { useEffect } from "react";
import { buildShortcutString } from "@/shared/utils/keybindings";
import { useConfigStore } from "@/features/settings/useConfigStore";
import { useTabStore } from "@/features/terminal/useTabStore";
import { useUIStore } from "@/shared/stores/useUIStore";
import { useUpdaterStore } from "@/shared/stores/useUpdaterStore";

/**
 * Hook to manage global keybindings, Escape key modal closures,
 * and key forwarding from webviews.
 */
export function useKeybindings() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const shortcut = buildShortcutString(e);
      if (!shortcut) return;

      const currentConfig = useConfigStore.getState().config;
      const action = (currentConfig.keybindings || {})[shortcut];

      if (
        action &&
        !action.startsWith("terminal:") &&
        !action.startsWith("browser:")
      ) {
        e.preventDefault();
        e.stopPropagation();
        const store = useTabStore.getState();
        const { tabs: storeTabs, activeTabId: storeActiveTabId } = store;

        switch (action) {
          case "sidebar:toggle":
            useConfigStore
              .getState()
              .updateConfig({ sidebarOpen: !currentConfig.sidebarOpen });
            break;
          case "tab:new":
            store.newTab();
            break;
          case "tab:close":
            if (storeActiveTabId) store.closeTab(storeActiveTabId);
            break;
          case "tab:next": {
            if (storeTabs.length < 2) break;
            const idx = storeTabs.findIndex((t) => t.id === storeActiveTabId);
            store.setActiveTabId(storeTabs[(idx + 1) % storeTabs.length]!.id);
            break;
          }
          case "tab:prev": {
            if (storeTabs.length < 2) break;
            const idx = storeTabs.findIndex((t) => t.id === storeActiveTabId);
            store.setActiveTabId(
              storeTabs[(idx - 1 + storeTabs.length) % storeTabs.length]!.id,
            );
            break;
          }
          case "split:extract": {
            const tab = storeTabs.find((t) => t.id === storeActiveTabId);
            if (tab && storeActiveTabId) {
              store.extractToTab(storeActiveTabId, tab.focusedPath);
            }
            break;
          }
          case "split:horizontal":
            store.splitTab("horizontal");
            break;
          case "split:vertical":
            store.splitTab("vertical");
            break;
          case "pane:focus-next":
            store.navigateSplit(1);
            break;
          case "pane:focus-prev":
            store.navigateSplit(-1);
            break;
          case "settings:toggle":
            useUIStore.getState().setIsSettingsOpen((prev) => !prev);
            break;
          case "command-palette:toggle":
            useUIStore.getState().setIsCommandPaletteOpen((prev) => !prev);
            break;
          case "tabbar:toggle-position": {
            const currentPos = currentConfig.tabBarPosition || "top";
            const nextPos =
              currentPos === "top"
                ? "left"
                : currentPos === "left"
                  ? "right"
                  : "top";
            useConfigStore.getState().updateConfig({ tabBarPosition: nextPos });
            break;
          }
          case "split:unsplit":
            store.unsplitTab();
            break;
          case "app:toggle-fullscreen":
            window.windowApi?.toggleFullscreen();
            break;
          case "app:maximize":
            window.windowApi?.maximize();
            break;
          case "app:quit":
            window.windowApi?.quit();
            break;
        }
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const uiStore = useUIStore.getState();
      if (e.key === "Escape" && uiStore.isCommandPaletteOpen) {
        uiStore.setIsCommandPaletteOpen(false);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === "Escape" && uiStore.isAboutOpen) {
        uiStore.setIsAboutOpen(false);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === "Escape" && uiStore.isUpdateModalOpen) {
        const updaterState = useUpdaterStore.getState();
        if (updaterState.status !== "downloading") {
          uiStore.setIsUpdateModalOpen(false);
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        e.stopPropagation();
        uiStore.setIsSettingsOpen((prev) => !prev);
      } else if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        e.stopPropagation();
        uiStore.setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleGlobalKeyDown, {
        capture: true,
      });
  }, []);

  useEffect(() => {
    if (!window.windowApi?.onWebviewKeydown) return;

    const unsubscribe = window.windowApi.onWebviewKeydown((data) => {
      const eventInit: KeyboardEventInit = {
        key: data.key,
        code: data.code,
        ctrlKey: data.ctrlKey,
        shiftKey: data.shiftKey,
        altKey: data.altKey,
        metaKey: data.metaKey,
        bubbles: true,
        cancelable: true,
      };

      const fakeEvent = new KeyboardEvent("keydown", eventInit);
      window.dispatchEvent(fakeEvent);
      document.dispatchEvent(fakeEvent);
    });

    return () => {
      unsubscribe();
    };
  }, []);
}
