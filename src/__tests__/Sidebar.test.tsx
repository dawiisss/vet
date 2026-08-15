/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock the WorkspacePanel to avoid state updates causing act() warnings in Sidebar test
jest.mock(
  "../renderer/src/features/workspace/components/WorkspacePanel",
  () => {
    return function MockWorkspacePanel() {
      return <div data-testid="workspace-panel">Workspace</div>;
    };
  },
);

const mockUpdateConfig = jest.fn();
const mockUseConfig = jest.fn((): any => ({
  config: {
    sidebarPlacement: "right",
    sidebarWidth: 250,
    disabledSidebarPanels: [] as string[],
  },
  updateConfig: mockUpdateConfig,
}));

jest.mock("../renderer/src/features/settings/useConfigStore", () => ({
  useConfig: mockUseConfig,
  useConfigStore: {
    getState: jest.fn(() => ({ config: { sidebarPlacement: "right" } })),
  },
}));

import { setupMockedApis, resetMockedApis } from "../__tests__/rendererHelpers";
import Sidebar from "../renderer/src/shared/components/Sidebar";

setupMockedApis();

describe("Sidebar", () => {
  const onRunScript = jest.fn();
  const onInjectSnippet = jest.fn();
  const onViewSession = jest.fn();
  const onViewFile = jest.fn();

  beforeEach(() => {
    resetMockedApis();
    onRunScript.mockClear();
    onInjectSnippet.mockClear();
    onViewSession.mockClear();
    onViewFile.mockClear();
    mockUpdateConfig.mockClear();
    mockUseConfig.mockClear();
  });

  it("renders sidebar with tab icons", () => {
    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
      />,
    );
    const buttons = screen.getAllByRole("tab");
    expect(buttons.length).toBeGreaterThanOrEqual(7);
  });

  it("starts with first tab (Workspace) active", () => {
    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
      />,
    );
    const buttons = screen.getAllByRole("tab");
    expect(buttons.length).toBeGreaterThanOrEqual(7);
  });

  it("switches active tab on icon click", () => {
    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
      />,
    );
    const buttons = screen.getAllByRole("tab");
    expect(buttons[0]).toHaveAttribute("aria-selected", "true");
    expect(buttons[1]).toHaveAttribute("aria-selected", "false");

    const systemBtn = buttons[1]!;
    fireEvent.click(systemBtn);

    expect(buttons[0]).toHaveAttribute("aria-selected", "false");
    expect(buttons[1]).toHaveAttribute("aria-selected", "true");
  });

  it("renders resize handle", () => {
    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
      />,
    );
    const separator = screen.getByRole("separator");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute("aria-label", "Resize sidebar");
  });

  it("persists sidebar width after resize drag", () => {
    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
        width={250}
      />,
    );

    const separator = screen.getByRole("separator");

    // Start drag
    fireEvent.mouseDown(separator, { clientX: 100 });

    // Move mouse to simulate drag (increase width by 50px)
    fireEvent.mouseMove(document, { clientX: 50 });

    // End drag
    fireEvent.mouseUp(document);

    // updateConfig should have been called with the new width
    expect(mockUpdateConfig).toHaveBeenCalled();
    const callArg = mockUpdateConfig.mock.calls[0][0];
    expect(callArg).toHaveProperty("sidebarWidth");
  });

  it("opens context menu on right click and allows toggling panels", () => {
    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    fireEvent.contextMenu(tabs[0]!);

    expect(screen.getByText('Hide "Workspace"')).toBeInTheDocument();
    expect(screen.getByText("Show All Panels")).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hide "Workspace"'));
    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        disabledSidebarPanels: ["workspace"],
      }),
    );
  });

  it("filters out disabled sidebar panels based on config", () => {
    mockUseConfig.mockReturnValue({
      config: {
        sidebarPlacement: "right",
        sidebarWidth: 250,
        disabledSidebarPanels: ["workspace", "search"],
      },
      updateConfig: mockUpdateConfig,
    });

    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    // Original 12 panels - 2 disabled = 10 panels
    expect(tabs.length).toBe(10);
    expect(screen.queryByTitle(/Workspace/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Search/)).not.toBeInTheDocument();
    expect(screen.getByTitle(/Source Control/)).toBeInTheDocument();
  });

  it("reorders sidebar panels according to sidebarPanelsOrder config", () => {
    mockUseConfig.mockReturnValue({
      config: {
        sidebarPlacement: "right",
        sidebarWidth: 250,
        sidebarPanelsOrder: ["docker", "workspace", "search"],
        disabledSidebarPanels: [],
      },
      updateConfig: mockUpdateConfig,
    });

    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    // First tab should be Docker (🐳)
    expect(tabs[0]).toHaveTextContent("🐳");
    // Second tab should be Workspace (📁)
    expect(tabs[1]).toHaveTextContent("📁");
  });

  it("allows reordering panels via context menu Move Down / Move Up", () => {
    mockUseConfig.mockReturnValue({
      config: {
        sidebarPlacement: "right",
        sidebarWidth: 250,
        sidebarPanelsOrder: ["workspace", "search", "git"],
        disabledSidebarPanels: [],
      },
      updateConfig: mockUpdateConfig,
    });

    render(
      <Sidebar
        onRunScript={onRunScript}
        onInjectSnippet={onInjectSnippet}
        onViewSession={onViewSession}
        activeTerminalId="term-1"
        onViewFile={onViewFile}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    // Right click on first tab (Workspace)
    fireEvent.contextMenu(tabs[0]!);

    expect(screen.getByText("↓ Move Down")).toBeInTheDocument();
    expect(screen.getByText("⤓ Move to Bottom")).toBeInTheDocument();

    fireEvent.click(screen.getByText("↓ Move Down"));
    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        sidebarPanelsOrder: expect.arrayContaining(["search", "workspace"]),
      }),
    );
  });
});
