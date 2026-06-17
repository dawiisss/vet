/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import {
  setupMockedApis,
  resetMockedApis,
  configApi,
} from "../__tests__/rendererHelpers";
import { useConfigStore } from "../renderer/src/features/settings/useConfigStore";
import SettingsModal from "../renderer/src/features/settings/components/SettingsModal";

setupMockedApis();

jest.mock("@xterm/xterm/css/xterm.css", () => ({}));

jest.mock("../renderer/src/themes", () => {
  const mockBuiltinThemes: Record<string, any> = {
    "catppuccin-mocha": {
      background: "#1e1e2e",
      foreground: "#cdd6f4",
      cursor: "#f5e0dc",
      selection: "#585b70",
      black: "#45475a",
      red: "#f38ba8",
      green: "#a6e3a1",
      yellow: "#f9e2af",
      blue: "#89b4fa",
      magenta: "#f5c2e7",
      cyan: "#94e2d5",
      white: "#bac2de",
      brightBlack: "#585b70",
      brightRed: "#f38ba8",
      brightGreen: "#a6e3a1",
      brightYellow: "#f9e2af",
      brightBlue: "#89b4fa",
      brightMagenta: "#f5c2e7",
      brightCyan: "#94e2d5",
      brightWhite: "#a6adc8",
    },
  };
  return {
    builtinThemes: mockBuiltinThemes,
    resolveTheme: (theme: any, _customThemes?: any) => {
      if (typeof theme === "string" && mockBuiltinThemes[theme])
        return mockBuiltinThemes[theme];
      if (typeof theme === "object") return theme;
      return mockBuiltinThemes["catppuccin-mocha"];
    },
  };
});

describe("SettingsModal", () => {
  const onClose = jest.fn();

  beforeEach(async () => {
    resetMockedApis();
    onClose.mockClear();
    configApi.get.mockResolvedValue({
      shell: "/bin/bash",
      fontFamily: "JetBrains Mono",
      fontSize: 14,
      opacity: 1.0,
      theme: "catppuccin-mocha",
      customThemes: {},
      cursorStyle: "block",
      cursorBlink: true,
      keybindings: {},
      sidebarPlacement: "right",
      sidebarOpen: true,
      profiles: [
        { id: "default", name: "Default Shell", shell: "/bin/bash", args: [] },
      ],
      historyLoggingEnabled: true,
      historyDatabaseLimitMb: 500,
      historyKeepDays: 30,
      virtualScrollbackEnabled: true,
      virtualScrollbackBufferSize: 1000,
      sidebarWidth: 250,
      clipboardHistoryKeepDays: 7,
    });

    await act(async () => {
      useConfigStore.getState().initialize();
    });
  });

  it("renders the settings modal title", async () => {
    render(<SettingsModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });

  it("renders tab buttons", async () => {
    render(<SettingsModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("General")).toBeInTheDocument();
      expect(screen.getByText("Sidebar")).toBeInTheDocument();
      expect(screen.getByText("Themes")).toBeInTheDocument();
    });
  });

  it("closes on close button click", async () => {
    render(<SettingsModal onClose={onClose} />);

    await waitFor(() => {
      screen.getByText("Settings");
    });

    const closeBtn = screen.getByText("×");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
