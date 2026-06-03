import { useEffect, useState, useRef } from 'react'
import { useConfig } from '../ConfigContext'

interface WorkspaceItem {
  name: string
  isDirectory: boolean
  size: number
  ext: string
}

export default function WorkspacePanel({
  isActive,
  activeTerminalId,
  onViewFile
}: {
  isActive: boolean
  activeTerminalId: string | null
  onViewFile: (filePath: string) => void
}) {
  const { config } = useConfig()
  const [cwd, setCwd] = useState<string | null>(null)
  const [items, setItems] = useState<WorkspaceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [keyboardIndex, setKeyboardIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const activeTerminalIdRef = useRef(activeTerminalId)
  activeTerminalIdRef.current = activeTerminalId

  // Fetch CWD from terminal periodically
  useEffect(() => {
    if (!isActive || !activeTerminalId) {
      setItems([])
      setCwd(null)
      return
    }

    const checkCwd = async () => {
      if (!activeTerminalIdRef.current) return
      try {
        const info = await window.terminalApi.getTerminalInfo(activeTerminalIdRef.current)
        if (info.cwd && info.cwd !== cwd) {
          setCwd(info.cwd)
        }
      } catch (err) {
        console.error('Error fetching terminal info', err)
      }
    }

    checkCwd()
    const intv = setInterval(checkCwd, 1500)
    return () => clearInterval(intv)
  }, [isActive, activeTerminalId, cwd])

  // Load files when CWD changes
  useEffect(() => {
    if (!cwd) return

    const loadDir = async () => {
      setLoading(true)
      try {
        const res = await window.workspaceApi.listDir(cwd)
        setItems(res)
        setKeyboardIndex(0) // Reset keyboard selection to the top of list
      } catch (err) {
        console.error('Error loading directory files', err)
      } finally {
        setLoading(false)
      }
    }

    loadDir()
  }, [cwd])

  // Focus container when tab changes or sidebar opens
  useEffect(() => {
    if (isActive && config.sidebarOpen && containerRef.current) {
      containerRef.current.focus()
      setKeyboardIndex(0)
    }
  }, [isActive, config.sidebarOpen])

  // Scroll active list item into view if not visible
  useEffect(() => {
    if (keyboardIndex >= 0 && containerRef.current) {
      const activeEl = containerRef.current.querySelector('[data-active="true"]')
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [keyboardIndex])

  const handleFolderDoubleClick = (folderName: string) => {
    if (!activeTerminalId || !cwd) return
    const pathDelimiter = cwd === '/' ? '' : '/'
    const newPath = `${cwd}${pathDelimiter}${folderName}`
    
    window.terminalApi.write(activeTerminalId, `cd "${newPath}"\r`)
    setCwd(newPath)
  }

  const handleGoUp = () => {
    if (!activeTerminalId || !cwd || cwd === '/') return
    
    const parts = cwd.split('/')
    parts.pop()
    const parentPath = parts.join('/') || '/'
    
    window.terminalApi.write(activeTerminalId, `cd "${parentPath}"\r`)
    setCwd(parentPath)
  }

  const getFileIcon = (item: WorkspaceItem) => {
    if (item.isDirectory) return '📁'
    
    const ext = item.ext.toLowerCase()
    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return '🟨'
    if (['.css', '.scss', '.less'].includes(ext)) return '🟦'
    if (['.json', '.json5', '.yaml', '.yml'].includes(ext)) return '⚙️'
    if (['.html', '.xml', '.svg'].includes(ext)) return '🌐'
    if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp'].includes(ext)) return '🖼️'
    if (['.md', '.txt', '.log', '.conf'].includes(ext)) return '📝'
    if (['.sh', '.bash', '.zsh', '.py', '.go', '.rs'].includes(ext)) return '🐚'
    return '📄'
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return ''
    if (bytes < 1024) return `${bytes} B`
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    const mb = kb / 1024
    return `${mb.toFixed(1)} MB`
  }

  const handleDragStart = (e: React.DragEvent, itemName: string) => {
    if (!cwd) return
    const fullPath = cwd === '/' ? `/${itemName}` : `${cwd}/${itemName}`
    e.dataTransfer.setData('text/plain', fullPath)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleReveal = async (itemName: string) => {
    if (!cwd) return
    const fullPath = cwd === '/' ? `/${itemName}` : `${cwd}/${itemName}`
    await window.workspaceApi.revealPath(fullPath)
  }

  const handleCopyPath = (itemName: string) => {
    if (!cwd) return
    const fullPath = cwd === '/' ? `/${itemName}` : `${cwd}/${itemName}`
    navigator.clipboard.writeText(fullPath).catch(() => {})
  }

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean
    x: number
    y: number
    itemName: string
  } | null>(null)

  const handleContextMenu = (e: React.MouseEvent, itemName: string) => {
    e.preventDefault()
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      itemName
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const navItems: Array<{ name: string; isDirectory: boolean; isParent?: boolean }> = []
    if (cwd && cwd !== '/') {
      navItems.push({ name: '..', isDirectory: true, isParent: true })
    }
    navItems.push(...items)

    if (navItems.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setKeyboardIndex((prev) => Math.min(prev + 1, navItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setKeyboardIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = navItems[keyboardIndex]
      if (!target) return

      if (target.isDirectory) {
        if ('isParent' in target || target.isParent) {
          handleGoUp()
        } else {
          handleFolderDoubleClick(target.name)
        }
      } else {
        const fullPath = cwd === '/' ? `/${target.name}` : `${cwd}/${target.name}`
        onViewFile(fullPath)
      }
    }
  }

  const getNavIndex = (itemIndex: number) => {
    return cwd && cwd !== '/' ? itemIndex + 1 : itemIndex
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        outline: 'none',
        padding: 12,
        color: '#cdd6f4',
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#bac2de' }}>Workspace</h3>
        <button
          onClick={() => {
            if (cwd) {
              setLoading(true)
              window.workspaceApi.listDir(cwd).then(setItems).finally(() => setLoading(false))
            }
          }}
          style={{ background: 'none', border: 'none', color: '#89b4fa', cursor: 'pointer', fontSize: 12 }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {!activeTerminalId ? (
        <div style={{ color: '#6c7086', fontStyle: 'italic' }}>Open a terminal tab to view files</div>
      ) : (
        <>
          {/* CWD Path display */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '8px 10px',
            borderRadius: 6,
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontFamily: 'monospace',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            overflow: 'hidden'
          }}>
            <span style={{ color: '#89b4fa', flexShrink: 0 }}>cwd:</span>
            <span
              style={{
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                direction: 'rtl',
                textAlign: 'left',
                width: '100%'
              }}
              title={cwd || ''}
            >
              {cwd || '/'}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {cwd && cwd !== '/' && (
              <div
                onClick={handleGoUp}
                onMouseEnter={() => setKeyboardIndex(0)}
                data-active={keyboardIndex === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  transition: 'background 0.2s',
                  color: '#f9e2af',
                  fontWeight: 600,
                  background: keyboardIndex === 0 ? 'rgba(137, 180, 250, 0.2)' : 'transparent',
                  borderLeft: keyboardIndex === 0 ? '2px solid #89b4fa' : '2px solid transparent'
                }}
              >
                <span style={{ marginRight: 8 }}>📁</span>
                <span>.. (Go Up)</span>
              </div>
            )}

            {items.length === 0 && !loading && (
              <div style={{ color: '#6c7086', padding: '10px 8px', fontStyle: 'italic' }}>
                Empty directory
              </div>
            )}

            {items.map((item, index) => {
              const navIdx = getNavIndex(index)
              const isSel = keyboardIndex === navIdx
              return (
                <div
                  key={item.name}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.name)}
                  onDoubleClick={() => item.isDirectory ? handleFolderDoubleClick(item.name) : onViewFile(cwd === '/' ? `/${item.name}` : `${cwd}/${item.name}`)}
                  onClick={() => !item.isDirectory && onViewFile(cwd === '/' ? `/${item.name}` : `${cwd}/${item.name}`)}
                  onContextMenu={(e) => handleContextMenu(e, item.name)}
                  onMouseEnter={() => setKeyboardIndex(navIdx)}
                  data-active={isSel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    borderRadius: 4,
                    transition: 'background 0.2s',
                    userSelect: 'none',
                    background: isSel ? 'rgba(137, 180, 250, 0.2)' : 'transparent',
                    borderLeft: isSel ? '2px solid #89b4fa' : '2px solid transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    <span style={{ marginRight: 8, fontSize: 14 }}>{getFileIcon(item)}</span>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: item.isDirectory ? '#89b4fa' : '#cdd6f4'
                    }}>
                      {item.name}
                    </span>
                  </div>
                  {!item.isDirectory && (
                    <span style={{ fontSize: 10, color: '#6c7086', flexShrink: 0, marginLeft: 8 }}>
                      {formatSize(item.size)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Glassmorphic Context Menu */}
      {contextMenu?.isOpen && (
        <>
          <div
            onClick={() => setContextMenu(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
          />
          <div style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'rgba(30, 30, 46, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 6,
            padding: '4px 0',
            minWidth: 150,
            zIndex: 10000,
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
            color: '#cdd6f4'
          }}>
            <div
              onClick={() => {
                handleReveal(contextMenu.itemName)
                setContextMenu(null)
              }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, transition: 'background 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Reveal in File Manager
            </div>
            <div
              onClick={() => {
                handleCopyPath(contextMenu.itemName)
                setContextMenu(null)
              }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, transition: 'background 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Copy Absolute Path
            </div>
          </div>
        </>
      )}
    </div>
  )
}
