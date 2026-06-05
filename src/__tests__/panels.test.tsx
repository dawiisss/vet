/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { setupMockedApis, resetMockedApis, historyApi, workspaceApi, portsApi, sysinfoApi } from '../__tests__/rendererHelpers'

setupMockedApis()

jest.mock('../renderer/src/features/settings/useConfigStore', () => ({
  useConfig: () => ({
    config: {
      sidebarOpen: true,
    },
    updateConfig: jest.fn(),
  }),
}))

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

      const SystemMonitorPanel = require('../renderer/src/shared/components/SystemMonitorPanel').default
      render(<SystemMonitorPanel isActive={true} />)

      await waitFor(() => {
        expect(sysinfoApi.start).toHaveBeenCalled()
      })

      act(() => { updateCb?.({ cpu: 25.5, mem: { total: 16000000000, used: 8000000000 } }) })

      await waitFor(() => {
        expect(screen.getByText('CPU Usage')).toBeTruthy()
        expect(screen.getByText('RAM Usage')).toBeTruthy()
      })
    })
  })

  describe('PortMonitorPanel', () => {
    it('renders without error', async () => {
      portsApi.list.mockResolvedValue([])
      const PortMonitorPanel = require('../renderer/src/shared/components/PortMonitorPanel').default
      render(<PortMonitorPanel isActive={true} />)
      await waitFor(() => {
        expect(screen.getByText(/Listening Ports/)).toBeTruthy()
      })
    })
  })

  describe('HistoryPanel', () => {
    it('renders without error', async () => {
      historyApi.getSessions.mockResolvedValue([])
      const HistoryPanel = require('../renderer/src/shared/components/HistoryPanel').default
      render(<HistoryPanel isActive={true} onViewSession={jest.fn()} />)
      await waitFor(() => {
        expect(screen.getByText('Terminal History')).toBeTruthy()
      })
    })
  })

  describe('WorkspacePanel', () => {
    it('renders without error', async () => {
      let getTerminalInfoResolve: any;
      window.terminalApi.getTerminalInfo.mockReturnValue(new Promise(resolve => { getTerminalInfoResolve = resolve; }));

      let listDirResolve: any;
      workspaceApi.listDir.mockReturnValue(new Promise(resolve => { listDirResolve = resolve; }));

      const WorkspacePanel = require('../renderer/src/features/workspace/components/WorkspacePanel').default
      render(<WorkspacePanel isActive={true} activeTerminalId="term-1" onViewFile={jest.fn()} />)

      await act(async () => {
        getTerminalInfoResolve({ sshHostId: null, cwd: '/test/cwd' });
      });

      await act(async () => {
        listDirResolve([]);
      });

      await waitFor(() => {
        expect(screen.getByText(/Workspace/)).toBeTruthy()
      })
    })
  })
    })
  })

  describe('SnippetLibraryPanel', () => {
    it('renders without error', async () => {
      const SnippetLibraryPanel = require('../renderer/src/shared/components/SnippetLibraryPanel').default
    })
  })

  describe('ConnectionsPanel', () => {
    it('renders without error', async () => {
      const ConnectionsPanel = require('../renderer/src/features/connections/components/ConnectionsPanel').default
      jest.spyOn(global.window.connectionsApi, 'getSshHosts').mockResolvedValue([])
      jest.spyOn(global.window.connectionsApi, 'getDockerContainers').mockResolvedValue([])
      render(<ConnectionsPanel isActive={true} onRunScript={jest.fn()} />)
      await waitFor(() => {
        expect(screen.getByText(/SSH Hosts/)).toBeTruthy()
      })
    })
  })
})
