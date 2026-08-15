/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  setupMockedApis,
  resetMockedApis,
} from "../__tests__/rendererHelpers";
import TabBar, {
  TabBarTab,
} from "../renderer/src/features/terminal/components/TabBar";

setupMockedApis();

jest.mock("../renderer/src/features/settings/useConfigStore", () => ({
  useConfig: () => ({
    config: {
      shell: "/bin/bash",
      fontFamily: "monospace",
      fontSize: 14,
      opacity: 1.0,
      theme: "catppuccin-mocha",
      cursorStyle: "block",
      cursorBlink: true,
      keybindings: {},
      sidebarPlacement: "right",
      sidebarOpen: true,
      profiles: [
        { id: "default", name: "Default Shell", shell: "/bin/bash", args: [] },
        { id: "node", name: "Node.js REPL", shell: "node", args: [] },
      ],
      historyLoggingEnabled: true,
      historyDatabaseLimitMb: 500,
      historyKeepDays: 30,
      virtualScrollbackEnabled: true,
      virtualScrollbackBufferSize: 1000,
    },
    updateConfig: jest.fn(),
    openConfig: jest.fn(),
  }),
}));

describe("TabBar", () => {
  const tabs: TabBarTab[] = [
    { id: "tab-1", label: "shell 1" },
    { id: "tab-2", label: "shell 2" },
  ];
  const onSelect = jest.fn();
  const onClose = jest.fn();
  const onNew = jest.fn();

  beforeEach(() => {
    resetMockedApis();
    onSelect.mockClear();
    onClose.mockClear();
    onNew.mockClear();
  });

  it("renders tab labels", () => {
    render(
      <TabBar
        tabs={tabs}
        activeTabId="tab-1"
        onSelect={onSelect}
        onClose={onClose}
        onNew={onNew}
      />,
    );
    expect(screen.getByText("shell 1")).toBeInTheDocument();
    expect(screen.getByText("shell 2")).toBeInTheDocument();
  });

  it("highlights active tab", () => {
    const { container } = render(
      <TabBar
        tabs={tabs}
        activeTabId="tab-1"
        onSelect={onSelect}
        onClose={onClose}
        onNew={onNew}
      />,
    );
    const tabElements = container.querySelectorAll(".tab-item");
    expect(tabElements[0].getAttribute("data-tabid")).toBe("tab-1");
    expect(tabElements[1].getAttribute("data-tabid")).toBe("tab-2");
  });

  it("calls onSelect when tab clicked", () => {
    render(
      <TabBar
        tabs={tabs}
        activeTabId="tab-1"
        onSelect={onSelect}
        onClose={onClose}
        onNew={onNew}
      />,
    );
    fireEvent.click(screen.getByText("shell 2"));
    expect(onSelect).toHaveBeenCalledWith("tab-2");
  });

  it("calls onClose when close button clicked", () => {
    const onCloseMock = jest.fn();
    render(
      <TabBar
        tabs={tabs}
        activeTabId="tab-1"
        onSelect={onSelect}
        onClose={onCloseMock}
        onNew={onNew}
      />,
    );
    const closeButtons = document.querySelectorAll("[data-close]");
    expect(closeButtons.length).toBeGreaterThan(0);
    fireEvent.click(closeButtons[0]);
    expect(onCloseMock).toHaveBeenCalledWith("tab-1");
  });

  it("calls onNew when plus button clicked", () => {
    render(
      <TabBar
        tabs={tabs}
        activeTabId="tab-1"
        onSelect={onSelect}
        onClose={onClose}
        onNew={onNew}
      />,
    );
    const plusBtn = screen.getByText("+");
    fireEvent.click(plusBtn);
    expect(onNew).toHaveBeenCalled();
  });

  it("shows profile dropdown on arrow click", () => {
    render(
      <TabBar
        tabs={tabs}
        activeTabId="tab-1"
        onSelect={onSelect}
        onClose={onClose}
        onNew={onNew}
      />,
    );
    const arrowBtn = screen.getByText("▼");
    fireEvent.click(arrowBtn);
    expect(screen.getByText("Launch Profile")).toBeInTheDocument();
    expect(screen.getByText("Default Shell")).toBeInTheDocument();
    expect(screen.getByText("Node.js REPL")).toBeInTheDocument();
  });

  it("shows context menu on right click and supports layout changes", () => {
    const { container } = render(
      <TabBar
        tabs={tabs}
        activeTabId="tab-1"
        onSelect={onSelect}
        onClose={onClose}
        onNew={onNew}
      />,
    );

    // The main container is the first child div of the fragment/container
    const mainContainer = container.firstChild as HTMLElement;
    fireEvent.contextMenu(mainContainer, { clientX: 100, clientY: 100 });

    // ContextMenu should now be open
    expect(screen.getByText("✓ Position: Top")).toBeInTheDocument();
    expect(screen.getByText("Position: Left")).toBeInTheDocument();
    expect(screen.getByText("Position: Right")).toBeInTheDocument();
  });

  it("calls onReorderTab when dragging one tab onto another", () => {
    const onReorderTab = jest.fn();
    const { container } = render(
      <TabBar
        tabs={tabs}
        activeTabId="tab-1"
        onSelect={onSelect}
        onClose={onClose}
        onNew={onNew}
        onReorderTab={onReorderTab}
      />,
    );

    const tabElements = container.querySelectorAll(".tab-item");
    const firstTab = tabElements[0];
    const secondTab = tabElements[1];

    // Mock elementFromPoint to return the target tab element during drag drop
    document.elementFromPoint = jest.fn().mockReturnValue(secondTab);

    // Mouse down on tab 1
    fireEvent.mouseDown(firstTab, { clientX: 10, clientY: 10, button: 0 });
    // Move mouse past threshold to trigger dragging state
    fireEvent.mouseMove(document, { clientX: 30, clientY: 10 });
    // Release mouse over tab 2
    fireEvent.mouseUp(document, { clientX: 30, clientY: 10 });

    expect(onReorderTab).toHaveBeenCalledWith("tab-1", "tab-2");
  });
});
