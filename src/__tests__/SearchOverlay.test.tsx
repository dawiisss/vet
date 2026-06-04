/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { setupMockedApis, resetMockedApis } from '../__tests__/rendererHelpers'
import SearchOverlay from '../renderer/src/shared/components/SearchOverlay'

setupMockedApis()

describe('SearchOverlay', () => {
  const onSearch = jest.fn()
  const onClose = jest.fn()

  beforeEach(() => {
    resetMockedApis()
    onSearch.mockClear()
    onClose.mockClear()
  })

  it('renders search input', () => {
    render(<SearchOverlay onSearch={onSearch} onClose={onClose} />)
    expect(screen.getByPlaceholderText('Find...')).toBeInTheDocument()
  })

  it('calls onSearch when text changes', () => {
    render(<SearchOverlay onSearch={onSearch} onClose={onClose} />)
    const input = screen.getByPlaceholderText('Find...')
    fireEvent.change(input, { target: { value: 'test' } })
    expect(onSearch).toHaveBeenCalledWith('test', expect.objectContaining({
      caseSensitive: false,
      useRegex: false,
      wholeWord: false,
    }))
  })

  it('toggles case sensitivity', () => {
    render(<SearchOverlay onSearch={onSearch} onClose={onClose} />)
    const caseBtn = screen.getByTitle('Match Case')
    fireEvent.click(caseBtn)
    expect(onSearch).toHaveBeenCalledWith('', expect.objectContaining({ caseSensitive: true }))
  })

  it('toggles regex', () => {
    render(<SearchOverlay onSearch={onSearch} onClose={onClose} />)
    const regexBtn = screen.getByTitle('Use Regular Expression')
    fireEvent.click(regexBtn)
    expect(onSearch).toHaveBeenCalledWith('', expect.objectContaining({ useRegex: true }))
  })

  it('toggles whole word', () => {
    render(<SearchOverlay onSearch={onSearch} onClose={onClose} />)
    const wordBtn = screen.getByTitle('Match Whole Word')
    fireEvent.click(wordBtn)
    expect(onSearch).toHaveBeenCalledWith('', expect.objectContaining({ wholeWord: true }))
  })

  it('calls onClose on Escape', () => {
    render(<SearchOverlay onSearch={onSearch} onClose={onClose} />)
    const input = screen.getByPlaceholderText('Find...')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onSearch with backwards on Shift+Enter', () => {
    render(<SearchOverlay onSearch={onSearch} onClose={onClose} />)
    const input = screen.getByPlaceholderText('Find...')
    fireEvent.change(input, { target: { value: 'search' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onSearch).toHaveBeenCalledWith('search', expect.objectContaining({ backwards: true }))
  })

  it('closes when close button clicked', () => {
    render(<SearchOverlay onSearch={onSearch} onClose={onClose} />)
    const closeBtn = screen.getByTitle('Close (Escape)')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })
})
