/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { setupMockedApis, windowApi, resetMockedApis } from '../__tests__/rendererHelpers'
import TitleBar from '../renderer/src/shared/components/TitleBar'

setupMockedApis()

describe('TitleBar', () => {
  beforeEach(() => {
    resetMockedApis()
  })

  it('renders the app name', async () => {
    let resolvePromise: any;
    windowApi.isMaximized.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));

    render(<TitleBar />)

    await act(async () => {
      resolvePromise(false);
    });

    expect(screen.getByText('Vet')).toBeInTheDocument()
  })

  it('calls minimize on button click', async () => {
    let resolvePromise: any;
    windowApi.isMaximized.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));

    render(<TitleBar />)

    await act(async () => {
      resolvePromise(false);
    });

    const buttons = screen.getAllByRole('button')
    const minimizeBtn = buttons[0]
    fireEvent.click(minimizeBtn)
    expect(windowApi.minimize).toHaveBeenCalled()
  })

  it('calls maximize on button click', async () => {
    let resolvePromise: any;
    windowApi.isMaximized.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));

    render(<TitleBar />)

    await act(async () => {
      resolvePromise(false);
    });

    const buttons = screen.getAllByRole('button')
    const maximizeBtn = buttons[1]
    fireEvent.click(maximizeBtn)
    expect(windowApi.maximize).toHaveBeenCalled()
  })

  it('calls close on button click', async () => {
    let resolvePromise: any;
    windowApi.isMaximized.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));

    render(<TitleBar />)

    await act(async () => {
      resolvePromise(false);
    });

    const buttons = screen.getAllByRole('button')
    const closeBtn = buttons[2]
    fireEvent.click(closeBtn)
    expect(windowApi.close).toHaveBeenCalled()
  })

  it('calls onOpenSettings when provided', async () => {
    let resolvePromise: any;
    windowApi.isMaximized.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));

    const onSettings = jest.fn()
    render(<TitleBar onOpenSettings={onSettings} />)

    await act(async () => {
      resolvePromise(false);
    });

    const buttons = screen.getAllByRole('button')
    const settingsBtn = buttons[0]
    fireEvent.click(settingsBtn)
    expect(onSettings).toHaveBeenCalled()
  })

  it('checks maximize state on mount', async () => {
    let resolvePromise: any;
    windowApi.isMaximized.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));

    render(<TitleBar />)

    await act(async () => {
      resolvePromise(false);
    });

    expect(windowApi.isMaximized).toHaveBeenCalled()
  })
})
