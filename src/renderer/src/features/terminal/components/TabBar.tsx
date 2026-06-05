import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from '@/features/settings/useConfigStore'
import ContextMenu, { ContextMenuAction } from '@/shared/components/ContextMenu'

interface TabBarTab {
  id: string
  label: string
}

interface TabBarProps {
  tabs: TabBarTab[]
  activeTabId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: (profileId?: string) => void
  onDragStart?: (tabId: string) => void
  onDragMove?: (x: number, y: number) => void
  onDragEnd?: (tabId: string, x: number, y: number) => void
  onRenameTab?: (id: string, newLabel: string) => void
  onDoubleClickTab?: (id: string) => void
}

function TabBar({ tabs, activeTabId, onSelect, onClose, onNew, onDragStart, onDragMove, onDragEnd, onRenameTab, onDoubleClickTab }: TabBarProps) {
  const { config, updateConfig } = useConfig()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState<string>('')
  const barRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    tabId: string
    startX: number
    startY: number
    dragging: boolean
    ghost: HTMLDivElement
  } | null>(null)

  const [contextMenuState, setContextMenuState] = useState<{ isOpen: boolean; x: number; y: number }>({ isOpen: false, x: 0, y: 0 })

  const isVertical = config.tabBarPosition === 'left' || config.tabBarPosition === 'right'

  // Stable refs for callbacks so useEffect never re-runs during drag
  const onDragStartRef = useRef(onDragStart)
  const onDragMoveRef = useRef(onDragMove)
  const onDragEndRef = useRef(onDragEnd)
  onDragStartRef.current = onDragStart
  onDragMoveRef.current = onDragMove
  onDragEndRef.current = onDragEnd

  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const handleTabMouseDown = useCallback(
    (tabId: string) => (e: React.MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('[data-close]')) return

      const ghost = document.createElement('div')
      ghost.textContent = tabsRef.current.find((t) => t.id === tabId)?.label ?? 'shell'
      ghost.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        background: #1e1e2e;
        color: #cdd6f4;
        padding: 4px 16px;
        border: 1px solid #cba6f7;
        border-radius: 4px;
        font-size: 13px;
        font-family: system-ui, sans-serif;
        white-space: nowrap;
        opacity: 0;
      `
      ghost.style.left = `${e.clientX + 10}px`
      ghost.style.top = `${e.clientY + 10}px`
      document.body.appendChild(ghost)

      dragRef.current = {
        tabId,
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        ghost
      }
    },
    []
  )

  // Stable effect — runs once on mount/unmount, uses refs for callbacks
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return

      if (!drag.dragging && (Math.abs(e.clientX - drag.startX) > 5 || Math.abs(e.clientY - drag.startY) > 5)) {
        drag.dragging = true
        drag.ghost.style.opacity = '0.85'
        onDragStartRef.current?.(drag.tabId)
      }

      if (drag.dragging) {
        drag.ghost.style.left = `${e.clientX + 10}px`
        drag.ghost.style.top = `${e.clientY + 10}px`
        onDragMoveRef.current?.(e.clientX, e.clientY)
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return

      drag.ghost.remove()

      if (drag.dragging && onDragEndRef.current) {
        onDragEndRef.current(drag.tabId, e.clientX, e.clientY)
      }

      setTimeout(() => {
        dragRef.current = null
      }, 0)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <>
    <div
      ref={barRef}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenuState({ isOpen: true, x: e.clientX, y: e.clientY })
      }}
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: isVertical ? 'stretch' : 'center',
        background: 'color-mix(in srgb, var(--app-bg) 75%, transparent)',
        userSelect: 'none',
        height: isVertical ? '100%' : 36,
        width: isVertical ? 200 : '100%',
        borderRight: config.tabBarPosition === 'left' ? '1px solid var(--app-border)' : 'none',
        borderLeft: config.tabBarPosition === 'right' ? '1px solid var(--app-border)' : 'none',
        overflow: 'visible',
        flexShrink: 0
      }}
    >
      <div style={{ 
        display: 'flex', 
        flexDirection: isVertical ? 'column' : 'row',
        flex: 1, 
        overflowX: 'hidden',
        overflowY: isVertical ? 'auto' : 'hidden'
      }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="tab-item"
            data-tabid={tab.id}
            onMouseDown={handleTabMouseDown(tab.id)}
            onDoubleClick={(e) => {
              if (e.target instanceof HTMLElement && e.target.closest('.tab-close-btn')) return
              if (onDoubleClickTab) {
                onDoubleClickTab(tab.id)
              } else {
                setEditingTabId(tab.id)
                setEditingLabel(tab.label)
              }
            }}
            onClick={(e) => {
              // Don't select if we were dragging
              if (!dragRef.current?.dragging) {
                onSelect(tab.id)
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              height: isVertical ? 36 : '100%',
              width: isVertical ? '100%' : 'auto',
              boxSizing: 'border-box',
              cursor: 'grab',
              background: tab.id === activeTabId ? 'var(--app-bg)' : 'transparent',
              borderRight: !isVertical ? '1px solid var(--app-border)' : 'none',
              borderBottom: isVertical ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
              borderTop: !isVertical && tab.id === activeTabId ? '2px solid var(--app-accent)' : '2px solid transparent',
              borderLeft: isVertical && tab.id === activeTabId ? '2px solid var(--app-accent)' : '2px solid transparent',
              color: tab.id === activeTabId ? 'var(--app-fg)' : 'var(--app-fg-muted)',
              fontSize: 13,
              fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flexShrink: 0,
              transition: 'background 0.1s'
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: isVertical ? 140 : 180,
                flex: 1
              }}
            >
              {editingTabId === tab.id ? (
                <input
                  type="text"
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onBlur={() => {
                    if (onRenameTab && editingLabel.trim()) onRenameTab(tab.id, editingLabel.trim())
                    setEditingTabId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (onRenameTab && editingLabel.trim()) onRenameTab(tab.id, editingLabel.trim())
                      setEditingTabId(null)
                    } else if (e.key === 'Escape') {
                      setEditingTabId(null)
                    }
                  }}
                  autoFocus
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid var(--app-accent)',
                    color: 'var(--app-fg)',
                    outline: 'none',
                    borderRadius: 4,
                    padding: '2px 4px',
                    width: 120,
                    fontSize: 13,
                    fontFamily: 'inherit'
                  }}
                />
              ) : (
                tab.label
              )}
            </span>
            <span
              className="tab-close-btn"
              data-close
              role="button"
              tabIndex={0}
              aria-label="Close tab"
              title="Close tab"
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  onClose(tab.id)
                }
              }}
              style={{
                marginLeft: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: 4,
                color: tab.id === activeTabId ? '#a6adc8' : '#6c7086',
                cursor: 'pointer'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: isVertical ? 36 : '100%',
          width: isVertical ? '100%' : 'auto',
          borderLeft: !isVertical ? '1px solid #313244' : 'none',
          borderTop: isVertical ? '1px solid #313244' : 'none',
          position: 'relative',
          flexShrink: 0
        }}
      >
        <div
          className="tab-new-btn"
          onClick={() => onNew()}
          role="button"
          tabIndex={0}
          aria-label="New Tab (Default Shell)"
          title="New Tab (Default Shell)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onNew()
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isVertical ? '50%' : 30,
            height: '100%',
            cursor: 'pointer',
            color: '#6c7086',
            fontSize: 18,
            transition: 'color 0.2s',
            borderRight: isVertical ? '1px solid rgba(49, 50, 68, 0.3)' : 'none'
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#cdd6f4' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#6c7086' }}
        >
          +
        </div>
        <div
          onClick={() => setIsDropdownOpen(prev => !prev)}
          role="button"
          tabIndex={0}
          aria-label="Choose Profile"
          title="Choose Profile"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setIsDropdownOpen(prev => !prev)
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isVertical ? '50%' : 18,
            height: '100%',
            cursor: 'pointer',
            color: '#6c7086',
            fontSize: 9,
            transition: 'color 0.2s',
            borderLeft: !isVertical ? '1px solid rgba(49, 50, 68, 0.3)' : 'none'
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#cdd6f4' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#6c7086' }}
        >
          ▼
        </div>

        {isDropdownOpen && (
          <>
            <div
              onClick={() => setIsDropdownOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: isVertical ? 36 : 'auto',
                top: !isVertical ? 36 : 'auto',
                right: 0,
                background: 'color-mix(in srgb, var(--app-bg) 95%, transparent)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--app-border)',
                borderRadius: 8,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                padding: '6px 0',
                minWidth: 180,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--app-fg-muted)', borderBottom: '1px solid var(--app-border)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                Launch Profile
              </div>
              {config.profiles?.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    onNew(profile.id)
                    setIsDropdownOpen(false)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--app-fg)',
                    padding: '8px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'system-ui, sans-serif',
                    transition: 'background 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-accent) 15%, transparent)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{profile.name}</span>
                  <span style={{ fontSize: 9, color: 'var(--app-fg-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile.shell} {profile.args?.join(' ')}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
    <ContextMenu
      isOpen={contextMenuState.isOpen}
      x={contextMenuState.x}
      y={contextMenuState.y}
      onClose={() => setContextMenuState(prev => ({ ...prev, isOpen: false }))}
      actions={[
        {
          id: 'layout-top',
          label: `${config.tabBarPosition === 'top' || !config.tabBarPosition ? '✓ ' : '    '}Position: Top`,
          onExecute: () => updateConfig({ tabBarPosition: 'top' })
        },
        {
          id: 'layout-left',
          label: `${config.tabBarPosition === 'left' ? '✓ ' : '    '}Position: Left`,
          onExecute: () => updateConfig({ tabBarPosition: 'left' })
        },
        {
          id: 'layout-right',
          label: `${config.tabBarPosition === 'right' ? '✓ ' : '    '}Position: Right`,
          onExecute: () => updateConfig({ tabBarPosition: 'right' })
        }
      ]}
    />
    </>
  )
}

export default TabBar
export type { TabBarTab }
