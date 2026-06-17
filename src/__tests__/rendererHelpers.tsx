/**
 * @jest-environment jsdom
 */

import "../types";

import "@testing-library/jest-dom";
import { jest } from "@jest/globals";

const terminalApi = {
  create: jest.fn(() => Promise.resolve({ id: "test-terminal-1" })),
  enableForwarding: jest.fn(() => Promise.resolve()),
  write: jest.fn(() => Promise.resolve()),
  resize: jest.fn(() => Promise.resolve()),
  getHistory: jest.fn(() => Promise.resolve("")),
  destroy: jest.fn(() => Promise.resolve()),
  detachTab: jest.fn(() => Promise.resolve({ success: true })),
  reattachTab: jest.fn(() => Promise.resolve({ success: true })),
  getTerminalInfo: jest.fn(() =>
    Promise.resolve({ title: "projects : bash", cwd: "/home/user/projects" } as { title: string; cwd: string; sshHostId?: string }),
  ),
  onData: jest.fn(() => jest.fn()),
  onExit: jest.fn(() => jest.fn()),
  onReattachTab: jest.fn(() => jest.fn()),
  saveSession: jest.fn(() => Promise.resolve()),
  getSession: jest.fn(() => Promise.resolve(null)),
};

const windowApi = {
  minimize: jest.fn(() => Promise.resolve()),
  maximize: jest.fn(() => Promise.resolve()),
  close: jest.fn(() => Promise.resolve()),
  isMaximized: jest.fn(() => Promise.resolve(false)),
  openExternal: jest.fn(() => Promise.resolve()),
  onMaximizeChange: jest.fn(() => jest.fn()),
  getVersion: jest.fn(() => Promise.resolve("1.0.2")),
};

const configApi = {
  get: jest.fn(() =>
    Promise.resolve({
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
    } as Config),
  ),
  set: jest.fn(() => Promise.resolve()),
  openInEditor: jest.fn(() => Promise.resolve()),
  onChanged: jest.fn(() => jest.fn()),
};

const historyApi = {
  search: jest.fn(() => Promise.resolve([])),
  getSessions: jest.fn(() => Promise.resolve([])),
  getSessionTranscript: jest.fn(() => Promise.resolve("")),
  getScrollbackChunk: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(() => Promise.resolve()),
  deleteSession: jest.fn(() => Promise.resolve()),
};

const workspaceApi = {
  getScripts: jest.fn(() => Promise.resolve(null)),
  listDir: jest.fn(() => Promise.resolve([] as WorkspaceItem[])),
  revealPath: jest.fn(() => Promise.resolve()),
  readFileHead: jest.fn(() => Promise.resolve("")),
};

const sysinfoApi = {
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  onUpdate: jest.fn(() => jest.fn()),
};

const portsApi = {
  list: jest.fn(() => Promise.resolve([])),
  kill: jest.fn(() => Promise.resolve(true)),
};

const connectionsApi = {
  getSshHosts: jest.fn(() => Promise.resolve([])),
  getDockerContainers: jest.fn(() => Promise.resolve([])),
};

const clipboardApi = {
  getHistory: jest.fn(() => Promise.resolve([])),
  setHistory: jest.fn(() => Promise.resolve()),
};

export function setupMockedApis() {
  Object.defineProperty(window, "terminalApi", {
    value: terminalApi,
    configurable: true,
  });
  Object.defineProperty(window, "windowApi", {
    value: windowApi,
    configurable: true,
  });
  Object.defineProperty(window, "configApi", {
    value: configApi,
    configurable: true,
  });
  Object.defineProperty(window, "historyApi", {
    value: historyApi,
    configurable: true,
  });
  Object.defineProperty(window, "workspaceApi", {
    value: workspaceApi,
    configurable: true,
  });
  Object.defineProperty(window, "sysinfoApi", {
    value: sysinfoApi,
    configurable: true,
  });
  Object.defineProperty(window, "portsApi", {
    value: portsApi,
    configurable: true,
  });
  Object.defineProperty(window, "connectionsApi", {
    value: connectionsApi,
    configurable: true,
  });
  Object.defineProperty(window, "clipboardApi", {
    value: clipboardApi,
    configurable: true,
  });
  Object.defineProperty(window, "serializeAddons", {
    value: new Map(),
    configurable: true,
  });

  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    };
  }
}

export function resetMockedApis() {
  const apis = [
    terminalApi,
    windowApi,
    configApi,
    historyApi,
    workspaceApi,
    sysinfoApi,
    portsApi,
    connectionsApi,
    clipboardApi,
  ];
  apis.forEach((api) => {
    Object.values(api).forEach((v) => {
      if (jest.isMockFunction(v)) v.mockClear();
    });
  });
}

export {
  terminalApi,
  windowApi,
  configApi,
  historyApi,
  workspaceApi,
  sysinfoApi,
  portsApi,
  connectionsApi,
  clipboardApi,
};
