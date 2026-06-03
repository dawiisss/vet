/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { setupMockedApis, resetMockedApis, historyApi, workspaceApi, portsApi, sysinfoApi } from '../__tests__/rendererHelpers'

setupMockedApis()

describe('panel components', () => {
  beforeEach(() => {
    resetMockedApis()
  })

  describe('SystemMonitorPanel', () => {
    it('renders without error', async () => {
      let updateCb: ((data: any) => void) | null = null
      sysinfoApi.onUpdate.mockImplementation((cb: (data: any) => void) => {
        updateCb = cb
        return () => { updateCb = null }
      })

      const SystemMonitorPanel = require('../renderer/src/components/SystemMonitorPanel').default
      render(<SystemMonitorPanel isActive={true} />)

      await waitFor(() => {
        expect(sysinfoApi.start).toHaveBeenCalled()
      })

      updateCb?.({ cpu: 25.5, mem: { total: 16000000000, used: 8000000000 } })

      await waitFor(() => {
        expect(screen.getByText('CPU Usage')).toBeTruthy()
        expect(screen.getByText('RAM Usage')).toBeTruthy()
      })
    })
  })

  describe('PortMonitorPanel', () => {
    it('renders without error', async () => {
      portsApi.list.mockResolvedValue([])
      const PortMonitorPanel = require('../renderer/src/components/PortMonitorPanel').default
      render(<PortMonitorPanel isActive={true} />)
      await waitFor(() => {
        expect(screen.getByText(/Listening Ports/)).toBeTruthy()
      })
    })
  })

  describe('HistoryPanel', () => {
    it('renders without error', async () => {
      historyApi.getSessions.mockResolvedValue([])
      const HistoryPanel = require('../renderer/src/components/HistoryPanel').default
      render(<HistoryPanel isActive={true} onViewSession={jest.fn()} />)
      await waitFor(() => {
        expect(screen.getByText('Terminal History')).toBeTruthy()
      })
    })
  })

  describe('WorkspacePanel', () => {
    it('renders without error', async () => {
      workspaceApi.listDir.mockResolvedValue([])
      const WorkspacePanel = require('../renderer/src/components/WorkspacePanel').default
      render(<WorkspacePanel isActive={true} activeTerminalId="term-1" onViewFile={jest.fn()} />)
      await waitFor(() => {
        expect(screen.getByText(/Workspace/)).toBeTruthy()
      })
    })
  })

  describe('SnippetLibraryPanel', () => {
    it('renders without error', async () => {
      const SnippetLibraryPanel = require('../renderer/src/components/SnippetLibraryPanel').default
      render(<SnippetLibraryPanel isActive={true} onInjectSnippet={jest.fn()} />)
      expect(screen.getByText('Snippets')).toBeTruthy()
    })
  })

  describe('ConnectionsPanel', () => {
    it('renders without error', async () => {
      const ConnectionsPanel = require('../renderer/src/components/ConnectionsPanel').default
      jest.spyOn(global.window.connectionsApi, 'getSshHosts').mockResolvedValue([])
      jest.spyOn(global.window.connectionsApi, 'getDockerContainers').mockResolvedValue([])
      render(<ConnectionsPanel isActive={true} onRunScript={jest.fn()} />)
      await waitFor(() => {
        expect(screen.getByText(/SSH Hosts/)).toBeTruthy()
      })
    })
  })
})
