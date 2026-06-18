const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
};

const ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  send: jest.fn(),
};

const BrowserWindow = {
  fromWebContents: jest.fn(),
  getAllWindows: jest.fn(() => []),
};

function mockBrowserWindow() {
  return {
    id: Math.floor(Math.random() * 10000),
    isDestroyed: jest.fn(() => false),
    webContents: {
      send: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      setWindowOpenHandler: jest.fn(),
    },
    close: jest.fn(),
    minimize: jest.fn(),
    maximize: jest.fn(),
    unmaximize: jest.fn(),
    isMaximized: jest.fn(() => false),
    setVibrancy: jest.fn(),
    on: jest.fn(),
    loadURL: jest.fn(),
  };
}

const app = {
  getPath: jest.fn((name: string) => `/mock/home/${name}`),
  whenReady: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
  quit: jest.fn(),
};

const shell = {
  openExternal: jest.fn(),
  showItemInFolder: jest.fn(),
};

const contextBridge = {
  exposeInMainWorld: jest.fn(),
};

export {
  app,
  BrowserWindow,
  ipcMain,
  ipcRenderer,
  shell,
  contextBridge,
  mockBrowserWindow,
};
