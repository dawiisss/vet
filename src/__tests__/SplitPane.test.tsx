/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { setupMockedApis, resetMockedApis } from '../__tests__/rendererHelpers'
import { leafNode, splitNode } from '../renderer/src/features/terminal/splitTree'
import SplitPane from '../renderer/src/features/terminal/components/SplitPane'

setupMockedApis()

global.ResizeObserver = class {
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
} as any

jest.mock('@xterm/xterm/css/xterm.css', () => ({}))

jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn().mockImplementation(() => ({
    element: document.createElement('div'),
    open: jest.fn(),
    dispose: jest.fn(),
    write: jest.fn(),
    clear: jest.fn(),
    focus: jest.fn(),
    resize: jest.fn(),
    scrollToLine: jest.fn(),
    reset: jest.fn(),
    loadAddon: jest.fn(),
    onData: jest.fn(),
    onResize: jest.fn(),
    onScroll: jest.fn(),
    getSelection: jest.fn(() => ''),
    options: {},
    attachCustomKeyEventHandler: jest.fn(),
  })),
}))

jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn().mockImplementation(() => ({ fit: jest.fn(), dispose: jest.fn() })),
}))
jest.mock('@xterm/addon-serialize', () => ({
  SerializeAddon: jest.fn().mockImplementation(() => ({ serialize: jest.fn(() => ''), dispose: jest.fn() })),
}))
jest.mock('@xterm/addon-search', () => ({
  SearchAddon: jest.fn().mockImplementation(() => ({ findNext: jest.fn(), findPrevious: jest.fn(), dispose: jest.fn() })),
}))
jest.mock('@xterm/addon-webgl', () => ({
  WebglAddon: jest.fn().mockImplementation(() => ({ dispose: jest.fn(), onContextLoss: jest.fn() })),
}))
jest.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: jest.fn().mockImplementation(() => ({ dispose: jest.fn() })),
}))
jest.mock('@xterm/addon-image', () => ({
  ImageAddon: jest.fn().mockImplementation(() => ({ dispose: jest.fn() })),
}))

jest.mock('../renderer/src/features/settings/useConfigStore', () => ({
  useConfig: () => ({
    config: {
      fontFamily: 'monospace',
      fontSize: 14,
      theme: 'catppuccin-mocha',
      cursorStyle: 'block',
      cursorBlink: true,
      opacity: 1.0,
      webglEnabled: false,
      virtualScrollbackEnabled: false,
      virtualScrollbackBufferSize: 1000,
    },
    updateConfig: jest.fn(),
    openConfig: jest.fn(),
  }),
}))

jest.mock('../renderer/src/themes', () => {
  const mockBuiltinThemes = {
    'catppuccin-mocha': {
      background: '#1e1e2e', foreground: '#cdd6f4', cursor: '#f5e0dc', selection: '#585b70',
      black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
      blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5', brightWhite: '#a6adc8',
    },
  }
  return {
    builtinThemes: mockBuiltinThemes,
    resolveTheme: (theme: any, _customThemes?: any) => {
      if (typeof theme === 'string' && mockBuiltinThemes[theme]) return mockBuiltinThemes[theme]
      if (typeof theme === 'object') return theme
      return mockBuiltinThemes['catppuccin-mocha']
    },
  }
})

describe('SplitPane', () => {
  const onFocus = jest.fn()
  const onExit = jest.fn()
  const onResize = jest.fn()

  beforeEach(() => {
    resetMockedApis()
    onFocus.mockClear()
    onExit.mockClear()
    onResize.mockClear()
  })

  it('renders terminal view for leaf node', () => {
    const node = leafNode('term-1')
    const { container } = render(
      <SplitPane
        node={node} path={[]} focusedPath={[]} isActive={true}
        onFocus={onFocus} onExit={onExit} onResize={onResize}
      />
    )
    expect(container.querySelector('[style*="overflow"]')).toBeTruthy()
  })

  it('renders split container for split node', () => {
    const node = splitNode('horizontal', [leafNode('term-a'), leafNode('term-b')])
    const { container } = render(
      <SplitPane
        node={node} path={[]} focusedPath={[0]} isActive={true}
        onFocus={onFocus} onExit={onExit} onResize={onResize}
      />
    )
    const handles = container.querySelectorAll('.split-handle')
    expect(handles).toHaveLength(1)
  })

  it('renders resize handles between children in horizontal split', () => {
    const node = splitNode('horizontal', [leafNode('a'), leafNode('b'), leafNode('c')])
    const { container } = render(
      <SplitPane
        node={node} path={[]} focusedPath={[0]} isActive={true}
        onFocus={onFocus} onExit={onExit} onResize={onResize}
      />
    )
    const handles = container.querySelectorAll('.split-handle')
    expect(handles).toHaveLength(2)
  })
})
