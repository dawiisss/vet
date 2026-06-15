/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React, { createRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModalOverlay } from '../renderer/src/shared/components/ModalOverlay'

describe('ModalOverlay', () => {
  it('renders children correctly', () => {
    render(
      <ModalOverlay>
        <div data-testid="child-element">Test Child</div>
      </ModalOverlay>
    )

    expect(screen.getByTestId('child-element')).toBeInTheDocument()
    expect(screen.getByText('Test Child')).toBeInTheDocument()
  })

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn()
    render(
      <ModalOverlay onClick={handleClick} data-testid="overlay">
        <div>Child</div>
      </ModalOverlay>
    )

    const overlay = screen.getByTestId('overlay')
    fireEvent.click(overlay)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies custom styles correctly', () => {
    render(
      <ModalOverlay style={{ backgroundColor: 'red', zIndex: 100 }} data-testid="overlay">
        <div>Child</div>
      </ModalOverlay>
    )

    const overlay = screen.getByTestId('overlay')
    // toHaveStyle parses it to CSS string representations, so zIndex 100 becomes z-index: 100.
    expect(overlay).toHaveStyle('background-color: rgb(255, 0, 0)')
    expect(overlay).toHaveStyle('z-index: 100')
  })

  it('forwards containerRef correctly', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <ModalOverlay containerRef={ref} data-testid="overlay">
        <div>Child</div>
      </ModalOverlay>
    )

    const overlay = screen.getByTestId('overlay')
    expect(ref.current).toBe(overlay)
  })

  it('passes additional HTML attributes correctly', () => {
    render(
      <ModalOverlay id="test-overlay-id" aria-label="Modal Backdrop" data-custom="value" data-testid="overlay">
        <div>Child</div>
      </ModalOverlay>
    )

    const overlay = screen.getByTestId('overlay')
    expect(overlay).toHaveAttribute('id', 'test-overlay-id')
    expect(overlay).toHaveAttribute('aria-label', 'Modal Backdrop')
    expect(overlay).toHaveAttribute('data-custom', 'value')
  })
})
