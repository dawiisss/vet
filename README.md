# Vet — Very Easy Terminal

Vet (Very Easy Terminal) is a lightweight, modular terminal emulator designed for Linux, macOS, and Windows. It provides a clean, visual-first terminal experience right out of the box with zero initial configuration required.

---

## Key Features

* **Flexible Pane Layouts**: Organize work using tabs and dynamic split-panes (horizontal and vertical) with smooth dragging. Extract any split pane to its own tab instantly.
* **Developer Toolbelt**: Access active ports, system diagnostics, a clipboards cache, a snippets manager, and interactive project scripts directly from the sidebar.
* **Session Persistence**: Automatically persist terminal session transcripts to a local SQLite database, allowing you to search, view, and replay historical sessions.
* **Connection Manager**: Configure and connect to SSH hosts and launch custom local shell profiles (like Node.js or Python REPLs).
* **Live Theme Configuration**: Swap built-in themes (such as Catppuccin, Nord, Dracula, and Solarized) or create custom color schemes via a live theme editor.
* **Modern Terminal Core**: Powered by GPU-accelerated WebGL rendering for fast text output, featuring rich URL/path detection and Sixel inline graphics support.

---

## Installation

### Automatic Installation (Linux)

You can install Vet instantly from the latest GitHub Release using this one-liner command:

```bash
curl -fsSL https://raw.githubusercontent.com/dawiisss/vet/dev/install.sh | bash
```

Alternatively, if you have cloned the repository locally, you can run the installer script manually:

```bash
./install.sh
```

### Manual Installation (Linux)

Alternatively, you can install one of the pre-packaged distribution formats from the `dist/` directory:

#### Debian / Ubuntu (`.deb`)
```bash
sudo apt install ./dist/vet_1.0.0_amd64.deb
```

#### RedHat / Fedora (`.rpm`)
```bash
sudo dnf install ./dist/vet-1.0.0.x86_64.rpm
```

#### AppImage (`.AppImage`)
Make the AppImage executable and run it directly:
```bash
chmod +x dist/Vet-1.0.0.AppImage
./dist/Vet-1.0.0.AppImage
```

---

## Configuration & Keybindings

Vet uses a hot-reloading JSON5 configuration file located at `~/.config/vet/config.json5`.

### Default Keybindings

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+P` | Toggle Command Palette |
| `Ctrl+,` | Toggle Settings Modal |
| `Ctrl+B` | Toggle Sidebar Panel |
| `Ctrl+Shift+T` | Open New Tab |
| `Ctrl+Shift+W` | Close Focused Tab |
| `Ctrl+Tab` | Next Tab |
| `Ctrl+Shift+Tab` | Previous Tab |
| `Ctrl+Shift+\` | Split Pane Horizontally |
| `Ctrl+Shift+D` | Split Pane Vertically |
| `Ctrl+Shift+E` | Extract Pane to New Tab |
| `Ctrl+Alt+U` | Unsplit Panes |
| `Alt+RightArrow` | Focus Next Split Pane |
| `Alt+LeftArrow` | Focus Previous Split Pane |
| `Ctrl+Shift+C` / `V` | Copy / Paste |
| `Ctrl+F` | Find in Terminal |
| `Ctrl+Shift+F` | Toggle Fullscreen |
| `Ctrl+Q` | Quit Application |

---

## Build from Source (Developers)

If you wish to compile or modify Vet locally:

### Prerequisites
* Node.js (v18+)
* npm

### Setup & Development
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Run Vet in development mode with live reload:
   ```bash
   npm run dev
   ```
3. Run test suites:
   ```bash
   npm run test
   ```
4. Build and package the production binaries:
   ```bash
   npm run dist:linux  # Package for Linux (.deb, .rpm, AppImage, tarball)
   npm run dist:win    # Package for Windows
   npm run dist:mac    # Package for macOS
   ```
