/**
 * @jest-environment jsdom
 */

import React, { useRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFocusTrap } from '../renderer/src/shared/hooks/useFocusTrap'

describe('useFocusTrap', () => {
  const TestComponent = ({ active = true }: { active?: boolean }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    useFocusTrap(containerRef, active)

    return (
      <div data-testid="container" ref={containerRef} tabIndex={-1}>
        <button data-testid="button-1">Button 1</button>
        <button data-testid="button-2">Button 2</button>
        <button data-testid="button-3">Button 3</button>
      </div>
    )
  }

  const TestComponentNoFocusable = ({ active = true }: { active?: boolean }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    useFocusTrap(containerRef, active)

    return (
      <div data-testid="container" ref={containerRef}>
        <p>No focusable elements here.</p>
      </div>
    )
  }

  it('tabbing on the last focusable element wraps to the first focusable element', async () => {
    const user = userEvent.setup()
    render(<TestComponent />)

    const button1 = screen.getByTestId('button-1')
    const button3 = screen.getByTestId('button-3')

    button3.focus()
    expect(document.activeElement).toBe(button3)

    await user.tab()
    expect(document.activeElement).toBe(button1)
  })

  it('shift-tabbing on the first focusable element wraps to the last focusable element', async () => {
    const user = userEvent.setup()
    render(<TestComponent />)

    const button1 = screen.getByTestId('button-1')
    const button3 = screen.getByTestId('button-3')

    button1.focus()
    expect(document.activeElement).toBe(button1)

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(button3)
  })

  it('shift-tabbing on the container element itself wraps to the last focusable element', async () => {
    const user = userEvent.setup()
    render(<TestComponent />)

    const container = screen.getByTestId('container')
    const button3 = screen.getByTestId('button-3')

    container.focus()
    expect(document.activeElement).toBe(container)

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(button3)
  })

  it('no focus trapping occurs when active is set to false', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <TestComponent active={false} />
        <button data-testid="outside-button">Outside Button</button>
      </div>
    )

    const button3 = screen.getByTestId('button-3')
    const outsideButton = screen.getByTestId('outside-button')

    button3.focus()
    expect(document.activeElement).toBe(button3)

    await user.tab()
    // It should allow tabbing to the outside element
    expect(document.activeElement).toBe(outsideButton)
  })

  it('handles containers with no focusable elements gracefully', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <TestComponentNoFocusable />
        <button data-testid="outside-button">Outside Button</button>
      </div>
    )

    const container = screen.getByTestId('container')
    const outsideButton = screen.getByTestId('outside-button')

    // Should not throw when tabbing
    await user.tab()

    // Nothing to trap, just ensure no error occurred and typical browser behavior occurs
    // Focus might end up on body or outside element
    expect(document.activeElement === document.body || document.activeElement === outsideButton).toBe(true)
  })
})
