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
useTabStore.subscribe((state) => {
  if (window.terminalApi && state.tabs.length > 0 && !state.isDetached) {
    const sessionData = {
      tabs: state.tabs,
      activeTabId: state.activeTabId,
    };
    window.terminalApi.saveSession(sessionData);
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
