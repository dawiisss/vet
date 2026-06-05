/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { setupMockedApis, workspaceApi, resetMockedApis } from '../__tests__/rendererHelpers'

setupMockedApis()

jest.mock('../renderer/src/features/settings/useConfigStore', () => ({
  useConfig: () => ({
    config: {
      sidebarOpen: true,
    },
    updateConfig: jest.fn(),
  }),
}))

describe('WorkspacePanel Details', () => {
  beforeEach(() => {
    resetMockedApis()
  })

  it('handles terminal missing cleanly', async () => {
    const WorkspacePanel = require('../renderer/src/features/workspace/components/WorkspacePanel').default

    await act(async () => {
      render(<WorkspacePanel isActive={true} activeTerminalId={null} onViewFile={jest.fn()} />)
    })

    expect(screen.getByText(/Workspace/)).toBeInTheDocument()
  })

  it('handles empty response gracefully when fetching CWD', async () => {
    const WorkspacePanel = require('../renderer/src/features/workspace/components/WorkspacePanel').default

    let getTerminalInfoResolve: any;
    window.terminalApi.getTerminalInfo.mockReturnValue(new Promise(resolve => { getTerminalInfoResolve = resolve; }));

    let listDirResolve: any;
    workspaceApi.listDir.mockReturnValue(new Promise(resolve => { listDirResolve = resolve; }));

    render(<WorkspacePanel isActive={true} activeTerminalId="term-1" onViewFile={jest.fn()} />)

    await act(async () => {
      getTerminalInfoResolve({ sshHostId: null, cwd: '/' });
    });

    await act(async () => {
      listDirResolve([]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Workspace/)).toBeInTheDocument()
    })
  })

  it('unsubscribes and cleans up cleanly on unmount', () => {
    const WorkspacePanel = require('../renderer/src/features/workspace/components/WorkspacePanel').default

    const { unmount } = render(<WorkspacePanel isActive={true} activeTerminalId="term-1" onViewFile={jest.fn()} />)

    expect(window.terminalApi.getTerminalInfo).toHaveBeenCalledWith('term-1')

    unmount()
  })

  it('renders correctly when terminal info has no CWD initially', async () => {
    const WorkspacePanel = require('../renderer/src/features/workspace/components/WorkspacePanel').default

    let getTerminalInfoResolve: any;
    window.terminalApi.getTerminalInfo.mockReturnValue(new Promise(resolve => { getTerminalInfoResolve = resolve; }));

    render(<WorkspacePanel isActive={true} activeTerminalId="term-2" onViewFile={jest.fn()} />)

    await act(async () => {
      getTerminalInfoResolve({ sshHostId: null, cwd: undefined });
    });

    expect(window.terminalApi.getTerminalInfo).toHaveBeenCalledWith('term-2')
  })

  it('handles fetching items correctly when CWD is fetched', async () => {
    const WorkspacePanel = require('../renderer/src/features/workspace/components/WorkspacePanel').default

    let getTerminalInfoResolve: any;
    window.terminalApi.getTerminalInfo.mockReturnValue(new Promise(resolve => { getTerminalInfoResolve = resolve; }));

    let listDirResolve: any;
    workspaceApi.listDir.mockReturnValue(new Promise(resolve => { listDirResolve = resolve; }));

    render(<WorkspacePanel isActive={true} activeTerminalId="term-1" onViewFile={jest.fn()} />)

    await act(async () => {
      getTerminalInfoResolve({ sshHostId: null, cwd: '/home/user' });
    });

    await act(async () => {
      listDirResolve([{ name: 'test-folder', isDirectory: true, ext: '' }, { name: 'test-file.txt', isDirectory: false, ext: '.txt' }]);
    });

    await waitFor(() => {
      expect(screen.getByText('test-folder')).toBeInTheDocument()
      expect(screen.getByText('test-file.txt')).toBeInTheDocument()
    })
  })

  it('handles double clicking on folder to navigate into it', async () => {
    const WorkspacePanel = require('../renderer/src/features/workspace/components/WorkspacePanel').default

    let getTerminalInfoResolve: any;
    window.terminalApi.getTerminalInfo.mockReturnValue(new Promise(resolve => { getTerminalInfoResolve = resolve; }));

    let listDirResolve: any;
    workspaceApi.listDir.mockReturnValue(new Promise(resolve => { listDirResolve = resolve; }));

    render(<WorkspacePanel isActive={true} activeTerminalId="term-1" onViewFile={jest.fn()} />)

    await act(async () => {
      getTerminalInfoResolve({ sshHostId: null, cwd: '/home/user' });
    });

    await act(async () => {
      listDirResolve([{ name: 'test-folder', isDirectory: true, ext: '' }]);
    });

    await waitFor(() => {
      const folderEl = screen.getByText('test-folder')
      fireEvent.doubleClick(folderEl)
    })

    expect(window.terminalApi.write).toHaveBeenCalledWith('term-1', 'cd "/home/user/test-folder"\r')
  })

  it('handles go up button properly', async () => {
    const WorkspacePanel = require('../renderer/src/features/workspace/components/WorkspacePanel').default

    let getTerminalInfoResolve: any;
    window.terminalApi.getTerminalInfo.mockReturnValue(new Promise(resolve => { getTerminalInfoResolve = resolve; }));

    let listDirResolve: any;
    workspaceApi.listDir.mockReturnValue(new Promise(resolve => { listDirResolve = resolve; }));

    render(<WorkspacePanel isActive={true} activeTerminalId="term-1" onViewFile={jest.fn()} />)

    await act(async () => {
      getTerminalInfoResolve({ sshHostId: null, cwd: '/home/user/test-folder' });
    });

    await act(async () => {
      listDirResolve([]);
    });

    await waitFor(() => {
      expect(screen.getByText('.. (Go Up)')).toBeInTheDocument()
    })

    const goUpBtn = screen.getByText('.. (Go Up)')
    fireEvent.click(goUpBtn)

    expect(window.terminalApi.write).toHaveBeenCalledWith('term-1', 'cd "/home/user"\r')
  })

  it('handles clicking on file to view it', async () => {
    const WorkspacePanel = require('../renderer/src/features/workspace/components/WorkspacePanel').default

    let getTerminalInfoResolve: any;
    window.terminalApi.getTerminalInfo.mockReturnValue(new Promise(resolve => { getTerminalInfoResolve = resolve; }));

    let listDirResolve: any;
    workspaceApi.listDir.mockReturnValue(new Promise(resolve => { listDirResolve = resolve; }));

    const onViewFileMock = jest.fn()

    render(<WorkspacePanel isActive={true} activeTerminalId="term-1" onViewFile={onViewFileMock} />)

    await act(async () => {
      getTerminalInfoResolve({ sshHostId: null, cwd: '/home/user' });
    });

    await act(async () => {
      listDirResolve([{ name: 'test-file.txt', isDirectory: false, ext: '.txt' }]);
    });

    await waitFor(() => {
      const fileEl = screen.getByText('test-file.txt')
      fireEvent.click(fileEl)
    })

    expect(onViewFileMock).toHaveBeenCalledWith('/home/user/test-file.txt', undefined)
  })
})
