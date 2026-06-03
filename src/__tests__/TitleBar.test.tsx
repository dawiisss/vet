/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { setupMockedApis, windowApi, resetMockedApis } from '../__tests__/rendererHelpers'
import TitleBar from '../renderer/src/components/TitleBar'

setupMockedApis()

describe('TitleBar', () => {
  beforeEach(() => {
    resetMockedApis()
    windowApi.isMaximized.mockResolvedValue(false)
  })

  it('renders the app name', () => {
    render(<TitleBar />)
    expect(screen.getByText('Vet')).toBeInTheDocument()
  })

  it('calls minimize on button click', () => {
    render(<TitleBar />)
    const buttons = screen.getAllByRole('button')
    const minimizeBtn = buttons[0]
    fireEvent.click(minimizeBtn)
    expect(windowApi.minimize).toHaveBeenCalled()
  })

  it('calls maximize on button click', () => {
    render(<TitleBar />)
    const buttons = screen.getAllByRole('button')
    const maximizeBtn = buttons[1]
    fireEvent.click(maximizeBtn)
    expect(windowApi.maximize).toHaveBeenCalled()
  })

  it('calls close on button click', () => {
    render(<TitleBar />)
    const buttons = screen.getAllByRole('button')
    const closeBtn = buttons[2]
    fireEvent.click(closeBtn)
    expect(windowApi.close).toHaveBeenCalled()
  })

  it('calls onOpenSettings when provided', () => {
    const onSettings = jest.fn()
    render(<TitleBar onOpenSettings={onSettings} />)
    const buttons = screen.getAllByRole('button')
    const settingsBtn = buttons[0]
    fireEvent.click(settingsBtn)
    expect(onSettings).toHaveBeenCalled()
  })

  it('checks maximize state on mount', () => {
    render(<TitleBar />)
    expect(windowApi.isMaximized).toHaveBeenCalled()
  })
})
