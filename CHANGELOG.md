# Changelog

All notable changes to this project will be documented in this file.

## [1.0.3] - 2026-06-16

### Added
- **Auto-Updater Integration**: Implemented a secure, user-controlled auto-updater for Windows (NSIS/ZIP) and Linux (AppImage) using `electron-updater`.
- **TitleBar Update Notification**: Added a download icon with a pulsing green notification badge next to the "About" button in the TitleBar that appears only when an update is available.
- **Dedicated Update Modal**: Created a high-fidelity modal that presents release details, release notes, and a live download progress bar (displaying percentage, download speed, and bytes transferred).
- **Update Simulator**: Added a simulation mode in development environments (accessible via "About Vet" developer controls) to allow end-to-end testing of the update flow (including live download animations and hot-relaunching).

### Fixed
- **Theme Accent Color Persistence**: Resolved a bug where the application highlight color (`--app-accent`) remained purple across different themes. Defined signature accent colors for all built-in themes (e.g., Frost Cyan for Nord, One Dark Blue for One Dark) and updated the accent resolution logic.
