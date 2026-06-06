# Vet

A feature-rich terminal emulator.

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

## Features

### Completed Phases

#### Phase 1: Skeleton
- Init Electron + Vite + React project (electron-vite)
- Main process: node-pty spawns a shell (bash/zsh), pipes stdout/stdin
- Renderer: xterm.js fills a BrowserWindow
- IPC bridge: pty data → terminal; keystrokes → pty; resize events
- Verify: working shell, resize, copy/paste

#### Phase 2: Tabs
- Tab bar component in React
- Tab creation, closure, and click/keyboard-driven switching
- Dynamic tab titles matching folder and running process (`folder : process`) parsed natively on Linux/macOS
- Instant/fast creation of initial shells

#### Phase 3: Splits & Layout
- Split panes (horizontal / vertical) within a tab
- Draggable resize handles between splits
- Extracting split pane into its own tab via UI button and shortcut (`Ctrl+Shift+E`)
- Keyboard event propagation fixes preventing terminal autocomplete pollution during tab changes
- Layout corruption fix on tab switch via `visibility: hidden` and absolute positioning

### Planned Phases

#### Phase 4: Core Advanced & Terminal Features
- WebGL Renderer & GPU Acceleration
- Rich URL & Path Detection
- Customizable Shell Profiles
- Aesthetic Window Vibrancy & Opacity
- Sixel & Inline Images

#### Phase 5: Sidebar Developer Toolbelt
- Active Port Monitor
- System Diagnostics Dashboard
- Interactive Project Script Runner
- Terminal Clipboard & Snippet Library

#### Phase 6: Remote Connections & Virtualization
- WSL & Docker Daemon Integration
- Integrated SSH Client Profiles
- SFTP File Explorer Sidebar

#### Phase 7: SQLite Database History & Virtual Scrollback
- Structured Terminal History Database
- Fuzzy Command Search UI
- Spill-to-Disk Virtual Scrollback Archive


### Sixel & Inline Images

Vet supports the [Sixel](https://en.wikipedia.org/wiki/Sixel) graphics protocol, enabling the terminal to render high-resolution images directly in the console output. This is possible through `@xterm/addon-image`.

**Why Sixel?**
Instead of forcing you to leave the terminal to view graphical files, Sixel encodes image data into standard text output sequences. This creates a richer command-line experience where visual context (e.g., charts, photos, or diagrams) lives immediately next to your commands.

**How to use it:**
You can use tools that support Sixel output to display images in the terminal. For example:
- **ImageMagick**: View images via `img2txt` or `magick display`
- **Neofetch / Fastfetch**: Display high-quality logos next to your system info by configuring them to use Sixel backend:
  ```bash
  neofetch --sixel /path/to/image.png
  ```
- **lsix**: An `ls` clone that shows image thumbnails directly in your terminal.

## Getting Started

### Prerequisites

Ensure you have Node.js and npm installed.

### Installation

Clone the repository and install dependencies:

```bash
npm install
```

### Scripts

Run the project in development mode:
```bash
npm run dev
```

Build the project:
```bash
npm run build
```

Preview the build:
```bash
npm run preview
```

Run tests:
```bash
npm run test
```

Typecheck:
```bash
npm run typecheck
```

Build and package for distribution:
```bash
npm run dist        # Current platform
npm run dist:linux  # Linux
npm run dist:win    # Windows
npm run dist:mac    # macOS
```
