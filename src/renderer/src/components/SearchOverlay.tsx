import React, { useState, useRef, useEffect } from 'react'

interface SearchOverlayProps {
  onSearch: (text: string, options: { caseSensitive: boolean; useRegex: boolean; wholeWord: boolean; backwards?: boolean }) => void
  onClose: () => void
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ onSearch, onClose }) => {
  const [searchText, setSearchText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      e.stopPropagation()
    } else if (e.key === 'Enter') {
      const backwards = e.shiftKey
      onSearch(searchText, { caseSensitive, useRegex, wholeWord, backwards })
      e.stopPropagation()
    }
  }

  const triggerSearch = (backwards = false) => {
    onSearch(searchText, { caseSensitive, useRegex, wholeWord, backwards })
  }

  const btnStyle = (active: boolean) => ({
    background: active ? 'rgba(203, 166, 247, 0.2)' : 'transparent',
    color: active ? '#cba6f7' : '#a6adc8',
    border: 'none',
    padding: '4px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s'
  })

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        background: 'rgba(30, 30, 46, 0.95)',
        border: '1px solid #313244',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        padding: '6px 8px',
        gap: 8,
        zIndex: 100,
        backdropFilter: 'blur(8px)',
        color: '#cdd6f4',
        fontFamily: 'system-ui, sans-serif'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Find..."
        value={searchText}
        onChange={(e) => {
          setSearchText(e.target.value)
          onSearch(e.target.value, { caseSensitive, useRegex, wholeWord, backwards: false })
        }}
        onKeyDown={handleKeyDown}
        style={{
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid #313244',
          color: '#cdd6f4',
          padding: '4px 8px',
          borderRadius: 4,
          outline: 'none',
          width: 180,
          fontSize: 13
        }}
      />
      
      <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.2)', borderRadius: 4, padding: 2 }}>
        <button 
          title="Match Case"
          style={btnStyle(caseSensitive)} 
          onClick={() => {
            setCaseSensitive(!caseSensitive)
            onSearch(searchText, { caseSensitive: !caseSensitive, useRegex, wholeWord })
          }}
        >
          Aa
        </button>
        <button 
          title="Match Whole Word"
          style={btnStyle(wholeWord)} 
          onClick={() => {
            setWholeWord(!wholeWord)
            onSearch(searchText, { caseSensitive, useRegex, wholeWord: !wholeWord })
          }}
        >
          _
        </button>
        <button 
          title="Use Regular Expression"
          style={btnStyle(useRegex)} 
          onClick={() => {
            setUseRegex(!useRegex)
            onSearch(searchText, { caseSensitive, useRegex: !useRegex, wholeWord })
          }}
        >
          .*
        </button>
      </div>

      <div style={{ width: 1, height: 16, background: '#313244', margin: '0 4px' }} />

      <div style={{ display: 'flex', gap: 2 }}>
        <button title="Previous Match (Shift+Enter)" style={btnStyle(false)} onClick={() => triggerSearch(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        <button title="Next Match (Enter)" style={btnStyle(false)} onClick={() => triggerSearch(false)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      <button title="Close (Escape)" style={{ ...btnStyle(false), marginLeft: 4 }} onClick={onClose}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  )
}

export default SearchOverlay
