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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
