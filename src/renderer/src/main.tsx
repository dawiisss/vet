import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { useConfigStore } from "./features/settings/useConfigStore";
import { useClipboardStore } from "./features/clipboard/useClipboardStore";
import "./styles/global.css";

// Initialize the global configuration store on startup
useConfigStore.getState().initialize();
// Initialize clipboard history from disk
useClipboardStore.getState().initialize();

import { useTabStore } from "./features/terminal/useTabStore";

// Subscribe to tab store changes and save session
useTabStore.subscribe((state, previous) => {
  if (!window.terminalApi || !state.tabsReady || state.isDetached) return;
  if (previous.tabsReady && state.tabs === previous.tabs && state.activeTabId === previous.activeTabId) return;
  void window.terminalApi.saveSession({ tabs: state.tabs, activeTabId: state.activeTabId })
    .catch((error: unknown) => console.error("Could not send workspace snapshot:", error));
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
