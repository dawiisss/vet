# Changelog

All notable changes to the **Vet** terminal multiplexer and developer workspace application are documented in this file.

## [1.0.0] - 2026-06-03

### Added
- **Visual Theme Editor (Phase 11)**:
  - Added a visual theme customizer under the **Themes** tab in Settings.
  - Implemented an interactive grid of color pickers covering terminal background, foreground, cursor, selection, and the full 16 ANSI colors (normal and bright sets).
  - Integrated a live terminal HUD preview that updates colors in real-time.
  - Built custom theme management enabling users to create, clone, edit, and delete themes (persisted in `config.customThemes`).
- **Interactive Keybindings Manager (Phase 11)**:
  - Added a **Keybindings** tab in Settings showing all mappable action shortcuts.
  - Implemented a glassmorphic key recording HUD to intercept keystrokes and format them (e.g. `ctrl+shift+t`) for binding.
  - Added overlap check to unbind conflicting shortcuts automatically.
  - Replaced hardcoded hotkeys in the app shell with a dynamic event listener that matches against the active keybindings profile.
- **Active Workspace File Panel (Phase 9)**:
  - Integrated a workspace explorer displaying the active project directory structure.
  - Implemented PID tracking (`/proc/[pid]/cwd`) to automatically sync the explorer CWD with the focused terminal shell.
  - Enabled keyboard-driven navigation (`Ctrl+B` focuses the sidebar, `ArrowUp`/`ArrowDown` navigates list, `Enter` opens folder/preview).
  - Added file drag-and-drop to paste absolute paths directly into active shell prompts.
  - Created a glassmorphic **File Preview Modal** resolving double-scrollbars, adding arrow-key scroll focus, and allowing quick exit via `Escape`.
- **Advanced Terminal Grid & Multiplexing**:
  - Implemented node-pty backend to handle robust Linux PTY subprocess lifecycles.
  - Built a dynamic split layout engine (`SplitPane`/`SplitTree`) with click-and-drag resize borders, new tab creation, pane splitting, and keyboard-based pane traversal.
  - Integrated tabs manager (`TabBar`) to organize workspace environments.
- **System Utility Panels (Sidebar)**:
  - **Connections**: Quick connect profile managers.
  - **History**: SQLite3 persistent database collecting command histories with search.
  - **Port Monitor**: Active port scanner with local network sockets and corresponding process PIDs.
  - **Script Runner**: Easy script launcher dashboard to trigger builds and tasks.
  - **Snippet Library**: Copy-pastable shell commands and code block storage.
  - **System Monitor**: Real-time canvas/HUD showcasing CPU load, RAM usage, and disk space.
- **Command Palette & Search HUD**:
  - Integrated fuzzy search Command Palette to run operations via keyboard (`Ctrl+P` or custom shortcut).
  - Built inline terminal search overlay with case-sensitivity and regex capabilities.
