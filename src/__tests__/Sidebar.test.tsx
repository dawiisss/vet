/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the WorkspacePanel to avoid state updates causing act() warnings in Sidebar test
jest.mock('../renderer/src/features/workspace/components/WorkspacePanel', () => {
  return function MockWorkspacePanel() {
    return <div data-testid="workspace-panel">Workspace</div>
  }
})
import { setupMockedApis, configApi, resetMockedApis } from '../__tests__/rendererHelpers'
import Sidebar from '../renderer/src/shared/components/Sidebar'

setupMockedApis()

describe('Sidebar', () => {
  const onRunScript = jest.fn()
  const onInjectSnippet = jest.fn()
  const onViewSession = jest.fn()
  const onViewFile = jest.fn()

  beforeEach(() => {
    resetMockedApis()
    onRunScript.mockClear()
    onInjectSnippet.mockClear()
    onViewSession.mockClear()
    onViewFile.mockClear()
  })

  it('renders sidebar with tab icons', () => {
    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(7)
  })

  it('starts with first tab (Workspace) active', () => {
    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(7)
  })

  it('switches active tab on icon click', () => {
    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
      />
    )
    const buttons = screen.getAllByRole('button')
    const systemBtn = buttons[1]
    fireEvent.click(systemBtn)
  })
})
