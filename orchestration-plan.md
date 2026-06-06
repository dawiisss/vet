# 🎼 Maestro: Phase 4 Implementation Breakdown

💡 What: The codebase is ready to begin Phase 4 - Core Advanced & Terminal Features. Looking at `ImplementationPlan.md` and the existing files, `TerminalView.tsx` already has partial implementation of WebGL and Image addons, but lacks proper testing and documentation.

🎯 Delegation:
### Task: Implement Rich URL & Path Detection PoC
- [x] **@Pioneer** 🔭: Create a proof of concept in `_experiments/url-detection/` for using `@xterm/addon-web-links` with custom regexp matchers to detect URLs, local paths, and lines (e.g., `src/main/index.ts:45`).

### Task: Implement Rich URL & Path Detection Production
- [ ] **@Forge** 🔨: Integrate the custom URL and path detection using `@xterm/addon-web-links` into `src/renderer/src/features/terminal/components/TerminalView.tsx`. Use the regex matchers and setup logic demonstrated in `_experiments/url-detection/poc.ts`.

### Task: Cleanup URL Detection PoC
- [ ] **@Broom** 🧹: Once Forge has completed the production implementation, delete the `_experiments/url-detection/` folder.

### Task: Implement Sixel & Inline Images
- [ ] **@Forge** 🔨: Integrate `@xterm/addon-image` into `src/renderer/src/features/terminal/components/TerminalView.tsx` to fully support the Sixel graphics protocol inline within the scrollback buffer.
- [x] **@Scribe** 🪶: Update `README.md` to document the new Sixel/inline image capability and how to use it with CLI apps like `neofetch`.

### Task: Terminal Component Test Coverage
- [ ] **@Beaker** 🧪: Add comprehensive test coverage for `TerminalView.tsx` by creating `src/__tests__/TerminalView.test.tsx`. Ensure you cover WebGL context loss, fallback to 2D canvas, and search functionality.

### Task: Aesthetic Window Vibrancy Controls
- [ ] **@Forge** 🔨: Add dynamic opacity controls and macOS Vibrancy (`NSVisualEffectView`) / Windows Acrylic/Mica effects in `src/renderer/src/features/settings/components/SettingsModal.tsx` and ensure the Electron main process IPC correctly handles them. (Reassigned from Palette due to main process IPC constraints).

🚦 Sequence:
- `@Forge` must complete the Sixel implementation and the URL & Path Detection in `TerminalView.tsx` sequentially BEFORE `@Beaker` starts adding tests or `@Scribe` adds documentation. Serial delegation is required here to avoid merge conflicts on `TerminalView.tsx`.
- `@Forge`'s "Aesthetic Window Vibrancy Controls" task touches settings files, so it can be done in parallel with `TerminalView.tsx` work.
- `@Broom`'s cleanup task should only happen AFTER `@Forge` completes the URL & Path Detection implementation.
