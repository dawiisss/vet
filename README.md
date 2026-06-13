# Vet — Modern GPU-Accelerated Terminal Emulator & Developer Workspace

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-blue.svg)](https://nodejs.org)
[![Platform Compatibility](https://img.shields.io/badge/platform-linux-lightgrey.svg)](https://github.com/dawiisss/vet)
[![Adblock Engine](https://img.shields.io/badge/adblocker-ghostery-brightgreen.svg)](https://github.com/ghostery/adblocker)

Vet (Very Easy Terminal) is a free, open-source, high-performance, cross-platform terminal emulator and developer productivity workspace built on **Electron**, **React**, and **TypeScript**. Designed for software engineers, systems administrators, DevOps professionals, and power users, Vet combines a GPU-accelerated command-line interface (CLI) with a suite of integrated tools—including a secure ad-blocking web browser, a remote SSH/SFTP connection manager, and live system monitoring—to deliver a unified, zero-config workspace.

---

## Table of Contents

1. [Key Value Propositions](#key-value-propositions)
2. [Features Breakdown](#features-breakdown)
   * [1. GPU-Accelerated Terminal](#1-gpu-accelerated-cross-platform-terminal-emulator)
   * [2. Multi-Tab & Split-Pane Layouts](#2-multi-tab--split-pane-layouts-tiling-manager)
   * [3. Integrated SSH and SFTP Client](#3-integrated-ssh-and-sftp-client)
   * [4. Sandboxed Web Browser](#4-sandboxed-web-browser-with-ghostery-adblocker)
   * [5. Developer Sidebar & Port Monitor](#5-developer-sidebar--port-monitor)
   * [6. SQLite Session Logs](#6-sqlite-based-terminal-session-logs)
3. [Technology Stack](#technology-stack)
4. [Installation](#installation)
5. [Default Keyboard Shortcuts](#default-keyboard-shortcuts)
6. [Configuration](#configuration)
7. [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)
8. [Contributing & Community](#contributing--community)
9. [License](#license)

---

## Key Value Propositions

* **GPU-Accelerated Command-Line**: Powered by `xterm.js` and WebGL rendering for ultra-low-latency text output, supporting font ligatures, Unicode 11, Sixel graphics, and advanced regex text search.
* **Flexible Window Tiling**: Arrange tabs and split-panes dynamically. Easily drag-and-drop tabs, split terminal panes horizontally or vertically, and extract split panes into separate tabs.
* **Built-in SSH & SFTP Manager**: Securely save SSH hosts, connect to remote servers, and transfer files via an integrated SFTP client.
* **Integrated Ad-Blocking Browser**: Browse documentation and web applications side-by-side with your terminal in a sandboxed browser powered by `@ghostery/adblocker-electron`.
* **Developer Productivity Toolbelt**: Monitor active network ports, view live CPU/RAM metrics, access clipboard history, manage snippets, and run project scripts directly from the sidebar.
* **SQLite Session Persistence**: Automatically log full terminal transcripts to a local SQLite database for search, audit trails, and historical playback.
* **Hot-Reloadable Configuration**: Customize keyboard shortcuts, fonts, browser settings, and themes (like Catppuccin, Nord, and Dracula) via a live-updating `config.json5` configuration file.

---

## Features Breakdown

### 1. GPU-Accelerated Cross-Platform Terminal Emulator
Vet provides a fast, responsive command-line interface on Linux, macOS, and Windows. Utilizing WebGL rendering, it handles high-throughput logs and text processing without lag. Features include URL/path detection, customizable scrollback limits, and native node-pty integrations.

### 2. Multi-Tab & Split-Pane Layouts (Tiling Manager)
Customize your terminal layout dynamically. Split panes vertically or horizontally, resize panels with smooth drag handles, and extract individual panes to standalone tabs instantly to stay organized.

### 3. Integrated SSH and SFTP Client
Ditch standalone SSH managers. Vet includes a secure connection manager allowing you to configure SSH profiles, launch remote terminal sessions, and use the integrated SFTP panel to upload and download files.

### 4. Sandboxed Web Browser with Ghostery Adblocker
Search developer documentation, stack overflow, or local web servers directly inside Vet. The sandboxed webview browser comes equipped with a Ghostery-powered adblocker that blocks tracking scripts, cookie popups, and ads automatically.

### 5. Developer Sidebar & Port Monitor
Stay updated on your environment. The developer sidebar provides a clipboards cache, a snippets manager, a live system diagnostics panel, an active network ports inspector, and a script launcher for running `npm`/`pnpm`/`yarn` scripts.

### 6. SQLite-Based Terminal Session Logs
Every terminal session is indexed and saved to a local SQLite database. Search your commands, run audit checks, or replay full historical transcripts of past sessions at any time.

---

## Technology Stack

* **Frontend Framework**: [React](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
* **Shell Integration**: [Electron](https://www.electronjs.org/) & [Node-PTY](https://github.com/microsoft/node-pty)
* **Terminal Engine**: [Xterm.js](https://xtermjs.org/) (WebGL, Ligatures, Search, WebLinks)
* **Database**: [SQLite](https://sqlite.org/) (for session persistence)
* **Security & Ad-blocking**: [Ghostery Adblocker Engine](https://github.com/ghostery/adblocker)

---

## Installation

### Automated Installer (Linux)
Install Vet instantly using our automated bash script:
```bash
curl -fsSL https://raw.githubusercontent.com/dawiisss/vet/main/install.sh | bash
```

### Manual Package Installation
Download distribution-specific binaries from the `dist/` folder:

* **Debian / Ubuntu (`.deb`)**:
  ```bash
  sudo apt install ./dist/vet_1.0.2_amd64.deb
  ```
* **RedHat / Fedora (`.rpm`)**:
  ```bash
  sudo dnf install ./dist/vet-1.0.2.x86_64.rpm
  ```
* **Portable AppImage (`.AppImage`)**:
  ```bash
  chmod +x dist/Vet-1.0.2.AppImage
  ./dist/Vet-1.0.2.AppImage
  ```

---

## Default Keyboard Shortcuts

| Shortcut | Description |
| --- | --- |
| `Ctrl+Shift+P` | Open Command Palette |
| `Ctrl+,` | Open Settings Manager |
| `Ctrl+B` | Toggle Sidebar Panels |
| `Ctrl+Shift+T` | Open New Tab |
| `Ctrl+Shift+W` | Close Focused Tab |
| `Ctrl+Tab` | Switch to Next Tab |
| `Ctrl+Shift+Tab` | Switch to Previous Tab |
| `Ctrl+Shift+\` | Split Pane Horizontally |
| `Ctrl+Shift+D` | Split Pane Vertically |
| `Ctrl+Shift+E` | Extract Pane to New Tab |
| `Ctrl+Alt+U` | Unsplit Active Panes |
| `Alt+RightArrow` | Focus Next Split Pane |
| `Alt+LeftArrow` | Focus Previous Split Pane |
| `Ctrl+Shift+C` / `V` | Copy / Paste Clipboard |
| `Ctrl+F` | Find Text in Terminal |
| `Ctrl+Shift+F` | Toggle Fullscreen Mode |
| `Ctrl+Q` | Quit Application |

---

## Configuration

Vet configurations are stored in `~/.config/vet/config.json5` and hot-reload instantly. Configure settings including:
* Fonts (family, size, line-height).
* Browser homepage and search engine options.
* Adblocker filtering configuration.
* Terminal scrollback limits and default shell paths.
* Keybindings and custom color themes.

---

## Frequently Asked Questions (FAQ)

### Is Vet a GPU-accelerated terminal emulator?
Yes, Vet uses the WebGL renderer addon of Xterm.js to offload text rendering to the GPU, offering lag-free performance even when tailing large server logs.

### Can I manage SSH and SFTP connections inside Vet?
Yes, Vet features a native connection manager to configure SSH profiles. It also includes an integrated SFTP client, permitting file transfers between your local machine and remote servers without leaving the app.

### How does the ad-blocking web browser in Vet work?
The embedded browser uses Electron's webview and integrates the Ghostery ad-blocking engine with EasyList and uBlock filter lists. It runs entirely in a sandboxed process, blocking advertisements and tracking pixels natively.

### Where are terminal session transcripts saved?
All terminal sessions are saved locally to an SQLite database on your machine (located in the application data directory). Transcripts are fully searchable and can be reviewed or replayed.

---

## Contributing & Community

Contributions to Vet are highly appreciated! Please review our **[Contributing Guidelines](./CONTRIBUTING.md)** for details on coding standards, local development workflows, and pull request submissions.

For additional support, security inquiries, and software licensing:
* **[Security Policy](./SECURITY.md)**: Guidelines on reporting vulnerabilities responsibly.
* **[Get Support](./SUPPORT.md)**: Channels for questions, troubleshooting, and discussions.
* **[Third-Party Acknowledgements](./ACKNOWLEDGEMENTS.md)**: License credits for our bundled open-source dependencies.

---

## License

Vet is distributed under the MIT License. See [LICENSE](./LICENSE) for more details.
