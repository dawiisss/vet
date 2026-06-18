/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ClipboardPreviewModal from "../renderer/src/shared/components/ClipboardPreviewModal";

describe("ClipboardPreviewModal", () => {
  const defaultItem = {
    id: "1",
    text: "line one\nline two\nline three",
    timestamp: 1680000000000,
  };

  const mockOnClose = jest.fn();
  let originalToLocaleTimeString: typeof Date.prototype.toLocaleTimeString;

  beforeEach(() => {
    jest.clearAllMocks();
    originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
    Date.prototype.toLocaleTimeString = jest.fn(() => "11:40:00");
  });

  afterEach(() => {
    Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
  });

  it("renders with item text and timestamp", () => {
    render(<ClipboardPreviewModal item={defaultItem} onClose={mockOnClose} />);

    expect(screen.getByText("Clipboard Preview")).toBeInTheDocument();
    expect(screen.getByText("Copy All")).toBeInTheDocument();
    expect(screen.getByText("11:40:00")).toBeInTheDocument();
  });

  it("closes on Escape key", () => {
    render(<ClipboardPreviewModal item={defaultItem} onClose={mockOnClose} />);

    expect(screen.getByText("Clipboard Preview")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("closes on overlay click", () => {
    render(<ClipboardPreviewModal item={defaultItem} onClose={mockOnClose} />);

    const overlay = screen
      .getByText("Clipboard Preview")
      .closest('[style*="position: fixed"]') as HTMLElement;
    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("closes on × button click", async () => {
    render(<ClipboardPreviewModal item={defaultItem} onClose={mockOnClose} />);

    const closeButton = screen.getByText("×");
    await userEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("copies all text when Copy All is clicked", async () => {
    const mockWriteText = jest.fn(() => Promise.resolve());
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<ClipboardPreviewModal item={defaultItem} onClose={mockOnClose} />);

    const copyAllButton = screen.getByText("Copy All");
    await userEvent.click(copyAllButton);

    expect(mockWriteText).toHaveBeenCalledWith(
      "line one\nline two\nline three",
    );
  });
});
