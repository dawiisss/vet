/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// We need to mock the store BEFORE importing the component
const mockUseClipboardStore = jest.fn()
jest.mock('../renderer/src/features/clipboard/useClipboardStore', () => ({
  useClipboardStore: mockUseClipboardStore
}))

import ClipboardHistoryPanel from '../renderer/src/shared/components/ClipboardHistoryPanel'

describe('ClipboardHistoryPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly when history is empty', () => {
    mockUseClipboardStore.mockReturnValue({
      history: [],
      remove: jest.fn(),
      clear: jest.fn()
    })

    render(<ClipboardHistoryPanel isActive={true} onInjectSnippet={jest.fn()} />)

    expect(screen.getByText('Clipboard')).toBeInTheDocument()
    expect(screen.getByText('No clipboard history yet.')).toBeInTheDocument()
    expect(screen.queryByText('Clear All')).not.toBeInTheDocument()
  })

  it('renders history items and allows clearing them', async () => {
    const mockClear = jest.fn()
    mockUseClipboardStore.mockReturnValue({
      history: [
        { id: '1', text: 'npm run test', timestamp: 1680000000000 },
        { id: '2', text: 'git status', timestamp: 1680000001000 }
      ],
      remove: jest.fn(),
      clear: mockClear
    })

    render(<ClipboardHistoryPanel isActive={true} onInjectSnippet={jest.fn()} />)

    expect(screen.getByText('npm run test')).toBeInTheDocument()
    expect(screen.getByText('git status')).toBeInTheDocument()

    const clearButton = screen.getByText('Clear All')
    expect(clearButton).toBeInTheDocument()

    await userEvent.click(clearButton)
    expect(mockClear).toHaveBeenCalledTimes(1)
  })

  it('calls onInjectSnippet when paste is clicked', async () => {
    const mockOnInjectSnippet = jest.fn()
    mockUseClipboardStore.mockReturnValue({
      history: [
        { id: '1', text: 'sudo rm -rf /', timestamp: 1680000000000 }
      ],
      remove: jest.fn(),
      clear: jest.fn()
    })

    render(<ClipboardHistoryPanel isActive={true} onInjectSnippet={mockOnInjectSnippet} />)

    const pasteButton = screen.getByText('Paste')
    await userEvent.click(pasteButton)

    expect(mockOnInjectSnippet).toHaveBeenCalledWith('sudo rm -rf /')
  })

  it('calls remove when the delete button is clicked', async () => {
    const mockRemove = jest.fn()
    mockUseClipboardStore.mockReturnValue({
      history: [
        { id: 'item-123', text: 'echo "hello"', timestamp: 1680000000000 }
      ],
      remove: mockRemove,
      clear: jest.fn()
    })

    render(<ClipboardHistoryPanel isActive={true} onInjectSnippet={jest.fn()} />)

    // The button has "×"
    const removeButton = screen.getByText('×')
    await userEvent.click(removeButton)

    expect(mockRemove).toHaveBeenCalledWith('item-123')
  })
})
