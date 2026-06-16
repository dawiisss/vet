# Changelog

All notable changes to this project will be documented in this file.

## [1.0.4] - 2026-06-17

### Added
- **Persistent Browser History**: Implemented automated web browsing history tracking. Visited pages are persisted in the SQLite history database with automatic deduplication of consecutive identical URLs and automatic database pruning.
- **Unified Sidebar History Panel**: Integrated a high-fidelity toggle control (`[ Terminal ] [ Browser ]`) in the sidebar **History** panel. Users can view, search (by URL or title), clear, and delete specific visited page records. Clicking a history item opens a new Web Browser tab navigated to that URL.
- **Browser Find-in-Page Overlay**: Integrated the reusable `SearchOverlay` component inside the sandboxed Web Browser view, enabling unified `Ctrl+F` text searching with match counts, Next/Previous controls, case-sensitivity toggles, and smooth dark-theme styling.
- **Browser DevTools Integration**: Added support for launching the guest browser's developer console directly via a new toolbar button (`</>`) or configurable keyboard shortcuts (defaulting to `F12`).
- **Command Palette Browser Actions**: Integrated **"Browser: Open Developer Tools"** and **"Browser: Find in Page"** commands into the Command Palette, appearing dynamically only when a browser pane/split is active.
- **Editable Keybindings**: Added `browser:devtools` to the Settings Keybindings list, allowing users to customize the devtools shortcut.
- **Community Standard Files**: Added a repository Code of Conduct (`CODE_OF_CONDUCT.md`) based on Contributor Covenant v2.1 and a Pull Request template (`.github/pull_request_template.md`).

### Fixed
- **Dependency Security Vulnerabilities**: Resolved all 18 moderate-security warnings for `js-yaml` (Dependabot Alert #4), the high-severity alert for `form-data` (Dependabot Alert #5), and the high-severity RCE alert for `esbuild` (Dependabot Alert #3) by adding nested dependency overrides.
- **pnpm v11 Configuration**: Migrated package overrides and build scripts allowance into a root `pnpm-workspace.yaml` to comply with pnpm v11 specification, resolving package manager warnings.
- **Detached Window Styling**: Fixed a bug where detached tabs lost the theme's CSS variables, resulting in an unstyled top bar layout. The detached container now receives the exact same theme variables style mapping.
- **Detached Web Browser Layout & State Preservation**: Fixed a bug where detaching or reattaching a web browser tab caused it to lose its layout (loading as an empty terminal) and reset to the homepage. The tab is now correctly reconstructed as a browser tab, and the active page URL is preserved using dynamic DOM query serializations.
- **TypeScript Ambient Type Resolution**: Added `src/types.d.ts` to the `include` arrays in `tsconfig.node.json` and `tsconfig.web.json`, fixing `Cannot find name` errors for ambient interfaces like `SftpApi`, `TerminalApi`, etc.
- **Terminal Write Return Type**: Corrected the `TerminalApi.write` return type from `Promise<void>` to `void` to match the fire-and-forget `ipcRenderer.send()` implementation.
- **Null Safety in Tab Extraction**: Added explicit null guard for `activeTabId` before passing it to `extractToTab()`, resolving a strict-mode type error.
- **SSH Host Type Narrowing**: Added a type guard filter on `config.sshHosts` in the command palette to handle the `SshHost | { name: string; command: string }` union, preventing property access errors on command-based SSH entries.

## [1.0.3] - 2026-06-16

### Added
- **Auto-Updater Integration**: Implemented a secure, user-controlled auto-updater for Windows (NSIS/ZIP) and Linux (AppImage) using `electron-updater`.
- **TitleBar Update Notification**: Added a download icon with a pulsing green notification badge next to the "About" button in the TitleBar that appears only when an update is available.
- **Dedicated Update Modal**: Created a high-fidelity modal that presents release details, release notes, and a live download progress bar (displaying percentage, download speed, and bytes transferred).
- **Update Simulator**: Added a simulation mode in development environments (accessible via "About Vet" developer controls) to allow end-to-end testing of the update flow (including live download animations and hot-relaunching).

### Fixed
- **Theme Accent Color Persistence**: Resolved a bug where the application highlight color (`--app-accent`) remained purple across different themes. Defined signature accent colors for all built-in themes (e.g., Frost Cyan for Nord, One Dark Blue for One Dark) and updated the accent resolution logic.
