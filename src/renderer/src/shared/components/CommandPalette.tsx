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
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredActions = actions.filter(action => 
    action.label.toLowerCase().includes(query.toLowerCase())
  )

  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

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
      ref={containerRef}
      onClick={handleOverlayClick}
      onKeyDownCapture={(e) => {
        if (e.key === 'Tab' && containerRef.current) {
          const focusableElements = Array.from(
            containerRef.current.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null)

          if (focusableElements.length > 0) {
            const firstElement = focusableElements[0]
            const lastElement = focusableElements[focusableElements.length - 1]

            if (e.shiftKey) {
              if (document.activeElement === firstElement || document.activeElement === containerRef.current) {
                e.preventDefault()
                lastElement.focus()
              }
            } else {
              if (document.activeElement === lastElement) {
                e.preventDefault()
                firstElement.focus()
              }
            }
          }
        }
      }}
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
          backgroundColor: 'color-mix(in srgb, var(--app-bg) 95%, transparent)',
          border: '1px solid var(--app-border)',
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
            borderBottom: '1px solid var(--app-border)',
            color: 'var(--app-fg)',
            padding: '16px 20px',
            fontSize: 16,
            outline: 'none',
            width: '100%'
          }}
        />
        <div ref={listRef} className="no-scrollbar" style={{ maxHeight: 300, overflowY: 'auto' }}>
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
                color: index === selectedIndex ? 'var(--app-fg)' : 'var(--app-fg-subtle)',
                background: index === selectedIndex ? 'color-mix(in srgb, var(--app-accent) 15%, transparent)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderLeft: index === selectedIndex ? '3px solid var(--app-accent)' : '3px solid transparent'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              {action.label}
            </div>
          ))}
          {filteredActions.length === 0 && (
            <div style={{ padding: '20px', color: 'var(--app-fg-muted)', textAlign: 'center' }}>
              No commands found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
