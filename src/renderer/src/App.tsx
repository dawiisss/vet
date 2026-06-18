import { useEffect, useRef } from "react";
import TitleBar from "@/shared/components/TitleBar";
import TabBar from "@/features/terminal/components/TabBar";
import type { TabBarTab } from "@/features/terminal/components/TabBar";
import SplitPane from "@/features/terminal/components/SplitPane";
import {
  getNode,
  leafCount,
} from "@/features/terminal/splitTree";
import { useConfig } from "@/features/settings/useConfigStore";
import { useTabStore } from "@/features/terminal/useTabStore";
import { useTabDrag } from "@/features/terminal/useTabDrag";
import { useUIStore } from "@/shared/stores/useUIStore";
import Sidebar from "@/shared/components/Sidebar";
import ErrorBoundary from "@/shared/components/ErrorBoundary";
import { useUpdaterStore } from "@/shared/stores/useUpdaterStore";
import ThemeProvider from "@/shared/components/ThemeProvider";
import ModalManager from "@/shared/components/ModalManager";
import { useKeybindings } from "@/shared/hooks/useKeybindings";

/**
 * Main application scaffold component (AppShell).
 * Manages layout structuring, sidebar panels, split layout terminal container,
 * and delegates themes, modals, and hotkeys to custom hooks and providers.
 */
