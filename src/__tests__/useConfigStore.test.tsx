/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React, { useEffect } from "react";
import { render, screen, act } from "@testing-library/react";
import { setupMockedApis, configApi } from "../__tests__/rendererHelpers";
import {
  useConfigStore,
  useConfig,
} from "../renderer/src/features/settings/useConfigStore";

setupMockedApis();

describe("useConfigStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useConfigStore.setState({
      isInitialized: false,
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
        historyLoggingEnabled: true,
        historyDatabaseLimitMb: 500,
        historyKeepDays: 30,
        virtualScrollbackEnabled: true,
        virtualScrollbackBufferSize: 1000,
      },
    });

    configApi.get.mockResolvedValue({
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
        { id: "default", name: "Default", shell: "/bin/bash", args: [] },
      ],
      historyLoggingEnabled: true,
      historyDatabaseLimitMb: 500,
      historyKeepDays: 30,
      virtualScrollbackEnabled: true,
      virtualScrollbackBufferSize: 1000,
    });
  });

  it("provides config to hook", async () => {
    const TestComponent = () => {
      const { config } = useConfig();
      return <div data-testid="shell">{config.shell}</div>;
    };

    render(<TestComponent />);
    expect(screen.getByTestId("shell")).toHaveTextContent("/bin/bash");
  });

  it("fetches config from configApi on initialize", async () => {
    act(() => {
      useConfigStore.getState().initialize();
    });
    expect(configApi.get).toHaveBeenCalled();
  });

  it("subscribes to config changes", async () => {
    act(() => {
      useConfigStore.getState().initialize();
    });
    expect(configApi.onChanged).toHaveBeenCalled();
  });

  it("provides updateConfig function", async () => {
    const { updateConfig } = useConfigStore.getState();
    await act(async () => {
      await updateConfig({ fontSize: 16 });
    });
    expect(configApi.set).toHaveBeenCalledWith({ fontSize: 16 });
  });

  it("provides openConfig function", async () => {
    const { openConfig } = useConfigStore.getState();
    await act(async () => {
      await openConfig();
    });
    expect(configApi.openInEditor).toHaveBeenCalled();
  });
});
