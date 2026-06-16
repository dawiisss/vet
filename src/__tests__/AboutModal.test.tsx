/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AboutModal from '../renderer/src/shared/components/AboutModal'
import { setupMockedApis, resetMockedApis } from './rendererHelpers'

describe('AboutModal', () => {
  const onClose = jest.fn()

  setupMockedApis()

  beforeEach(() => {
    onClose.mockClear()
    resetMockedApis()
  })

  it('renders application details correctly', async () => {
    render(<AboutModal onClose={onClose} />)

    expect(screen.getByText('Vet')).toBeInTheDocument()
    expect(screen.getAllByText('Very Easy Terminal')[0]).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('1.0.2')).toBeInTheDocument()
    })
    expect(screen.getByText(/SQLite/)).toBeInTheDocument()
    expect(screen.getByText(/GitHub Repository/)).toBeInTheDocument()
  })

  it('calls onClose when clicking the top-right close button', () => {
    render(<AboutModal onClose={onClose} />)

    const closeBtn = screen.getByLabelText('Close dialog')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the Done button', () => {
    render(<AboutModal onClose={onClose} />)

    const doneBtn = screen.getByText('Done')
    fireEvent.click(doneBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the backdrop overlay', () => {
    const { container } = render(<AboutModal onClose={onClose} />)

    // The first child is the overlay backdrop
    const overlay = container.firstChild as HTMLElement
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when clicking inside the modal container', () => {
    render(<AboutModal onClose={onClose} />)

    const modalBody = screen.getAllByText('Very Easy Terminal')[0].parentElement as HTMLElement
    fireEvent.click(modalBody)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', () => {
    render(<AboutModal onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
