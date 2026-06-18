# Vet — Modern GPU-Accelerated Terminal Emulator & Developer Workspace

[![GitHub Release](https://img.shields.io/github/v/release/dawiisss/vet?color=blue&logo=github)](https://github.com/dawiisss/vet/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-blue.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![Electron Version](https://img.shields.io/badge/electron-%5E42.3.2-blue?logo=electron&logoColor=white)](https://www.electronjs.org)
[![React Version](https://img.shields.io/badge/react-%5E19.0.0-61dafb?logo=react&logoColor=black)](https://react.dev)
[![TypeScript Version](https://img.shields.io/badge/typescript-%5E5.7.0-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Adblock Engine](https://img.shields.io/badge/adblocker-ghostery-brightgreen.svg?logo=ghostery)](https://github.com/ghostery/adblocker)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?logo=git)](https://github.com/dawiisss/vet/pulls)

Vet (Very Easy Terminal) is a free, open-source, high-performance, cross-platform(Linux mainly) terminal emulator and developer productivity workspace built on **Electron**, **React**, and **TypeScript**. Designed for software engineers, systems administrators, DevOps professionals, and power users, Vet combines a GPU-accelerated command-line interface (CLI) with a suite of integrated tools—including a secure ad-blocking web browser, a remote SSH/SFTP connection manager, and live system monitoring—to deliver a unified, zero-config workspace.

Windows build is provided, but no support will be provided for it at the moment.

---

## Table of Contents

1. [Key Value Propositions](#key-value-propositions)
2. [Features Breakdown](#features-breakdown)
   * [1. GPU-Accelerated Terminal](#1-gpu-accelerated-cross-platform-terminal-emulator)
   * [2. Multi-Tab and Split-Pane Layouts](#2-multi-tab-and-split-pane-layouts-tiling-manager)
   * [3. Integrated SSH and SFTP Client](#3-integrated-ssh-and-sftp-client)
   * [4. Sandboxed Web Browser](#4-sandboxed-web-browser-with-ghostery-adblocker)
   * [5. Developer Sidebar and Port Monitor](#5-developer-sidebar-and-port-monitor)
   * [6. SQLite-Based Terminal and Browser History](#6-sqlite-based-terminal-and-browser-history)
   * [7. Interactive Onboarding](#7-interactive-onboarding-and-real-time-customizer)
   * [8. Automated Application Updates](#8-automated-application-updates)
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
* **Workspace Session Persistence**: Automatically saves and restores your complex tiling layouts, active tabs, split panes, and web browser sessions across application restarts.
* **Flexible Window Tiling**: Arrange tabs and split-panes dynamically. Easily drag-and-drop tabs, split terminal panes horizontally or vertically, and extract split panes into separate tabs.
* **Interactive Onboarding Welcome Guide**: A multi-slide introductory carousel (`IntroModal`) displaying key app features on startup, complete with an interactive theme selector to customize Vet's styling in real time.
* **Built-in SSH & SFTP Manager**: Securely save SSH hosts, connect to remote servers, and transfer files via an integrated SFTP client.
* **Integrated Ad-Blocking Browser**: Browse documentation and web applications side-by-side with your terminal in a sandboxed browser powered by `@ghostery/adblocker-electron`.
* **Developer Productivity Toolbelt**: Monitor active network ports, view live CPU/RAM metrics, access clipboard history, manage snippets, and run project scripts directly from the sidebar.
* **SQLite Session Transcripts**: Automatically log full terminal transcripts to a local SQLite database for search, audit trails, and historical playback.
* **Automated Update Engine**: Secure background updates with `electron-updater`, custom TitleBar notifications, download progress monitoring, and seamless hot-relaunching.
* **Hot-Reloadable Configuration**: Customize keyboard shortcuts, fonts, browser settings, and themes (like Catppuccin, Nord, and Dracula) via a live-updating `config.json5` configuration file.

---

## Features Breakdown

### 1. GPU-Accelerated Cross-Platform Terminal Emulator
Vet provides a fast, responsive command-line interface on Linux, macOS, and Windows. Utilizing WebGL rendering, it handles high-throughput logs and text processing without lag. Features include URL/path detection, customizable scrollback limits, and native node-pty integrations.

### 2. Multi-Tab and Split-Pane Layouts (Tiling Manager)
Customize your terminal layout dynamically. Split panes vertically or horizontally, resize panels with smooth drag handles, and extract individual panes to standalone tabs instantly to stay organized.

### 3. Integrated SSH and SFTP Client
Ditch standalone SSH managers. Vet includes a secure connection manager allowing you to configure SSH profiles, launch remote terminal sessions, and use the integrated SFTP panel to upload and download files.

### 4. Sandboxed Web Browser with Ghostery Adblocker
Search developer documentation, Stack Overflow, or local web servers directly inside Vet. The sandboxed webview browser comes equipped with a Ghostery-powered adblocker that blocks tracking scripts, cookie popups, and ads automatically. Supports in-page text searching (`Ctrl+F` search overlay with match counters) and developer tools inspection (`F12` or the toolbar button `</>`).

### 5. Developer Sidebar and Port Monitor
Stay updated on your environment. The developer sidebar provides a clipboards cache, a snippets manager, a live system diagnostics panel, an active network ports inspector, a script launcher for running `npm`/`pnpm`/`yarn` scripts, and a unified terminal/browser **History Panel** with search and tab toggles.

### 6. SQLite-Based Terminal and Browser History
Every terminal session transcript and browser page navigation is indexed and saved to a local SQLite database. Visited pages are tracked with consecutive URL deduplication and auto-pruning. Search your commands or browser navigation records, run audit checks, or replay transcripts at any time.

### 7. Interactive Onboarding and Real-Time Customizer
New users are introduced to Vet's features upon launch with a beautiful welcome modal tutorial. The tutorial features a live theme previewer, letting you customize your workspace theme (Dracula, Nord, Catppuccin, One Dark) instantly on boot. You can relaunch the guide at any time from the About modal or the Command Palette.

### 8. Automated Application Updates
Vet includes a secure, user-controlled auto-updater for Windows (NSIS/ZIP) and Linux (AppImage). When a new release is published, a pulsing green update badge appears in the TitleBar. Click it to open the dedicated Update Modal, view release notes, and track the download progress (percentage, transfer speed, and downloaded bytes) before hot-relaunching.

---

## Technology Stack

* **Frontend Framework**: [React](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
* **Shell Integration**: [Electron](https://www.electronjs.org/) & [Node-PTY](https://github.com/microsoft/node-pty)
* **Terminal Engine**: [Xterm.js](https://xtermjs.org/) (WebGL, Ligatures, Search, WebLinks)
* **Database**: [SQLite](https://sqlite.org/) (for session persistence and history logs)
* **Security & Ad-blocking**: [Ghostery Adblocker Engine](https://github.com/ghostery/adblocker)
* **Auto-Updater**: [electron-updater](https://www.electron.build/auto-update)

---

## Installation

### Automated Installer (Linux)
Install Vet instantly using our automated bash script:
```bash
curl -fsSL https://raw.githubusercontent.com/dawiisss/vet/main/install.sh | bash
```

### Manual Package Installation
Download distribution-specific binaries from the GitHub releases page:

* **Debian / Ubuntu (`.deb`)**:
  ```bash
  sudo apt install ./dist/vet_1.0.5_amd64.deb
  ```
* **RedHat / Fedora (`.rpm`)**:
  ```bash
  sudo dnf install ./dist/vet-1.0.5.x86_64.rpm
  ```
* **Portable AppImage (`.AppImage`)**:
  ```bash
  chmod +x dist/Vet-1.0.5.AppImage
  ./dist/Vet-1.0.5.AppImage
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
| `Ctrl+F` | Find Text in Terminal / Web Browser |
| `F12` | Toggle Web Browser Developer Tools (Configurable) |
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
