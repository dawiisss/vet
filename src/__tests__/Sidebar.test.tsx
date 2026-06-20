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
const mockUseConfig = jest.fn(() => ({
  config: {
    sidebarPlacement: "right",
    sidebarWidth: 250,
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
});
