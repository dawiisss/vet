# Changelog

All notable changes to the Vet (Very Easy Terminal) project will be documented in this file.

---

## [1.0.0] - 2026-06-10

This release marks the initial major version milestone (`1.0.0`), featuring expanded Linux package support, a new About modal, improved application launch performance, and a streamlined installer.

### Added
* **About Modal**: Created a visually premium, glassmorphic About Modal displaying project metadata, built-in features, and licensing. Integrates with the Command Palette (`App: About Vet`), window TitleBar button, and ESC key handlers.
* **Expanded Linux Packaging Targets**: Configured `electron-builder` to bundle `.deb` (Debian/Ubuntu) and `.rpm` (RedHat/Fedora) packages alongside AppImage and tarball formats.
* **Release Installer (`install.sh`)**: Added a curl-compatible standalone installation script. It fetches the latest release assets from GitHub, installs the optimal format, downloads icons, and generates local desktop launchers.
* **Maintainer Configuration**: Added project author and support email configurations to package specifications to facilitate package building.

### Improved & Optimized
* **Lazy Loading**: Refactored major modal dialogs (Settings, History Viewer, Command Palette, File Preview, Clipboard Preview, and About Modal) to load dynamically, reducing startup loading latency.
* **Resize Performance**: Added debounced resizing handlers to the xterm.js `FitAddon` to reduce redraw overhead during rapid panel window changes.

### Fixed & Cleaned
* **Native Rebuild Compilations**: Configured `nan` package overrides to resolve compilation conflicts when building native dependencies under newer Electron environments.
* **Script Runner Testing**: Resolved unit test regressions in panels and runners by mocking workspace APIs and handling error states gracefully.
* **Repository Cleanup**: Removed unused test scripts, legacy configurations, and boilerplate workspace files to slim down source repository sizing.
