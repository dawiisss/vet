# Terminal Emulator — Implementation Plan

## Stack
- **Runtime**: Electron (Chrome + Node.js)
- **Terminal Core**: xterm.js + addons
- **PTY**: node-pty
- **UI Framework**: React
- **Build**: Vite + electron-vite
- **Config**: JSON5 (hot-reload via chokidar)
- **IPC**: Electron contextBridge

## Architecture

```
Main Process                        Renderer Process
┌──────────────────────┐           ┌────────────────────────┐
│ ┌──────────────────┐ │  IPC      │ ┌───────────────────┐  │
│ │ node-pty (shell) │◄├──────────┤ │ xterm.js Terminal │  │
│ │ per tab/split    │ │           │ │ + addons          │  │
│ └──────────────────┘ │           │ └───────────────────┘  │
│ ┌──────────────────┐ │           │ ┌───────────────────┐  │
│ │ Config loader    │ │           │ │ React UI          │  │
│ │ (JSON5 + chokidar)│ │           │ │ (tabs, splits,   │  │
│ └──────────────────┘ │           │ │  settings panel)  │  │
│ ┌──────────────────┐ │           │ └───────────────────┘  │
│ │ Window mgr       │ │           └────────────────────────┘
│ │ (BrowserWindow,  │ │
│ │  tray, menus)    │ │
│ └──────────────────┘ │
└──────────────────────┘
```

## Completed Phases

### Completed — Phase 1: Skeleton
- [x] Init Electron + Vite + React project (electron-vite)
- [x] Main process: node-pty spawns a shell (bash/zsh), pipes stdout/stdin
- [x] Renderer: xterm.js fills a BrowserWindow
- [x] IPC bridge: pty data → terminal; keystrokes → pty; resize events
- [x] Verify: working shell, resize, copy/paste

### Completed — Phase 2: Tabs
- [x] Tab bar component in React
- [x] Tab creation, closure, and click/keyboard-driven switching
- [x] Dynamic tab titles matching folder and running process (`folder : process`) parsed natively on Linux/macOS
- [x] Instant/fast creation of initial shells

### Completed — Phase 3: Splits & Layout
- [x] Split panes (horizontal / vertical) within a tab
- [x] Draggable resize handles between splits
- [x] Extracting split pane into its own tab via UI button and shortcut (`Ctrl+Shift+E`)
- [x] Keyboard event propagation fixes preventing terminal autocomplete pollution during tab changes
- [x] Layout corruption fix on tab switch via `visibility: hidden` and absolute positioning

## Future Phases

### Phase 4 — Core Advanced & Terminal Features
- [ ] **WebGL Renderer & GPU Acceleration**: Integrate `@xterm/addon-webgl` for GPU-accelerated rendering. Implement fallback to 2D canvas if WebGL initialization fails or if dynamic themes change.
- [ ] **Rich URL & Path Detection**: Integrate `@xterm/addon-web-links` and custom regexp matchers to detect URLs, local paths, and lines (e.g., `src/main/index.ts:45`). Clicking opens the link in the default browser or directly at the target line in the editor.
- [ ] **Customizable Shell Profiles**: Support user-defined terminal profiles (e.g. Bash, Zsh, PowerShell, Node REPL). Enable custom startup command scripts, unique workspace environments, and predefined shell argument injections.
- [ ] **Aesthetic Window Vibrancy & Opacity**: Add dynamic opacity controls using macOS Vibrancy (`NSVisualEffectView`) and Windows Acrylic/Mica effects, adjustable via a real-time slider in the settings panel.
- [ ] **Sixel & Inline Images**: Integrate `@xterm/addon-image` to support Sixel graphics protocol. Allows CLI applications (like `neofetch`, `ranger`, or `lf`) to output graphics/images directly inline within the scrollback buffer.

### Phase 5 — Sidebar Developer Toolbelt
- [ ] **Active Port Monitor**: Side panel showing local listening ports and active sockets (runs `lsof -iTCP -sTCP:LISTEN` or `netstat`). Displays active PID, process name, and provides a quick "Kill Process" button that issues a `SIGKILL`.
- [ ] **System Diagnostics Dashboard**: Glassmorphic stats HUD reporting real-time CPU utilization, RAM usage, and active disk IO/throughput. Employs the `systeminformation` library in the main process to gather data and pipe it to the renderer via IPC.
- [ ] **Interactive Project Script Runner**: Scan the active workspace's root folder for a `package.json` file. Parse the `scripts` object and display run buttons in a sidebar UI panel to let users quickly spawn background compilation/dev jobs in splits or tabs.
- [ ] **Terminal Clipboard & Snippet Library**: Persist terminal copy actions to a styled Clipboard panel, and allow saving frequently-used CLI command sequences (e.g. `docker system prune -a --volumes`) as custom snippets with one-click injection.

