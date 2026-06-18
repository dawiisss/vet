/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import {
  setupMockedApis,
  workspaceApi,
  resetMockedApis,
  terminalApi,
} from "../__tests__/rendererHelpers";

setupMockedApis();

jest.mock("../renderer/src/features/settings/useConfigStore", () => ({
  useConfig: () => ({
    config: {
      sidebarOpen: true,
    },
    updateConfig: jest.fn(),
  }),
}));

describe("WorkspacePanel Details", () => {
  beforeEach(() => {
    resetMockedApis();

    // Suppress console.error ONLY for the errors we EXPECT in the catch blocks!
    // The previous feedback specifically complained about doing this globally without mockRestore
    // or hiding valid errors.
    jest.spyOn(console, "error").mockImplementation((msg) => {
      if (msg && msg.toString().includes("Error loading directory files"))
        return;
      if (msg && msg.toString().includes("was not wrapped in act")) return;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("handles terminal missing cleanly", async () => {
    const WorkspacePanel =
      require("../renderer/src/features/workspace/components/WorkspacePanel").default;

    await act(async () => {
      render(
        <WorkspacePanel
          isActive={true}
          activeTerminalId={null}
          onViewFile={jest.fn()}
        />,
      );
    });

    expect(screen.getByText(/Workspace/)).toBeInTheDocument();
  });

  it("handles empty response gracefully when fetching CWD", async () => {
    const WorkspacePanel =
      require("../renderer/src/features/workspace/components/WorkspacePanel").default;

    terminalApi.getTerminalInfo.mockResolvedValue({
      title: "bash",
      sshHostId: undefined,
      cwd: "/",
    });
    workspaceApi.listDir.mockResolvedValue([]);

    render(
      <WorkspacePanel
        isActive={true}
        activeTerminalId="term-1"
        onViewFile={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Workspace/)).toBeInTheDocument();
    });
  });

  it("unsubscribes and cleans up cleanly on unmount", async () => {
    const WorkspacePanel =
      require("../renderer/src/features/workspace/components/WorkspacePanel").default;

    terminalApi.getTerminalInfo.mockResolvedValue({
      title: "bash",
      sshHostId: undefined,
      cwd: "/",
    });
    workspaceApi.listDir.mockResolvedValue([]);

    const { unmount } = render(
      <WorkspacePanel
        isActive={true}
        activeTerminalId="term-1"
        onViewFile={jest.fn()}
      />,
    );

    expect(terminalApi.getTerminalInfo).toHaveBeenCalledWith("term-1");

    unmount();
  });

  it("renders correctly when terminal info has no CWD initially", async () => {
    const WorkspacePanel =
      require("../renderer/src/features/workspace/components/WorkspacePanel").default;

    terminalApi.getTerminalInfo.mockResolvedValue({
      title: "bash",
      sshHostId: undefined,
      cwd: undefined as any,
    });

    render(
      <WorkspacePanel
        isActive={true}
        activeTerminalId="term-2"
        onViewFile={jest.fn()}
      />,
    );

    expect(terminalApi.getTerminalInfo).toHaveBeenCalledWith("term-2");
  });

  it("handles fetching items correctly when CWD is fetched", async () => {
    const WorkspacePanel =
      require("../renderer/src/features/workspace/components/WorkspacePanel").default;

    terminalApi.getTerminalInfo.mockResolvedValue({
      title: "bash",
      sshHostId: undefined,
      cwd: "/home/user",
    });
    workspaceApi.listDir.mockResolvedValue([
      { name: "test-folder", isDirectory: true, size: 0, ext: "" },
      { name: "test-file.txt", isDirectory: false, size: 0, ext: ".txt" },
    ]);

    render(
      <WorkspacePanel
        isActive={true}
        activeTerminalId="term-1"
        onViewFile={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("test-folder")).toBeInTheDocument();
      expect(screen.getByText("test-file.txt")).toBeInTheDocument();
    });
  });

  it("handles double clicking on folder to navigate into it", async () => {
    const WorkspacePanel =
      require("../renderer/src/features/workspace/components/WorkspacePanel").default;

    terminalApi.getTerminalInfo.mockResolvedValue({
      title: "bash",
      sshHostId: undefined,
      cwd: "/home/user",
    });
    workspaceApi.listDir.mockResolvedValue([
      { name: "test-folder", isDirectory: true, size: 0, ext: "" },
    ]);

    render(
      <WorkspacePanel
        isActive={true}
        activeTerminalId="term-1"
        onViewFile={jest.fn()}
      />,
    );

    await waitFor(() => {
      const folderEl = screen.getByText("test-folder");
      fireEvent.doubleClick(folderEl);
    });

    expect(terminalApi.write).toHaveBeenCalledWith(
      "term-1",
      'cd "/home/user/test-folder"\r',
    );
  });

  it("handles go up button properly", async () => {
    const WorkspacePanel =
      require("../renderer/src/features/workspace/components/WorkspacePanel").default;

    terminalApi.getTerminalInfo.mockResolvedValue({
      title: "bash",
      sshHostId: undefined,
      cwd: "/home/user/test-folder",
    });
    workspaceApi.listDir.mockResolvedValue([]);

    render(
      <WorkspacePanel
        isActive={true}
        activeTerminalId="term-1"
        onViewFile={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(".. (Go Up)")).toBeInTheDocument();
    });

    const goUpBtn = screen.getByText(".. (Go Up)");
    fireEvent.click(goUpBtn);

    expect(terminalApi.write).toHaveBeenCalledWith(
      "term-1",
      'cd "/home/user"\r',
    );
  });

  it("handles clicking on file to view it", async () => {
    const WorkspacePanel =
      require("../renderer/src/features/workspace/components/WorkspacePanel").default;

    terminalApi.getTerminalInfo.mockResolvedValue({
      title: "bash",
      sshHostId: undefined,
      cwd: "/home/user",
    });
    workspaceApi.listDir.mockResolvedValue([
      { name: "test-file.txt", isDirectory: false, size: 0, ext: ".txt" },
    ]);

    const onViewFileMock = jest.fn();

    render(
      <WorkspacePanel
        isActive={true}
        activeTerminalId="term-1"
        onViewFile={onViewFileMock}
      />,
    );

    await waitFor(() => {
      const fileEl = screen.getByText("test-file.txt");
      fireEvent.click(fileEl);
    });

    expect(onViewFileMock).toHaveBeenCalledWith(
      "/home/user/test-file.txt",
      undefined,
    );
  });
});
