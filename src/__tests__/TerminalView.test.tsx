/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { jest } from '@jest/globals'
import userEvent from '@testing-library/user-event'
import { setupMockedApis, resetMockedApis } from './rendererHelpers'

global.ResizeObserver = class {
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
} as any

const mockContextLossHandlers: (() => void)[] = []
const mockDispose = jest.fn()

const mockFindNext = jest.fn()
const mockFindPrevious = jest.fn()
const mockLoadAddon = jest.fn()

class MockTerminal {
  options: any = {}
  element: any = document.createElement('div')
  onData = jest.fn()
  onResize = jest.fn()
  onScroll = jest.fn()
  loadAddon = mockLoadAddon
  write = jest.fn()
  clear = jest.fn()
  focus = jest.fn()
  dispose = jest.fn()
  open = jest.fn()
  getSelection = jest.fn()
  _keyHandler: any = null
  attachCustomKeyEventHandler = jest.fn((handler: any) => {
    this._keyHandler = handler
  })
  constructor() {
    const _global = globalThis as any;
    if (_global.__mockTerminalInstances) {
      _global.__mockTerminalInstances.push(this)
    } else {
      _global.__mockTerminalInstances = [this]
    }
  }
}

jest.mock('@xterm/xterm', () => {
  return { Terminal: MockTerminal }
})

jest.mock('@xterm/addon-search', () => ({
  SearchAddon: class {
    findNext = mockFindNext
    findPrevious = mockFindPrevious
  }
}))

class MockWebglAddon {
  onContextLoss(cb: () => void) {
    mockContextLossHandlers.push(cb)
  }
  dispose() {
    mockDispose()
  }
}

jest.mock('@xterm/addon-webgl', () => {
  return {
    WebglAddon: MockWebglAddon
  }
})

jest.mock('@xterm/addon-image', () => ({
  ImageAddon: class {
    dispose = jest.fn()
  }
}))

jest.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = jest.fn()
  }
}))

jest.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: class {}
}))

jest.mock('../renderer/src/shared/components/SearchOverlay', () => {
  return function MockSearchOverlay(props: any) {
    const _global = globalThis as any;
    _global.__mockSearchOverlayProps = props
    return (
      <div data-testid="search-overlay">
        <button data-testid="search-next-btn" onClick={() => props.onSearch('test', { caseSensitive: false, useRegex: false, wholeWord: false, backwards: false })}>Next</button>
        <button data-testid="search-prev-btn" onClick={() => props.onSearch('test', { caseSensitive: false, useRegex: false, wholeWord: false, backwards: true })}>Prev</button>
        <button data-testid="search-close-btn" onClick={props.onClose}>Close</button>
      </div>
    )
  }
})

jest.mock('../renderer/src/features/terminal/useTabStore', () => ({
  registerDestroyTerminalCache: jest.fn()
}))

// Replace useConfigStore completely so it returns static sync properties during tests
jest.mock('../renderer/src/features/settings/useConfigStore', () => {
  const config = {
      shell: '/bin/bash',
      fontFamily: 'monospace',
      fontSize: 14,
      opacity: 1.0,
      theme: 'catppuccin-mocha',
      cursorStyle: 'block',
      cursorBlink: true,
      keybindings: {
        'ctrl+f': 'terminal:search',
        'ctrl+c': 'terminal:copy',
        'ctrl+v': 'terminal:paste',
      },
      sidebarPlacement: 'right',
      sidebarOpen: true,
      profiles: [],
      historyLoggingEnabled: true,
      historyDatabaseLimitMb: 500,
      historyKeepDays: 30,
      virtualScrollbackEnabled: true,
      virtualScrollbackBufferSize: 1000,
      webglEnabled: true,
    }
  return {
    useConfigStore: {
      getState: () => config,
      setState: (v: any) => Object.assign(config, typeof v === 'function' ? v(config) : v)
    },
    useConfig: () => ({ config })
  }
})

import TerminalView from '../renderer/src/features/terminal/components/TerminalView'

describe('TerminalView', () => {
  beforeEach(() => {
    const _global = globalThis as any;
    _global.__mockTerminalInstances = []
    _global.__mockSearchOverlayProps = null
    mockContextLossHandlers.length = 0
    mockDispose.mockClear()
    mockFindNext.mockClear()
    mockFindPrevious.mockClear()
    mockLoadAddon.mockClear()
    setupMockedApis()
  })

  afterEach(() => {
    resetMockedApis()
    jest.clearAllMocks()
  })

  it('renders and handles context loss for webgl addon', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const { unmount } = render(
      <TerminalView terminalId="test-term-1" isActive={true} isFocused={true} />
    )

    // Wait for the component to initialize the WebglAddon and register the handler
    await waitFor(() => {
      expect(mockContextLossHandlers.length).toBeGreaterThan(0)
    })

    // Simulate real context loss via the registered component handler
    act(() => {
      mockContextLossHandlers[0]()
    })

    // Assert that the component called dispose on the webgl addon
    expect(mockDispose).toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
    unmount()
  })

  it('toggles search overlay and handles findNext/findPrevious via search functionality', async () => {
    const { unmount } = render(
      <TerminalView terminalId="test-term-2" isActive={true} isFocused={true} />
    )

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    const term = (globalThis as any).__mockTerminalInstances[0]
    expect(term._keyHandler).toBeDefined()

    // Simulate user pressing Ctrl+F using the attached custom key handler of the mock terminal.
    act(() => {
      term._keyHandler({
        type: 'keydown',
        key: 'f',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: () => {},
        stopPropagation: () => {}
      } as any)
    })

    // Wait for the component to render the SearchOverlay via its state change `isSearchOpen`
    const searchInput = await screen.findByTestId('search-overlay')
    expect(searchInput).toBeInTheDocument()

    // Click "Find Next"
    const nextBtn = screen.getByTestId('search-next-btn')
    fireEvent.click(nextBtn)

    // Assert the component invoked the search addon properly
    expect(mockFindNext).toHaveBeenCalledWith('test', expect.any(Object))

    // Click "Find Previous"
    const prevBtn = screen.getByTestId('search-prev-btn')
    fireEvent.click(prevBtn)

    // Assert the component invoked the search addon properly for backwards
    expect(mockFindPrevious).toHaveBeenCalledWith('test', expect.any(Object))

    // Click "Close"
    const closeBtn = screen.getByTestId('search-close-btn')
    fireEvent.click(closeBtn)

    // Assert overlay is gone
    expect(screen.queryByTestId('search-overlay')).not.toBeInTheDocument()

    // Ensure terminal regains focus after close
    expect(term.focus).toHaveBeenCalled()

    // Test Esc behavior and verify overlay unmounts
    act(() => {
      term._keyHandler({
        type: 'keydown',
        key: 'f',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: () => {},
        stopPropagation: () => {}
      } as any)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('search-overlay')).toBeInTheDocument()
    })

    act(() => {
      term._keyHandler({
        type: 'keydown',
        key: 'Escape',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        preventDefault: () => {},
        stopPropagation: () => {}
      } as any)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('search-overlay')).not.toBeInTheDocument()
    })

    unmount()
  })
})
