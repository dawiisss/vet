/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { setupMockedApis, resetMockedApis, workspaceApi } from "../__tests__/rendererHelpers";
import CommandPalette, {
  CommandAction,
} from "../renderer/src/shared/components/CommandPalette";
import { useTabStore } from "../renderer/src/features/terminal/useTabStore";

setupMockedApis();

describe("CommandPalette", () => {
  const actions: CommandAction[] = [
    { id: "settings", label: "Settings: Open", onExecute: jest.fn() },
    { id: "new-tab", label: "View: New Tab", onExecute: jest.fn() },
    { id: "split-h", label: "View: Split Horizontal", onExecute: jest.fn() },
  ];

  const onClose = jest.fn();

  beforeEach(() => {
    resetMockedApis();
    localStorage.clear();
    onClose.mockClear();
    (workspaceApi as any).searchFiles = jest.fn().mockResolvedValue([
      { relativePath: "src/App.tsx", absolutePath: "/path/src/App.tsx" },
      { relativePath: "package.json", absolutePath: "/path/package.json" },
    ]);
  });

  it("renders nothing when closed", async () => {
    let container: any;
    await act(async () => {
      const res = render(
        <CommandPalette isOpen={false} onClose={onClose} actions={actions} />,
      );
      container = res.container;
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders commands when opened in command mode", async () => {
    await act(async () => {
      render(
        <CommandPalette isOpen={true} initialMode="commands" onClose={onClose} actions={actions} />,
      );
    });
    expect(screen.getByText("Settings: Open")).toBeInTheDocument();
    expect(screen.getByText("View: New Tab")).toBeInTheDocument();
    expect(screen.getByText("View: Split Horizontal")).toBeInTheDocument();
  });

  it("filters actions by query in command mode", async () => {
    await act(async () => {
      render(
        <CommandPalette isOpen={true} initialMode="commands" onClose={onClose} actions={actions} />,
      );
    });
    const input = screen.getByPlaceholderText("Type a command or action...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "split" } });
    });
    expect(screen.getByText("View: Split Horizontal")).toBeInTheDocument();
    expect(screen.queryByText("Settings: Open")).not.toBeInTheDocument();
  });

  it("shows no results message when filter matches nothing", async () => {
    await act(async () => {
      render(
        <CommandPalette isOpen={true} initialMode="commands" onClose={onClose} actions={actions} />,
      );
    });
    const input = screen.getByPlaceholderText("Type a command or action...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "zzzxxxxx" } });
    });
    expect(screen.getByText("No matching commands found.")).toBeInTheDocument();
  });

  it("executes selected action on Enter", async () => {
    await act(async () => {
      render(
        <CommandPalette isOpen={true} initialMode="commands" onClose={onClose} actions={actions} />,
      );
    });
    const input = screen.getByPlaceholderText("Type a command or action...");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(actions[0].onExecute).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    await act(async () => {
      render(
        <CommandPalette isOpen={true} initialMode="commands" onClose={onClose} actions={actions} />,
      );
    });
    const input = screen.getByPlaceholderText("Type a command or action...");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates with arrow keys", async () => {
    await act(async () => {
      render(
        <CommandPalette isOpen={true} initialMode="commands" onClose={onClose} actions={actions} />,
      );
    });
    const input = screen.getByPlaceholderText("Type a command or action...");
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(actions[2].onExecute).toHaveBeenCalled();
  });

  it("prefills selected item query on ArrowRight keypress", async () => {
    await act(async () => {
      render(
        <CommandPalette isOpen={true} initialMode="commands" onClose={onClose} actions={actions} />,
      );
    });
    const input = screen.getByPlaceholderText("Type a command or action...") as HTMLInputElement;
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowRight" });
    });
    expect(input.value).toBe("Settings: Open");
  });

  it.each(["App.tsx:42", ":42"])("searches without the line suffix and opens line 42 for %s", async (query) => {
    useTabStore.setState({
      tabs: [{ id: "palette-tab", label: "Shell", root: { terminalId: "pty" }, focusedPath: [] }],
      activeTabId: "palette-tab",
    });
    (workspaceApi.searchFiles as jest.Mock).mockImplementation(async (_cwd: string, search: string) =>
      search.includes(":") ? [] : [{ relativePath: "src/App.tsx", absolutePath: "/path/src/App.tsx" }]);
    const onOpen = jest.fn();
    window.addEventListener("vet:open-editor", onOpen);
    try {
      render(<CommandPalette isOpen initialMode="files" onClose={onClose} actions={[]} />);
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: query } });
      await waitFor(() => expect(screen.getByText("App.tsx:42")).toBeInTheDocument());
      expect(workspaceApi.searchFiles).toHaveBeenLastCalledWith(
        "/home/user/projects", query.startsWith(":") ? "" : "App.tsx",
      );
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect((onOpen.mock.calls[0][0] as CustomEvent).detail).toEqual({
        filePath: "/path/src/App.tsx", line: 42,
      });
    } finally {
      window.removeEventListener("vet:open-editor", onOpen);
      useTabStore.setState({ tabs: [], activeTabId: null });
    }
  });
});