function App() {
  const { config } = useConfig();
  const error = useUIStore((s) => s.error);
  const configError = useUIStore((s) => s.configError);
  const dbError = useUIStore((s) => s.dbError);
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  const setDbError = useUIStore((s) => s.setDbError);
  const setIsSettingsOpen = useUIStore((s) => s.setIsSettingsOpen);
  const setIsAboutOpen = useUIStore((s) => s.setIsAboutOpen);
  const setViewingHistorySessionId = useUIStore((s) => s.setViewingHistorySessionId);
  const setPreviewFilePath = useUIStore((s) => s.setPreviewFilePath);

  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const isDetached = useTabStore((s) => s.isDetached);
  const hibernatedTabIds = useTabStore((s) => s.hibernatedTabIds);
  const initializeTabs = useTabStore((s) => s.initializeTabs);
  const onReattachTab = useTabStore((s) => s.onReattachTab);
  const pollTabLabels = useTabStore((s) => s.pollTabLabels);
  const newTab = useTabStore((s) => s.newTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const selectTab = useTabStore((s) => s.selectTab);
  const splitTab = useTabStore((s) => s.splitTab);
  const closeSplit = useTabStore((s) => s.closeSplit);
  const extractToTab = useTabStore((s) => s.extractToTab);
  const onResize = useTabStore((s) => s.onResize);
  const onFocusSplit = useTabStore((s) => s.onFocusSplit);
  const renameTab = useTabStore((s) => s.renameTab);
  const handleRunScript = useTabStore((s) => s.handleRunScript);
  const handleInjectSnippet = useTabStore((s) => s.handleInjectSnippet);
  const reattachMe = useTabStore((s) => s.reattachMe);

  const { dragState, handleDragStart, handleDragMove, handleDragEnd } =
    useTabDrag();

  const terminalAreaRef = useRef<HTMLDivElement>(null);

  // Initialize global keyboard shortcuts and webview key-forwarding
  useKeybindings();

  // Fetch initial history db error status
  useEffect(() => {
    if (window.historyApi) {
      window.historyApi.getDbError().then((err) => {
        setDbError(err);
      });
    }
  }, []);

  // Initialize tabs from URL/IPC on mount
  useEffect(() => {
    initializeTabs();
  }, []);

  // Initialize auto-updater subscription
  useEffect(() => {
    return useUpdaterStore.getState().init();
  }, []);

  // Listen for window reattach tab requests
  useEffect(() => {
    return onReattachTab();
  }, []);

  // Poll foreground process names periodically to keep tab labels in sync
  useEffect(() => {
    return pollTabLabels();
  }, []);

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100vw",
          height: "100vh",
          background: "var(--app-bg)",
          color: "var(--app-fg)",
          fontFamily: "monospace",
          fontSize: 14,
        }}
      >
        {error}
      </div>
    );
  }

  const tabBarTabs: TabBarTab[] = tabs.map((t) => ({
    id: t.id,
    label: t.label,
  }));

  // Detached/popout mode
  if (isDetached) {
    return (
      <ThemeProvider>
        <TitleBar />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--app-panel-bg)",
            borderBottom: "1px solid var(--app-border)",
            height: 28,
            padding: "0 12px",
            userSelect: "none",
          }}
        >
          <span
            style={{
              color: "var(--app-fg-subtle)",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            detached
          </span>
          <span
            onClick={reattachMe}
            style={{
              color: "var(--app-fg-muted)",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = "var(--app-fg)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = "var(--app-fg-muted)";
            }}
          >
            reattach
          </span>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          {tabs.map((tab) => {
            const isHibernated = hibernatedTabIds.includes(tab.id);
            return (
              <div
                key={tab.id}
                style={{
                  visibility: tab.id === activeTabId ? "visible" : "hidden",
                  position: tab.id === activeTabId ? "relative" : "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: tab.id === activeTabId ? 1 : 0,
                  display: "flex",
                  width: "100%",
                  height: "100%",
                }}
              >
                {!isHibernated && (
                  <SplitPane
                    node={tab.root}
                    path={[]}
                    focusedPath={tab.focusedPath}
                    isActive={tab.id === activeTabId}
                    onFocus={(path) => onFocusSplit(tab.id, path)}
                    onExit={(terminalId) => closeSplit(tab.id, terminalId)}
                    onResize={(path, newSizes) =>
                      onResize(tab.id, path, newSizes)
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </ThemeProvider>
    );
  }

  const handleContextMenuAction = (
    tabId: string,
    path: number[],
    action: "split-h" | "split-v" | "close",
  ) => {
    onFocusSplit(tabId, path);

    if (action === "split-h") {
      splitTab("horizontal", tabId, path);
    } else if (action === "split-v") {
      splitTab("vertical", tabId, path);
    } else if (action === "close") {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        const targetNode = getNode(tab.root, path);
        const leafId = targetNode?.terminalId || targetNode?.browserId;
        if (leafId) {
          closeSplit(tabId, leafId);
        }
      }
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeTerminalId = activeTab
    ? getNode(activeTab.root, activeTab.focusedPath)?.terminalId || null
    : null;

  return (
    <ThemeProvider>
      <TitleBar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
      />
      {configError && (
        <div className="app-warning-banner" id="config-warning-banner">
          <div className="app-warning-banner-message">
            <span>⚠️</span>
            <span><strong>Configuration Error:</strong> {configError}</span>
          </div>
          <button
            className="app-warning-banner-close"
            onClick={() => useUIStore.getState().setConfigError(null)}
          >
            ×
          </button>
        </div>
      )}
      {dbError && (
        <div className="app-warning-banner" id="db-warning-banner">
          <div className="app-warning-banner-message">
            <span>⚠️</span>
            <span><strong>Database Error:</strong> {dbError}</span>
          </div>
          <button
            className="app-warning-banner-close"
            onClick={() => useUIStore.getState().setDbError(null)}
          >
            ×
          </button>
        </div>
      )}
      {(!config.tabBarPosition || config.tabBarPosition === "top") && (
        <TabBar
          tabs={tabBarTabs}
          activeTabId={activeTabId}
          onSelect={selectTab}
          onClose={closeTab}
          onNew={newTab}
          onDragStart={handleDragStart}
          onDragMove={(x, y) => handleDragMove(x, y, terminalAreaRef.current)}
          onDragEnd={(tabId, x, y) =>
            handleDragEnd(tabId, x, y, terminalAreaRef.current)
          }
          onRenameTab={renameTab}
        />
      )}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          borderTop:
            config.tabBarPosition === "left" ||
            config.tabBarPosition === "right"
              ? "1px solid var(--app-border)"
              : "none",
        }}
      >
        {config.tabBarPosition === "left" && (
          <TabBar
            tabs={tabBarTabs}
            activeTabId={activeTabId}
            onSelect={selectTab}
            onClose={closeTab}
            onNew={newTab}
            onDragStart={handleDragStart}
            onDragMove={(x, y) => handleDragMove(x, y, terminalAreaRef.current)}
            onDragEnd={(tabId, x, y) =>
              handleDragEnd(tabId, x, y, terminalAreaRef.current)
            }
            onRenameTab={renameTab}
          />
        )}
        {config.sidebarOpen && config.sidebarPlacement === "left" && (
          <ErrorBoundary name="Left Sidebar">
            <Sidebar
              onRunScript={handleRunScript}
              onInjectSnippet={handleInjectSnippet}
              onViewSession={(sessionId) =>
                setViewingHistorySessionId(sessionId)
              }
              activeTerminalId={activeTerminalId}
              onViewFile={(filePath) => setPreviewFilePath(filePath)}
              onLaunchConnection={(id) => newTab(undefined, id)}
              width={config.sidebarWidth || 250}
            />
          </ErrorBoundary>
        )}
        <div
          ref={terminalAreaRef}
          style={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
            borderTop:
              !config.tabBarPosition || config.tabBarPosition === "top"
                ? "1px solid var(--app-border)"
                : "none",
          }}
        >
          {tabs.map((tab) => {
            const isHibernated = hibernatedTabIds.includes(tab.id);
            return (
              <div
                key={tab.id}
                style={{
                  visibility: tab.id === activeTabId ? "visible" : "hidden",
                  position: tab.id === activeTabId ? "relative" : "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: tab.id === activeTabId ? 1 : 0,
                  display: "flex",
                  width: "100%",
                  height: "100%",
                }}
              >
                {!isHibernated && (
                  <ErrorBoundary name="Terminal SplitPane">
                    <SplitPane
                      node={tab.root}
                      path={[]}
                      focusedPath={tab.focusedPath}
                      isActive={tab.id === activeTabId}
                      leafCount={leafCount(tab.root)}
                      onExtract={
                        leafCount(tab.root) > 1
                          ? (path) => extractToTab(tab.id, path)
                          : undefined
                      }
                      onFocus={(path) => onFocusSplit(tab.id, path)}
                      onExit={(terminalId) => closeSplit(tab.id, terminalId)}
                      onResize={(path, newSizes) =>
                        onResize(tab.id, path, newSizes)
                      }
                      onContextMenuAction={(path, action) =>
                        handleContextMenuAction(tab.id, path, action)
                      }
                    />
                  </ErrorBoundary>
                )}
              </div>
            );
          })}
          <div
            id="drag-zone-right"
            style={{
              display: dragState?.zone === "right" ? "flex" : "none",
              position: "absolute",
              top: 0,
              right: 0,
              width: "20%",
              height: "100%",
              background:
                "color-mix(in srgb, var(--app-accent) 15%, transparent)",
              border: "2px dashed var(--app-accent)",
              zIndex: 100,
              pointerEvents: "none",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--app-fg)",
              fontSize: 13,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            split right
          </div>
          <div
            id="drag-zone-bottom"
            style={{
              display: dragState?.zone === "bottom" ? "flex" : "none",
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: "20%",
              background:
                "color-mix(in srgb, var(--app-accent) 15%, transparent)",
              border: "2px dashed var(--app-accent)",
              zIndex: 100,
              pointerEvents: "none",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--app-fg)",
              fontSize: 13,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            split down
          </div>
        </div>
        {config.sidebarOpen && config.sidebarPlacement === "right" && (
          <ErrorBoundary name="Right Sidebar">
            <Sidebar
              onRunScript={handleRunScript}
              onInjectSnippet={handleInjectSnippet}
              onViewSession={(sessionId) =>
                setViewingHistorySessionId(sessionId)
              }
              activeTerminalId={activeTerminalId}
              onViewFile={(filePath) => setPreviewFilePath(filePath)}
              onLaunchConnection={(id) => newTab(undefined, id)}
              width={config.sidebarWidth || 250}
            />
          </ErrorBoundary>
        )}
        {config.tabBarPosition === "right" && (
          <TabBar
            tabs={tabBarTabs}
            activeTabId={activeTabId}
            onSelect={selectTab}
            onClose={closeTab}
            onNew={newTab}
            onDragStart={handleDragStart}
            onDragMove={(x, y) => handleDragMove(x, y, terminalAreaRef.current)}
            onDragEnd={(tabId, x, y) =>
              handleDragEnd(tabId, x, y, terminalAreaRef.current)
            }
            onRenameTab={renameTab}
          />
        )}
      </div>
      <ModalManager />
      {toasts.length > 0 && (
        <div className="app-toast-container" id="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`app-toast app-toast-${toast.type}`}>
              <div className="app-toast-content">{toast.message}</div>
              <button
                className="app-toast-close"
                onClick={() => removeToast(toast.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </ThemeProvider>
  );
}

export default App;
