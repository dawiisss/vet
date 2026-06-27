# Changelog

All notable changes to this project will be documented in this file.

## [1.0.9] - 2026-06-27

### Fixed
- **FTS5 query injection in history search**: User-provided search queries are now sanitized before being passed to the SQLite FTS5 `MATCH` operator. Each term is double-quote escaped and wrapped, preventing special characters (`"`, `*`, `(`, `)`, `OR`, `NOT`) from causing FTS5 syntax parse errors and silent search failures.
- **Synchronous file I/O in updater handlers**: Replaced blocking `fs.existsSync` and `fs.writeFileSync` calls in `updaterHandlers.ts` with async `fs.promises.access` and `fs.promises.writeFile` to avoid blocking the Electron main thread during dev startup. Inline `require("fs")`/`require("path")` replaced with top-level ES imports.

### Changed
- **Docker shell allowlist validation**: The `dockerDefaultShell` config value in `connections.ts` is now validated against an allowlist of known shell paths (`/bin/bash`, `/bin/sh`, `/bin/zsh`, `/usr/bin/fish`, etc.) before interpolation into the Docker exec command string. Unrecognized values fall back to `/bin/bash`.
- **Adblocker window notification optimization**: Replaced `BrowserWindow.getAllWindows()` iteration in the high-frequency `request-blocked` handler and navigation reset handler in `adblocker.ts` with a direct `getMainWindow()` reference, eliminating unnecessary window enumeration on every blocked ad request. The `registerAdblockerIpcHandlers` function now accepts a `getMainWindow` getter, matching the existing `registerUpdaterHandlers` pattern.

## [1.0.8] - 2026-06-20

### Added
- **better-sqlite3 migration**: Replaced `node:sqlite` (`DatabaseSync`) with `better-sqlite3` for the history database, providing ~5-10x faster synchronous SQLite operations and significantly reduced main thread blocking.
- **WAL journal mode**: History database now uses WAL (Write-Ahead Logging) for improved concurrent read performance.
- **SQLite write performance (`synchronous = NORMAL`)**: Added `db.pragma("synchronous = NORMAL")` to database initialization to bypass immediate disk synchronization under WAL mode, dramatically optimizing write speeds.
- **Cached prepared statements**: Frequently-used SQL statements (`INSERT INTO sessions`, `INSERT INTO session_chunks`, `INSERT INTO session_search`, `UPDATE sessions SET closed_at`) are now prepared once at init and reused, eliminating per-call prepare overhead.
- **WAL checkpoint on shutdown**: `cleanupHistoryDb()` now checkpoints the WAL before closing, ensuring a clean `.db` file on exit.
- **`expandHome` utility**: Proper `~` and `~user` path expansion for workspace file operations, replacing fragile regex-based tilde expansion.
- **`logSensitivePathAccess` function**: Replaces the previously-unconditional `isPathAllowed()` (which always returned `true`) with a function that resolves and logs access to sensitive paths (`.ssh`, `.gnupg`, `.aws`, vet config) while still allowing full filesystem access.
- **`.agents/` and `.Jules/` in `.gitignore`**: Added per project's own convention.

