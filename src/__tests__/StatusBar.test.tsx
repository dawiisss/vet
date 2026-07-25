/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { StatusBar } from "../renderer/src/shared/components/StatusBar";
import { useStatusBarStore } from "../renderer/src/shared/stores/useStatusBarStore";
import { useConfigStore } from "../renderer/src/features/settings/useConfigStore";

describe("StatusBar component", () => {
  beforeEach(() => {
    // Reset store state
    act(() => {
      useConfigStore.setState({
        config: { ...useConfigStore.getState().config, showStatusBar: true },
      });
      useStatusBarStore.setState({
        activePaneType: null,
        activePaneId: null,
        terminalStatus: {},
        browserStatus: {},
        editorStatus: {},
      });
    });
  });

  it("renders ready state when no active pane", () => {
    render(<StatusBar />);
    expect(screen.getByText("Vet Workspace Ready")).toBeInTheDocument();
  });

  it("renders null when showStatusBar is false", () => {
    act(() => {
      useConfigStore.setState({
        config: { ...useConfigStore.getState().config, showStatusBar: false },
      });
    });

    const { container } = render(<StatusBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders terminal information correctly", () => {
    act(() => {
      useStatusBarStore.setState({
        activePaneType: "terminal",
        activePaneId: "term-123",
        terminalStatus: {
          "term-123": {
            cwd: "/home/user/project",
            command: "npm run dev",
            cols: 120,
            rows: 40,
            sshHostId: null,
          },
        },
      });
    });

    render(<StatusBar />);
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("npm run dev")).toBeInTheDocument();
    expect(screen.getByText("/home/user/project")).toBeInTheDocument();
    expect(screen.getByText("120 × 40")).toBeInTheDocument();
  });

  it("renders browser information correctly", () => {
    act(() => {
      useStatusBarStore.setState({
        activePaneType: "browser",
        activePaneId: "browser-123",
        browserStatus: {
          "browser-123": {
            url: "https://github.com",
            title: "GitHub: Let's build from here",
            blockedCount: 15,
            isHttps: true,
          },
        },
      });
    });

    render(<StatusBar />);
    expect(screen.getByText("🔒 Secure")).toBeInTheDocument();
    expect(screen.getByText("GitHub: Let's build from here")).toBeInTheDocument();
    expect(screen.getByText("https://github.com")).toBeInTheDocument();
    expect(screen.getByText("🛡️ 15 blocked")).toBeInTheDocument();
  });

  it("renders editor information correctly", () => {
    act(() => {
      useStatusBarStore.setState({
        activePaneType: "editor",
        activePaneId: "editor-123",
        editorStatus: {
          "editor-123": {
            line: 42,
            col: 10,
            language: "TypeScript",
            isDirty: true,
            filePath: "/home/user/project/src/main.ts",
            sshHostId: null,
          },
        },
      });
    });

    render(<StatusBar />);
    expect(screen.getByText("Local Editor")).toBeInTheDocument();
    expect(screen.getByText("main.ts")).toBeInTheDocument();
    expect(screen.getByText("Modified")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Ln 42, Col 10")).toBeInTheDocument();
  });
});
