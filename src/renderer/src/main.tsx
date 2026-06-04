import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useConfigStore } from './features/settings/useConfigStore'
import './styles/global.css'

// Initialize the global configuration store on startup
useConfigStore.getState().initialize()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
