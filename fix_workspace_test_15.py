import re

with open('src/__tests__/panels.test.tsx', 'r') as f:
    content = f.read()

# Fix the act error in panels.test.tsx that we reintroduced
content = content.replace("""  describe('WorkspacePanel', () => {
    it('renders without error', async () => {
      workspaceApi.listDir.mockResolvedValue([])
      let getTerminalInfoResolve: any;
      window.terminalApi.getTerminalInfo.mockReturnValue(new Promise(resolve => { getTerminalInfoResolve = resolve; }));

      const WorkspacePanel = require('../renderer/src/features/workspace/components/WorkspacePanel').default
      render(<WorkspacePanel isActive={true} activeTerminalId="term-1" onViewFile={jest.fn()} />)

      await act(async () => {
        getTerminalInfoResolve({ sshHostId: null, cwd: '/test/cwd' });
      });

      await waitFor(() => {
        expect(screen.getByText(/Workspace/)).toBeTruthy()
      })
    })
  })""", """  describe('WorkspacePanel', () => {
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
  })""")

with open('src/__tests__/panels.test.tsx', 'w') as f:
    f.write(content)
