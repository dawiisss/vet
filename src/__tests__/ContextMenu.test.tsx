/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'

import { render, screen, fireEvent } from '@testing-library/react'
import { setupMockedApis, resetMockedApis } from '../__tests__/rendererHelpers'
import ContextMenu, { ContextMenuAction } from '../renderer/src/shared/components/ContextMenu'

setupMockedApis()

describe('ContextMenu', () => {
  const actions: ContextMenuAction[] = [
    { id: 'copy', label: 'Copy', onExecute: jest.fn() },
    { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', onExecute: jest.fn() },
    { id: 'clear', label: 'Clear', separator: true, onExecute: jest.fn() },
  ]

  beforeEach(() => {
    resetMockedApis()
  })

  it('renders nothing when not open', () => {
    const { container } = render(
      <ContextMenu isOpen={false} x={0} y={0} onClose={jest.fn()} actions={actions} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders menu items when open', () => {
    render(
      <ContextMenu isOpen={true} x={100} y={200} onClose={jest.fn()} actions={actions} />
    )
    expect(screen.getByText('Copy')).toBeInTheDocument()
    expect(screen.getByText('Paste')).toBeInTheDocument()
    expect(screen.getByText('Clear')).toBeInTheDocument()
  })

  it('calls onExecute and onClose when item clicked', () => {
    const onClose = jest.fn()
    render(
      <ContextMenu isOpen={true} x={100} y={200} onClose={onClose} actions={actions} />
    )
    fireEvent.click(screen.getByText('Copy'))
    expect(actions[0].onExecute).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('displays shortcuts', () => {
    render(
      <ContextMenu isOpen={true} x={100} y={200} onClose={jest.fn()} actions={actions} />
    )
    expect(screen.getByText('Ctrl+V')).toBeInTheDocument()
  })
})
