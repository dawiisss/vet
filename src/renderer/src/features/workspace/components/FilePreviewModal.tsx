import React, { useEffect, useState, useRef } from 'react'

interface FilePreviewModalProps {
  filePath: string
  onClose: () => void
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ filePath, onClose }) => {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    
    window.workspaceApi.readFileHead(filePath)
      .then((data) => {
        if (active) {
          setContent(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setContent(`Failed to read file: ${err}`)
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [filePath])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  useEffect(() => {
    if (!loading && contentRef.current) {
      contentRef.current.focus()
    }
  }, [loading])

  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement
    return () => {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const lines = content.split('\n')

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999
      }}
    >
      <div
        style={{
          width: '70%',
          maxWidth: 800,
          height: '75%',
          backgroundColor: 'color-mix(in srgb, var(--app-bg) 85%, transparent)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--app-fg)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--app-blue)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 }}>File Preview</div>
            <h2 style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--app-fg-subtle)'
            }}>
              {filePath}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--app-fg-subtle)',
              cursor: 'pointer',
              fontSize: 22,
              padding: 0,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              color: 'var(--app-fg-subtle)'
            }}>
              Loading preview content...
            </div>
          ) : (
            <div
              ref={contentRef}
              tabIndex={0}
              style={{
                width: '100%',
                height: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                display: 'flex',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: 12,
                lineHeight: '1.6',
                background: 'rgba(0, 0, 0, 0.15)',
                outline: 'none'
              }}
            >
              {/* Line Numbers Column */}
              <div style={{
                padding: '16px 12px',
                textAlign: 'right',
                color: '#585b70',
                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                userSelect: 'none',
                background: 'rgba(0,0,0,0.1)',
                minWidth: 35
              }}>
                {lines.map((_, index) => (
                  <div key={index}>{index + 1}</div>
                ))}
              </div>

              {/* Code Contents Column */}
              <pre style={{
                margin: 0,
                padding: '16px 16px',
                color: 'var(--app-fg)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                flex: 1
              }}>
                <code>
                  {content}
                </code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FilePreviewModal