### Fixed
- **Config password redaction for new SSH hosts**: New SSH hosts submitted with `__redacted__` passwords now have the key deleted rather than set to `""`, preventing accidental credential loss.
- **Docker shell `connectionTarget` off-by-one**: `args.indexOf("-it")` returning `-1` caused `args[0]` to be used as the container name. Now correctly handles missing `-it` flag.
- **`useConfigStore` race condition**: `isInitialized` was set to `true` synchronously before `configApi.get()` resolved. Moved into the `.then()` callback so the state reflects actual initialization.
- **Adblocker memory leak**: `blockedCounts` and `lastHostname` Maps now clean up on webview `destroyed` event instead of growing indefinitely.
- **LIKE wildcard injection in browser history search**: User-provided `%` and `_` characters in search queries are now escaped, and the `ESCAPE '\\'` clause is explicitly specified.
- **`structuredClone` instead of `JSON.parse(JSON.stringify(...))`**: Config deep cloning now uses `structuredClone()` instead of the lossy, slow JSON round-trip.
- **`process.env` spread drops `undefined` values**: Replaced unsafe `{ ...process.env } as Record<string, string>` with `Object.fromEntries(Object.entries(process.env).filter(...))` to correctly handle `undefined` env values.
- **Pre-existing `mainWindow` null bug**: `mainWindow = createWindow(isTransparent)` is now called before `initConfigManager(mainWindow)`, fixing a null pointer crash in the main process startup flow.
- **TitleBar Button Hover States**: Fixed an issue where inline `background` and `color` styles in `TitleBar.tsx` overrode the hover styles in `global.css` (caused by the removal of `!important` flags in version `1.0.7`), by moving base backgrounds and colors directly to CSS classes.
- **Welcome Modal Race Condition**: Fixed a race condition where the onboarding welcome modal would trigger on app startup before the persisted configuration was loaded from disk, by checking the config store's `isInitialized` state before evaluating `showIntroOnStartup`.
- **Adblocker catch block formatting**: Fixed the indentation formatting of the navigation error catcher block in `adblocker.ts`.
- **Deterministic sorting on history queries**: Modified history and chunk queries in `historyDb.ts` to include secondary sort keys (`s.id DESC` / `id ASC`) to ensure consistent sorting order and prevent test non-determinism.
- **Empty catch blocks annotated**: Added explanatory comments to previously-silent catch blocks in `adblocker.ts`, `sysinfo.ts`, `index.ts`, and `splitActions.ts`.
- **Debug log removed**: Removed `console.log("[adblocker] cosmetic filter for", url)` that fired on every cosmetic filter application.
- **`install.sh` version mismatch**: `FALLBACK_VERSION` updated from `1.0.6` to `1.0.7` to match `package.json`.
- **`EventEmitter.defaultMaxListeners` comment**: Added documentation explaining why the global override exists and that per-emitter limits are preferred.
- **`mainIndex.test.ts`**: Updated mocks for `electron` (added `shell`), `fs`, `json5`, and fixed `initAdblocker` assertion for lazy-loading change.
- **`sysinfo.test.ts`**: Added mocks for `../main/pty` (`getPtyPids`) and `app.getAppMetrics` to prevent ESM `uuid` import failure.
- **Prune batch size**: Size-based history pruning now deletes 100 sessions per iteration (up from 10), reducing loop iterations from potentially 1000 to 100.
- **Prune batch deletes wrapped in transaction**: Size-based deletes now use `db.transaction()` for atomicity.

### Changed
- **Workspace `DirectoryItem` interface**: Replaced `any[]` with a typed `DirectoryItem` interface in workspace directory listings.
- **`flushBuffer` transaction**: Manual `BEGIN TRANSACTION`/`COMMIT`/`ROLLBACK` replaced with `better-sqlite3`'s `db.transaction()` for automatic rollback on errors.
- **PRAGMA API**: All `db.exec("PRAGMA ...")` calls replaced with `db.pragma()` (better-sqlite3 idiomatic API; `getLogicalDatabaseSizeMb` now uses `{ simple: true }` for direct number returns).
- **Adblocker `web-contents-created`**: `wcId` is now captured outside the navigation handler so it's available in the `destroyed` cleanup listener.
- **Adblocker lists simplification**: Removed redundant/overlapping filter lists (AdGuard, Fanboy, and custom uBlock repos) and simplified to `@ghostery/adblocker-electron`'s consolidated `fullLists` CDN asset, optimizing memory, parsing speed, and network usage.
- **System Info Polling Split**: Polling logic in `sysinfo.ts` has been optimized. Fast-changing metrics (CPU, memory, network, disk IO, temperature) continue to poll every 2s, while slow-changing/static metrics (mounted disks size, battery, graphics info) are cached and queried only once every 10s, reducing system call and subprocess spawn CPU overhead.

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
