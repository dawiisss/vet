/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { setupMockedApis, resetMockedApis } from '../__tests__/rendererHelpers'
import CommandPalette, { CommandAction } from '../renderer/src/components/CommandPalette'

setupMockedApis()

describe('CommandPalette', () => {
  const actions: CommandAction[] = [
    { id: 'settings', label: 'Settings: Open', onExecute: jest.fn() },
    { id: 'new-tab', label: 'View: New Tab', onExecute: jest.fn() },
    { id: 'split-h', label: 'View: Split Horizontal', onExecute: jest.fn() },
  ]

  const onClose = jest.fn()

  beforeEach(() => {
    resetMockedApis()
    onClose.mockClear()
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette isOpen={false} onClose={onClose} actions={actions} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders all actions when open', () => {
    render(
      <CommandPalette isOpen={true} onClose={onClose} actions={actions} />
    )
    expect(screen.getByText('Settings: Open')).toBeInTheDocument()
    expect(screen.getByText('View: New Tab')).toBeInTheDocument()
    expect(screen.getByText('View: Split Horizontal')).toBeInTheDocument()
  })

  it('filters actions by query', () => {
    render(
      <CommandPalette isOpen={true} onClose={onClose} actions={actions} />
    )
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.change(input, { target: { value: 'split' } })
    expect(screen.getByText('View: Split Horizontal')).toBeInTheDocument()
    expect(screen.queryByText('Settings: Open')).not.toBeInTheDocument()
  })

  it('shows no results message when filter matches nothing', () => {
    render(
      <CommandPalette isOpen={true} onClose={onClose} actions={actions} />
    )
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.change(input, { target: { value: 'zzzxxxxx' } })
    expect(screen.getByText('No commands found.')).toBeInTheDocument()
  })

  it('executes selected action on Enter', () => {
    render(
      <CommandPalette isOpen={true} onClose={onClose} actions={actions} />
    )
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(actions[0].onExecute).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape', () => {
    render(
      <CommandPalette isOpen={true} onClose={onClose} actions={actions} />
    )
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('navigates with arrow keys', () => {
    render(
      <CommandPalette isOpen={true} onClose={onClose} actions={actions} />
    )
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(actions[2].onExecute).toHaveBeenCalled()
  })
})
