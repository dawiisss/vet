import React, { useState, useEffect, useRef } from 'react'

export interface CommandAction {
  id: string
  label: string
  onExecute: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  actions: CommandAction[]
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, actions }) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredActions = actions.filter(action => 
    action.label.toLowerCase().includes(query.toLowerCase())
  )

  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    } else {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
    }
  }, [isOpen])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (!isOpen) return null

  const executeSelected = () => {
    if (filteredActions.length > 0) {
      filteredActions[selectedIndex].onExecute()
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      e.stopPropagation()
    } else if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => Math.min(prev + 1, filteredActions.length - 1))
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => Math.max(prev - 1, 0))
      e.preventDefault()
    } else if (e.key === 'Enter') {
      executeSelected()
      e.preventDefault()
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        zIndex: 10000
      }}
    >
      <div
        style={{
          width: 600,
          backgroundColor: 'rgba(30, 30, 46, 0.95)',
          border: '1px solid #313244',
          borderRadius: 8,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backdropFilter: 'blur(12px)',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a command..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #313244',
            color: '#cdd6f4',
            padding: '16px 20px',
            fontSize: 16,
            outline: 'none',
            width: '100%'
          }}
        />
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {filteredActions.map((action, index) => (
            <div
              key={action.id}
              onClick={() => {
                action.onExecute()
                onClose()
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                padding: '12px 20px',
                color: index === selectedIndex ? '#cdd6f4' : '#a6adc8',
                background: index === selectedIndex ? 'rgba(203, 166, 247, 0.15)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderLeft: index === selectedIndex ? '3px solid #cba6f7' : '3px solid transparent'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              {action.label}
            </div>
          ))}
          {filteredActions.length === 0 && (
            <div style={{ padding: '20px', color: '#6c7086', textAlign: 'center' }}>
              No commands found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