### Phase 6 — Remote Connections & Virtualization
- [ ] **WSL & Docker Daemon Integration**: Automatically run discovery tasks on main process boot (e.g., executing `wsl.exe -l -v` on Windows and scanning Docker local sockets via `dockerode`). Dynamically create target profiles to run new sessions inside containers or VMs.
- [ ] **Integrated SSH Client Profiles**: Native remote host connection profiles (host, port, private key path, password). Uses `ssh2` in the main process to handle terminal streaming data and multiplex connections back to the xterm.js renderer.
- [ ] **SFTP File Explorer Sidebar**: A visual file system browser panel active during SSH terminal sessions. Supports directory traversal, file viewing, and drag-and-drop actions to download or upload local files over the SFTP protocol.

### Phase 7 — SQLite Database History & Virtual Scrollback
- [ ] **Structured Terminal History Database**: Replace raw `.bash_history` files with a SQLite database (using `better-sqlite3`). Log command text, exact timestamp, exit status code, working directory, and running duration.
- [ ] **Fuzzy Command Search UI**: Accessible terminal panel overlay (replacing `Ctrl+R`) showing filterable, paginated past executions with quick filter options ("only commands run in this directory").
- [ ] **Spill-to-Disk Virtual Scrollback Archive**: Handle large scrollback sizes (e.g. >100,000 lines) by shifting older rows from the active xterm.js instance memory into SQLite, loading them dynamically only when the user scrolls up.


## Key Dependencies

### package.json
```jsonc
{
  "dependencies": {
    // Terminal Core
    "xterm": "^5.x",
    "xterm-addon-webgl": "^0.x",
    "xterm-addon-search": "^0.x",
    "xterm-addon-unicode11": "^0.x",
    "xterm-addon-ligatures": "^0.x",
    "xterm-addon-web-links": "^0.x",
    "xterm-addon-image": "^0.x",

    // PTY & Connections
    "node-pty": "^1.x",
    "ssh2": "^1.x",
    "dockerode": "^4.x",

    // Utilities
    "systeminformation": "^5.x",
    "better-sqlite3": "^11.x",

    // UI
    "react": "^18.x",
    "react-dom": "^18.x",

    // Config
    "chokidar": "^4.x",
    "json5": "^2.x"
  },
  "devDependencies": {
    "electron": "^30.x",
    "electron-vite": "^2.x",
    "@vitejs/plugin-react": "^4.x",
    "typescript": "^5.x",
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x"
  }
}
```

## IPC API (contextBridge)

```typescript
// main → renderer
onTerminalData(terminalId: string, data: string)
onTerminalExit(terminalId: string, code: number)
onConfigChanged(config: Config)
onPtyError(terminalId: string, error: string)
onPortStatsChanged(ports: PortInfo[])
onSystemStats(stats: SystemStats)

// renderer → main
createTerminal(cwd?: string): Promise<string>
writeToTerminal(terminalId: string, data: string)
resizeTerminal(terminalId: string, cols: number, rows: number)
destroyTerminal(terminalId: string)
setConfig(path: string, value: unknown)
getConfig(): Promise<Config>
killProcess(pid: number): Promise<boolean>
getSshProfiles(): Promise<SshProfile[]>
connectSsh(profileId: string): Promise<string>
getHistory(query: string): Promise<HistoryItem[]>
```

## Config Schema (JSON5)

```json5
{
  shell: "/bin/zsh",
  fontFamily: "JetBrains Mono",
  fontSize: 13,
  fontLigatures: true,
  theme: {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    // ... 16 ANSI colors
  },
  opacity: 0.85,
  vibrancy: "dark", // dark | light | ultra-dark | none
  keybindings: {
    "ctrl+shift+t": "tab:new",
    "ctrl+shift+w": "tab:close",
    "ctrl+tab": "tab:next",
    "ctrl+shift+tab": "tab:prev",
  },
  cursorStyle: "block",      // block | underline | bar
  cursorBlink: true,
  copyOnSelect: false,
  profiles: [
    {
      id: "bash",
      name: "Bash Shell",
      shell: "/bin/bash",
      args: [],
      cwd: "~"
    }
  ]
}
```

