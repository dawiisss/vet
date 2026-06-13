import React, { useState, useEffect } from 'react'
import { useConfig } from '@/features/settings/useConfigStore'
import { buildShortcutString } from '@/shared/utils/keybindings'

const AVAILABLE_ACTIONS = [
  { id: 'tab:new', label: 'New Tab' },
  { id: 'tab:close', label: 'Close Tab' },
  { id: 'tab:next', label: 'Next Tab' },
  { id: 'tab:prev', label: 'Previous Tab' },
  { id: 'split:extract', label: 'Extract Split' },
  { id: 'split:horizontal', label: 'Split Horizontal' },
  { id: 'split:vertical', label: 'Split Vertical' },
  { id: 'pane:focus-next', label: 'Focus Next Pane' },
  { id: 'pane:focus-prev', label: 'Focus Previous Pane' },
  { id: 'terminal:copy', label: 'Copy to Clipboard' },
  { id: 'terminal:paste', label: 'Paste from Clipboard' },
  { id: 'terminal:search', label: 'Find / Search' },
  { id: 'sidebar:toggle', label: 'Toggle Sidebar' },
  { id: 'settings:toggle', label: 'Open Settings' },
  { id: 'command-palette:toggle', label: 'Open Command Palette' },
  { id: 'tabbar:toggle-position', label: 'Toggle Tab Bar Position (Top/Left/Right)' },
  { id: 'split:unsplit', label: 'Unsplit Tabs' },
  { id: 'app:toggle-fullscreen', label: 'Toggle Fullscreen' },
  { id: 'app:maximize', label: 'Maximize Window' },
  { id: 'app:quit', label: 'App: Exit' }
]

export const KeybindingsManager: React.FC = () => {
  const { config, updateConfig } = useConfig()
  const [recordingAction, setRecordingAction] = useState<string | null>(null)

  const currentKeybindings = config.keybindings || {}

  // Invert the map: action -> shortcut
  const actionToShortcut: Record<string, string> = {}
  for (const [key, action] of Object.entries(currentKeybindings)) {
    actionToShortcut[action] = key
  }

  useEffect(() => {
    if (!recordingAction) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setRecordingAction(null)
        return
      }

      const shortcut = buildShortcutString(e)
      if (!shortcut) {
        return // Wait for next key
      }

      // Update config
      const newKeybindings = { ...currentKeybindings }
      
      // Remove any existing binding for this action
      const oldShortcut = actionToShortcut[recordingAction]
      if (oldShortcut) {
        delete newKeybindings[oldShortcut]
      }
      
      // Remove any existing action bound to this shortcut (override)
      if (newKeybindings[shortcut] && newKeybindings[shortcut] !== recordingAction) {
        // Maybe warn user? But auto-override is simple.
      }
      
      newKeybindings[shortcut] = recordingAction
      
      updateConfig({ keybindings: newKeybindings })
      setRecordingAction(null)
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [recordingAction, currentKeybindings, updateConfig, actionToShortcut])

  const unbindAction = (actionId: string) => {
    const shortcut = actionToShortcut[actionId]
    if (shortcut) {
      const newKeybindings = { ...currentKeybindings }
      delete newKeybindings[shortcut]
      updateConfig({ keybindings: newKeybindings })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 350, overflowY: 'auto', paddingRight: 8, position: 'relative' }}>
      
      {recordingAction && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'color-mix(in srgb, var(--app-bg) 90%, transparent)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          gap: 16
        }}>
          <h3 style={{ margin: 0, color: 'var(--app-fg)' }}>Recording Keybinding</h3>
          <p style={{ margin: 0, color: '#bac2de', fontSize: 13 }}>
            Press the new key combination for <strong>{AVAILABLE_ACTIONS.find(a => a.id === recordingAction)?.label}</strong>.
          </p>
          <p style={{ margin: 0, color: 'var(--app-red)', fontSize: 12 }}>Press ESC to cancel.</p>
        </div>
      )}

      {AVAILABLE_ACTIONS.map(action => {
        const shortcut = actionToShortcut[action.id]

        return (
          <div key={action.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 8
          }}>
            <span style={{ color: 'var(--app-fg)', fontSize: 14 }}>{action.label}</span>
            
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {shortcut ? (
                <div style={{ 
                  background: 'rgba(255,255,255,0.1)', 
                  padding: '4px 8px', 
                  borderRadius: 4, 
                  fontFamily: 'monospace',
                  color: 'var(--app-blue)',
                  fontSize: 12,
                  textTransform: 'uppercase'
                }}>
                  {shortcut.replace(/\+/g, ' + ')}
                </div>
              ) : (
                <span style={{ color: 'var(--app-fg-muted)', fontSize: 12, fontStyle: 'italic' }}>Unbound</span>
              )}
              
              <button
                onClick={() => setRecordingAction(action.id)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: 4,
                  color: 'var(--app-fg)',
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                Record
              </button>
              
              {shortcut && (
                <button
                  onClick={() => unbindAction(action.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--app-red)',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: 4
                  }}
                  title="Unbind"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
