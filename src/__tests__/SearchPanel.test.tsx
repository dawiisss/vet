/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { jest } from "@jest/globals";
import SearchPanel from "../renderer/src/shared/components/SearchPanel";
import { setupMockedApis, resetMockedApis, workspaceApi } from "./rendererHelpers";

describe("SearchPanel", () => {
  beforeEach(() => {
    resetMockedApis();
    setupMockedApis();
  });

  it("renders search input and toggle buttons", () => {
    render(<SearchPanel isActive={true} activeTerminalId="term-1" />);

    expect(screen.getByPlaceholderText("Search files...")).toBeInTheDocument();
    expect(screen.getByTitle("Match Case (Aa)")).toBeInTheDocument();
    expect(screen.getByTitle("Match Whole Word (ab)")).toBeInTheDocument();
    expect(screen.getByTitle("Use Regular Expression (.*)")).toBeInTheDocument();
  });

  it("triggers searchFileContents and renders matching files and line previews", async () => {
    const mockMatches = [
      {
        filePath: "/home/user/projects/src/App.tsx",
        relativePath: "src/App.tsx",
        line: 42,
        column: 10,
        lineContent: "function App() {",
        matchLength: 3,
      },
      {
        filePath: "/home/user/projects/src/App.tsx",
        relativePath: "src/App.tsx",
        line: 100,
        column: 5,
        lineContent: "export default App;",
        matchLength: 3,
      },
    ];

    (workspaceApi.searchFileContents as any).mockResolvedValue(mockMatches);

    render(<SearchPanel isActive={true} activeTerminalId="term-1" />);

    const input = screen.getByPlaceholderText("Search files...");
    fireEvent.change(input, { target: { value: "App" } });

    await waitFor(() => {
      expect(workspaceApi.searchFileContents).toHaveBeenCalledWith(
        expect.any(String),
        "App",
        expect.objectContaining({
          caseSensitive: false,
          wholeWord: false,
          isRegex: false,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("App.tsx")).toBeInTheDocument();
      expect(screen.getByText("function App() {")).toBeInTheDocument();
      expect(screen.getByText("export default App;")).toBeInTheDocument();
    });
  });

  it("calls onViewFile when a line match is clicked", async () => {
    const mockMatches = [
      {
        filePath: "/home/user/projects/src/index.ts",
        relativePath: "src/index.ts",
        line: 15,
        column: 1,
        lineContent: "console.log('hello');",
        matchLength: 5,
      },
    ];

    (workspaceApi.searchFileContents as any).mockResolvedValue(mockMatches);
    const onViewFile = jest.fn();

    render(<SearchPanel isActive={true} activeTerminalId="term-1" onViewFile={onViewFile} />);

    fireEvent.change(screen.getByPlaceholderText("Search files..."), { target: { value: "hello" } });

    await waitFor(() => {
      expect(screen.getByText("console.log('hello');")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("console.log('hello');"));

    expect(onViewFile).toHaveBeenCalledWith("/home/user/projects/src/index.ts#L15");
  });

  it("dispatches vet:open-editor event as fallback when onViewFile is not provided", async () => {
    const mockMatches = [
      {
        filePath: "/home/user/projects/src/index.ts",
        relativePath: "src/index.ts",
        line: 15,
        column: 1,
        lineContent: "console.log('hello');",
        matchLength: 5,
      },
    ];

    (workspaceApi.searchFileContents as any).mockResolvedValue(mockMatches);
    const eventListener = jest.fn();
    window.addEventListener("vet:open-editor", eventListener);

    render(<SearchPanel isActive={true} activeTerminalId="term-1" />);

    fireEvent.change(screen.getByPlaceholderText("Search files..."), { target: { value: "hello" } });

    await waitFor(() => {
      expect(screen.getByText("console.log('hello');")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("console.log('hello');"));

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          filePath: "/home/user/projects/src/index.ts#L15",
        }),
      }),
    );

    window.removeEventListener("vet:open-editor", eventListener);
  });
});
