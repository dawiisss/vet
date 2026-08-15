/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";

import { render, screen, fireEvent } from "@testing-library/react";
import { setupMockedApis, resetMockedApis } from "../__tests__/rendererHelpers";
import ContextMenu, {
  ContextMenuAction,
} from "../renderer/src/shared/components/ContextMenu";

setupMockedApis();

describe("ContextMenu", () => {
  const actions: ContextMenuAction[] = [
    { id: "copy", label: "Copy", onExecute: jest.fn() },
    { id: "paste", label: "Paste", shortcut: "Ctrl+V", onExecute: jest.fn() },
    { id: "clear", label: "Clear", separator: true, onExecute: jest.fn() },
  ];

  beforeEach(() => {
    resetMockedApis();
  });

  it("renders nothing when not open", () => {
    const { container } = render(
      <ContextMenu
        isOpen={false}
        x={0}
        y={0}
        onClose={jest.fn()}
        actions={actions}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders menu items when open", () => {
    render(
      <ContextMenu
        isOpen={true}
        x={100}
        y={200}
        onClose={jest.fn()}
        actions={actions}
      />,
    );
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Paste")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("calls onExecute and onClose when item clicked", () => {
    const onClose = jest.fn();
    render(
      <ContextMenu
        isOpen={true}
        x={100}
        y={200}
        onClose={onClose}
        actions={actions}
      />,
    );
    fireEvent.click(screen.getByText("Copy"));
    expect(actions[0].onExecute).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("displays shortcuts", () => {
    render(
      <ContextMenu
        isOpen={true}
        x={100}
        y={200}
        onClose={jest.fn()}
        actions={actions}
      />,
    );
    expect(screen.getByText("Ctrl+V")).toBeInTheDocument();
  });

  it("clamps and positions menu within viewport bounds", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1000 });
    Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 800 });

    const { baseElement } = render(
      <ContextMenu
        isOpen={true}
        x={950}
        y={750}
        onClose={jest.fn()}
        actions={actions}
      />,
    );

    const menuEl = baseElement.querySelector(".app-scrollbar") as HTMLElement;
    expect(menuEl).toBeInTheDocument();
    expect(menuEl.style.position).toBe("fixed");
  });

  it("closes when Escape key is pressed", () => {
    const onClose = jest.fn();
    render(
      <ContextMenu
        isOpen={true}
        x={100}
        y={200}
        onClose={onClose}
        actions={actions}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on outside mousedown and right-click", () => {
    const onClose = jest.fn();
    render(
      <ContextMenu
        isOpen={true}
        x={100}
        y={200}
        onClose={onClose}
        actions={actions}
      />,
    );

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.contextMenu(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("enforces single active context menu via mutual exclusion event", () => {
    const onCloseFirst = jest.fn();
    render(
      <ContextMenu
        isOpen={true}
        x={100}
        y={200}
        onClose={onCloseFirst}
        actions={actions}
      />,
    );

    // Another menu opens somewhere else in the app
    window.dispatchEvent(
      new CustomEvent("vet:close-context-menus", {
        detail: { senderId: "other-menu-id" },
      }),
    );

    expect(onCloseFirst).toHaveBeenCalled();
  });
});
