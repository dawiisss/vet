import React, { useEffect } from 'react'

export interface ContextMenuAction {
  id: string
  label: string
  shortcut?: string
  onExecute: () => void
  separator?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  isOpen: boolean
  onClose: () => void
  actions: ContextMenuAction[]
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, isOpen, onClose, actions }) => {
  useEffect(() => {
    if (isOpen) {
      const handleGlobalClick = () => onClose()
      window.addEventListener('click', handleGlobalClick)
      return () => window.removeEventListener('click', handleGlobalClick)
    }
    return
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: y,
        left: x,
        width: 220,
        backgroundColor: 'rgba(30, 30, 46, 0.95)',
        border: '1px solid #313244',
        borderRadius: 8,
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        padding: '6px 0',
        zIndex: 99999,
        backdropFilter: 'blur(12px)',
        color: '#cdd6f4',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((action, index) => (
        <React.Fragment key={action.id}>
          {action.separator && index !== 0 && (
            <div style={{ height: 1, background: '#313244', margin: '4px 0' }} />
          )}
          <div
            onClick={() => {
              action.onExecute()
              onClose()
            }}
            style={{
              padding: '6px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'background 0.1s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(203, 166, 247, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span>{action.label}</span>
            {action.shortcut && <span style={{ color: '#6c7086', fontSize: 11 }}>{action.shortcut}</span>}
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

export default ContextMenu
