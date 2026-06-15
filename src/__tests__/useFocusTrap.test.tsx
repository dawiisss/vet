/**
 * @jest-environment jsdom
 */
import React, { useRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFocusTrap } from '@/shared/hooks/useFocusTrap'

const TestComponent = ({ active = true }: { active?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, active)

  return (
    <div>
      <button data-testid="outside-before">Outside Before</button>
      <div ref={ref} data-testid="trap-container">
        <button data-testid="inside-1">First</button>
        <input data-testid="inside-2" />
        <button data-testid="inside-3">Last</button>
      </div>
      <button data-testid="outside-after">Outside After</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('does nothing when not active', async () => {
    render(<TestComponent active={false} />)
    const user = userEvent.setup()

    screen.getByTestId('inside-3').focus()
    expect(document.activeElement).toBe(screen.getByTestId('inside-3'))

    await user.tab()
    expect(document.activeElement).toBe(screen.getByTestId('outside-after'))
  })

  it('traps focus inside the container moving forward (Tab)', async () => {
    render(<TestComponent />)
    const user = userEvent.setup()

    screen.getByTestId('inside-3').focus()
    expect(document.activeElement).toBe(screen.getByTestId('inside-3'))

    await user.tab()
    expect(document.activeElement).toBe(screen.getByTestId('inside-1'))
  })

  it('traps focus inside the container moving backward (Shift+Tab)', async () => {
    render(<TestComponent />)
    const user = userEvent.setup()

    screen.getByTestId('inside-1').focus()
    expect(document.activeElement).toBe(screen.getByTestId('inside-1'))

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByTestId('inside-3'))
  })

  it('traps focus when activeElement is the container itself (Shift+Tab)', async () => {
    const ContainerFocusTest = () => {
      const ref = useRef<HTMLDivElement>(null)
      useFocusTrap(ref, true)

      return (
        <div ref={ref} tabIndex={-1} data-testid="trap-container">
          <button data-testid="inside-1">First</button>
          <button data-testid="inside-2">Last</button>
        </div>
      )
    }

    render(<ContainerFocusTest />)
    const user = userEvent.setup()

    screen.getByTestId('trap-container').focus()
    expect(document.activeElement).toBe(screen.getByTestId('trap-container'))

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByTestId('inside-2'))
  })
})
