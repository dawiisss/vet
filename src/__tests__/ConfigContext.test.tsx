/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { setupMockedApis, configApi } from '../__tests__/rendererHelpers'
import { ConfigProvider, useConfig } from '../renderer/src/ConfigContext'

setupMockedApis()

describe('ConfigContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    configApi.get.mockResolvedValue({
      shell: '/bin/bash',
      fontFamily: 'monospace',
      fontSize: 14,
      opacity: 1.0,
      theme: 'catppuccin-mocha',
      cursorStyle: 'block',
      cursorBlink: true,
      keybindings: {},
      sidebarPlacement: 'right',
      sidebarOpen: true,
      profiles: [{ id: 'default', name: 'Default', shell: '/bin/bash', args: [] }],
      historyLoggingEnabled: true,
      historyDatabaseLimitMb: 500,
      historyKeepDays: 30,
      virtualScrollbackEnabled: true,
      virtualScrollbackBufferSize: 1000,
    })
  })

  it('provides config to children', async () => {
    const TestChild = () => {
      const { config } = useConfig()
      return <div data-testid="shell">{config.shell}</div>
    }

    render(
      <ConfigProvider>
        <TestChild />
      </ConfigProvider>
    )

    await screen.findByTestId('shell')
    expect(screen.getByTestId('shell')).toHaveTextContent('/bin/bash')
  })

  it('fetches config from configApi on mount', async () => {
    render(
      <ConfigProvider>
        <div data-testid="child">ready</div>
      </ConfigProvider>
    )

    await screen.findByTestId('child')
    expect(configApi.get).toHaveBeenCalled()
  })

  it('subscribes to config changes', async () => {
    render(
      <ConfigProvider>
        <div data-testid="child">ready</div>
      </ConfigProvider>
    )

    await screen.findByTestId('child')
    expect(configApi.onChanged).toHaveBeenCalled()
  })

  it('provides updateConfig function', async () => {
    const updateFn = jest.fn()
    const TestChild = () => {
      const { updateConfig } = useConfig()
      updateFn.mockImplementation((...args: any[]) => updateConfig(...args))
      return <div data-testid="child">ready</div>
    }

    render(
      <ConfigProvider>
        <TestChild />
      </ConfigProvider>
    )

    await screen.findByTestId('child')
    await updateFn({ fontSize: 16 })
    expect(configApi.set).toHaveBeenCalledWith({ fontSize: 16 })
  })

  it('provides openConfig function', async () => {
    const openFn = jest.fn()
    const TestChild = () => {
      const { openConfig } = useConfig()
      openFn.mockImplementation(() => openConfig())
      return <div data-testid="child">ready</div>
    }

    render(
      <ConfigProvider>
        <TestChild />
      </ConfigProvider>
    )

    await screen.findByTestId('child')
    openFn()
    expect(configApi.openInEditor).toHaveBeenCalled()
  })
})
