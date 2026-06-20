# Changelog

All notable changes to this project will be documented in this file.

## [1.0.7] - 2026-06-20

### Added
- **Dedicated Test Suites**: Added new test suites [adblocker.test.ts](file:///home/dawiisss/Documents/GitHub/vet2/src/__tests__/adblocker.test.ts) and [sftp.test.ts](file:///home/dawiisss/Documents/GitHub/vet2/src/__tests__/sftp.test.ts) to cover critical adblocking and SFTP connection logic.
- **Cross-Platform CI**: Added Windows (matrix) testing to [ci.yml](file:///home/dawiisss/Documents/GitHub/vet2/.github/workflows/ci.yml) to detect cross-platform compile/runtime errors.
- **Advanced System Metrics**: Expanded the System Metrics tab to monitor real-time network speeds, disk read/write throughput rates, graphics (GPU) usage and temperature, battery charging levels, and Vet's own CPU/RAM resource footprint.
- **Visual Dashboard Cards**: Redesigned the metrics panel into beautiful, theme-aligned dashboard cards with clean progress indicators and custom scrollbars.

### Fixed
- **History Database Pruning**: Resolved the infinite loop and size-based pruning bug using logical database page metrics and replaced synchronous blocking `VACUUM` commands with incremental vacuuming.
- **IPC Security Redaction**: Redacted plaintext SSH passwords/passphrases sent over IPC in renderer config queries, and securely merged them in the main process when setting configurations.
- **Path Traversal Warnings**: Enforced warning telemetry on sensitive path operations (such as `.ssh` and `.gnupg` access) inside workspace directory listings.
- **Terminal Session Ownership**: Implemented terminal write and destroy ownership checks via sender verification.
- **Shell Validation Bypass**: Removed executable verification bypasses and implemented a user-configurable whitelist option.
- **Lifecycle Resource Leaks**: Fixed event listener and process/interval leaks by establishing explicit cleanup handlers (`FSWatcher`, sysinfo pollers, adblocker webRequest events, updater intervals, SFTP connections) triggered on app quit.
- **Jest Test Compilation**: Created [tsconfig.test.json](file:///home/dawiisss/Documents/GitHub/vet2/tsconfig.test.json) to resolve TS5023 `files` override issues in Jest diagnostic runs, and fixed the `fs` mock issue in `pty.test.ts`.
- **CSS Hover Variables**: Removed `!important` flags from hover classes to restore CSS theme customizability, and scoped `.extract-btn` positioning rules to `.terminal-container`.
- **Assertion-Less and Empty Tests**: Added valid assertions to tab-switching tests in `Sidebar.test.tsx` and rendering assertions to `SnippetLibraryPanel`.
- **TypeScript Strict Warnings**: Resolved all remaining compiler errors and warnings in both node and web renderer processes (e.g. missing `shell` import, strict size destructuring, and undefined object properties).
- **Disk Space Partition Deduplication**: Filtered out non-physical virtual filesystems (e.g. `efivarfs`, `tmpfs`, loop/FUSE mounts) and deduplicated multiple mounts mapping to the same physical device partition (such as Btrfs subvolumes).

### Changed
- **Shared Utilities Refactoring**: Extracted duplicated `pathsEqual`, directory sort, and default browser homepage strings into a single shared utility [pathUtils.ts](file:///home/dawiisss/Documents/GitHub/vet2/src/shared/utils/pathUtils.ts) consumed by both main and renderer processes.
- **Removed macOS targets**: Excluded unsupported macOS build tasks from `package.json` and workflow scripts.
- **Top-Level Imports**: Cleaned up inline require statements in `index.ts` and `session.ts` to improve dependency loading performance.

## [1.0.5] - 2026-06-18

### Added
- **User Onboarding Welcome Guide**: Designed and implemented an interactive, multi-slide onboarding welcome guide (`IntroModal`) to showcase key features on startup (Multi-Pane Splits, Web Browser, Sidebar panels, Command Palette, SQLite History, and Keyboard Shortcuts).
- **Live Theme Customizer**: Added a live theme selector on the final onboarding slide to let users preview and select built-in application themes (Dracula, Nord, Catppuccin, One Dark) in real time.
- **Onboarding Config Persistence**: Saved the onboarding state (`showIntroOnStartup`) to `config.json5` so the welcome guide won't reappear on launch once skipped or completed, but remains replayable via the About Modal and Command Palette.

### Fixed
- **Session Layout Persistence**: Wired up window terminal API session saving and loading to automatically persist and restore complex tab and split-pane layouts across app restarts.
- **React Key Collision & Tab Counters**: Fixed duplicate tab key warnings (e.g. duplicate `tab-2` keys) on session restoration by migrating tab ID and shell counters to Zustand state, resolving circular dependency initialization issues between `useTabStore.ts` and `tabActions.ts`.
- **Fastfetch/Startup Size Persistence**: Fixed rendering layout artifacts and horizontal clipping on startup commands (like `fastfetch`) in narrow/midsize terminals by calculating estimated dimensions from Electron window bounds on spawn and executing initial ResizeObserver layouts instantly (without 50ms debounces).

### Changed
- **Major Refactoring and Architecture Improvements**:
  - **Preload Isolation & Dry IPC**: Reduced preload code by 150+ lines using declarative factory helpers (`invoke`, `send`, `on`).
  - **God Component Decompositions**: Split the giant 800+ lines `App.tsx` into clean components: `AppShell` container, `ThemeProvider` CSS injector, `ModalManager`, and a `useKeybindings` hook.
  - **useTabStore Split**: Decomposed `useTabStore.ts` by extracting action files for tab CRUD, split pane layout, and window detaching, fixing tab hibernation bugs.
  - **Terminal Lifecycle Extraction**: Moved all xterm and fit/webgl/links/image addon lifecycle/mounting logic into a reusable `useTerminal` hook.
  - **Local/SSH PTY Isolation**: Separated local PTY spawning from SSH PTY spawning in `pty.ts` and `sshPty.ts`, fixing memory leaks on exit.
  - **Standardized UI Components**: Created reusable shared `<Panel>`, `<SettingsField>`, and `<ModalOverlay>` components, consolidating backdrop/ESC/focus-trap behaviors.
  - **Custom useSearchableList Hook**: Extracted list filtering and keyboard selection/scrolling logic into a custom hook consumed by the Command Palette and Clipboard.
  - **Declarative Sidebar Mapping**: Replaced duplicate JSX blocks in `Sidebar.tsx` with a mapped array configuration.
  - **Runtime Config Validation**: Implemented settings sanitization/clamping and syntax error broadcasting (`config:error`) via IPC, rendering warnings on a non-disruptive banner.
  - **Stricter Type Safety**: Enabled strict TypeScript flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) in all config files and resolved all compiler issues.
  - **CSS Design Tokens**: Added font-size, spacing, border-radius, shadows, and transitions scales to `global.css` and replaced hardcoded values.
  - **ESLint React Config**: Configured `react: { version: "detect" }` in the flat ESLint configuration to enable hooks lint checks.

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
- **Browser Split Pane Navigation & Loops**: Fixed issues with Electron webview browser panes where splitting a tab resulted in the split pane opening the homepage instead of preserving the current page URL. Resolved double-loading abort errors on mount and resolved navigation loops (spamming back-and-forth between a new URL and the homepage) by removing legacy navigation override checks.
- **Browser Split Pane Focus & Context Menu**: Captured standard DOM focus and mousedown events inside `<webview>` elements to ensure that clicking inside a webview correctly updates the active focused pane and keeps keyboard input correctly routed. Also added context menu close support for browser panes.

## [1.0.3] - 2026-06-16

### Added
- **Auto-Updater Integration**: Implemented a secure, user-controlled auto-updater for Windows (NSIS/ZIP) and Linux (AppImage) using `electron-updater`.
- **TitleBar Update Notification**: Added a download icon with a pulsing green notification badge next to the "About" button in the TitleBar that appears only when an update is available.
- **Dedicated Update Modal**: Created a high-fidelity modal that presents release details, release notes, and a live download progress bar (displaying percentage, download speed, and bytes transferred).
- **Update Simulator**: Added a simulation mode in development environments (accessible via "About Vet" developer controls) to allow end-to-end testing of the update flow (including live download animations and hot-relaunching).

### Fixed
- **Theme Accent Color Persistence**: Resolved a bug where the application highlight color (`--app-accent`) remained purple across different themes. Defined signature accent colors for all built-in themes (e.g., Frost Cyan for Nord, One Dark Blue for One Dark) and updated the accent resolution logic.
