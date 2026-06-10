/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// We need to mock the stores BEFORE importing the component
const mockUseClipboardStore = jest.fn()
jest.mock('../renderer/src/features/clipboard/useClipboardStore', () => ({
  useClipboardStore: mockUseClipboardStore
}))

const mockSetPreviewClipboardItem = jest.fn()
const mockUseTabStore = jest.fn((selector) => {
  if (selector) {
    return selector({ setPreviewClipboardItem: mockSetPreviewClipboardItem })
  }
  return { setPreviewClipboardItem: mockSetPreviewClipboardItem }
})
jest.mock('../renderer/src/features/terminal/useTabStore', () => ({
  useTabStore: mockUseTabStore
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
    expect(screen.getByText('Clipboard is empty')).toBeInTheDocument()
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

  it('calls setPreviewClipboardItem when Preview is clicked', async () => {
    mockUseClipboardStore.mockReturnValue({
      history: [
        { id: '1', text: 'line one\nline two\nline three', timestamp: 1680000000000 }
      ],
      remove: jest.fn(),
      clear: jest.fn()
    })

    render(<ClipboardHistoryPanel isActive={true} onInjectSnippet={jest.fn()} />)

    const previewButton = screen.getByText('Preview')
    await userEvent.click(previewButton)

    expect(mockSetPreviewClipboardItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', text: 'line one\nline two\nline three' })
    )
  })

  it('navigates with keyboard arrow keys', () => {
    mockUseClipboardStore.mockReturnValue({
      history: [
        { id: '1', text: 'first', timestamp: 1680000000000 },
        { id: '2', text: 'second', timestamp: 1680000001000 },
        { id: '3', text: 'third', timestamp: 1680000002000 }
      ],
      remove: jest.fn(),
      clear: jest.fn()
    })

    render(<ClipboardHistoryPanel isActive={true} onInjectSnippet={jest.fn()} />)

    const container = screen.getByText('Clipboard').parentElement?.parentElement as HTMLElement

    // Starts at index 0
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    fireEvent.keyDown(container, { key: 'ArrowDown' })

    // Enter should open preview for item at index 2
    fireEvent.keyDown(container, { key: 'Enter' })

    expect(mockSetPreviewClipboardItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: '3', text: 'third' })
    )
  })

  it('copies selected item text with Ctrl+C', () => {
    const mockWriteText = jest.fn(() => Promise.resolve())
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText
      }
    })

    mockUseClipboardStore.mockReturnValue({
      history: [
        { id: '1', text: 'first item text', timestamp: 1680000000000 },
        { id: '2', text: 'second item text', timestamp: 1680000001000 }
      ],
      remove: jest.fn(),
      clear: jest.fn()
    })

    render(<ClipboardHistoryPanel isActive={true} onInjectSnippet={jest.fn()} />)

    const container = screen.getByText('Clipboard').parentElement?.parentElement as HTMLElement

    // Move to second item
    fireEvent.keyDown(container, { key: 'ArrowDown' })

    // Copy with Ctrl+C
    fireEvent.keyDown(container, { key: 'c', ctrlKey: true })

    expect(mockWriteText).toHaveBeenCalledWith('second item text')
  })

  it('copies selected item text with Ctrl+Shift+C', () => {
    const mockWriteText = jest.fn(() => Promise.resolve())
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText
      }
    })

    mockUseClipboardStore.mockReturnValue({
      history: [
        { id: '1', text: 'first item text', timestamp: 1680000000000 },
        { id: '2', text: 'second item text', timestamp: 1680000001000 }
      ],
      remove: jest.fn(),
      clear: jest.fn()
    })

    render(<ClipboardHistoryPanel isActive={true} onInjectSnippet={jest.fn()} />)

    const container = screen.getByText('Clipboard').parentElement?.parentElement as HTMLElement

    // Copy with Ctrl+Shift+C on first item (default index 0)
    fireEvent.keyDown(container, { key: 'C', ctrlKey: true, shiftKey: true })

    expect(mockWriteText).toHaveBeenCalledWith('first item text')
  })
})
