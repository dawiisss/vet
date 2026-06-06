# 🎼 Maestro: Phase 5 - Terminal Clipboard History Breakdown

💡 What: Phase 4 is completed. Moving on to Phase 5 ("Sidebar Developer Toolbelt"), the implementation plan lists "Terminal Clipboard & Snippet Library". While the snippet library is currently implemented (`src/renderer/src/shared/components/SnippetLibraryPanel.tsx`), the "Terminal Clipboard" (persisting terminal copy actions to a styled Clipboard panel) is entirely missing. This proposal scopes the implementation of the missing Clipboard History feature.

🎯 Delegation:
### Task: Research Intercepting Terminal Copies
- [ ] **@Pioneer** 🔭: Create a proof of concept in `_experiments/clipboard-history/` that demonstrates intercepting standard copy operations (both keyboard shortcuts and right-click) from an xterm.js instance in Electron, and saving the text to a temporary store.

### Task: Implement Clipboard History Panel UI
- [ ] **@Forge** 🔨: Once Pioneer has proven the interception method, update `src/renderer/src/shared/components/SnippetLibraryPanel.tsx` (or create a new `ClipboardHistoryPanel.tsx`) to display a chronological list of recent terminal copies, with a 1-click button to paste them back into the active terminal. Use the logic established in Pioneer's PoC.

### Task: Test Clipboard Persistence
- [ ] **@Beaker** 🧪: Write an isolated component test for the new clipboard history UI to ensure copied items are rendered correctly and limit bounds (e.g., max 50 items) are respected.

🚦 Sequence:
- `@Pioneer` must complete the research PoC in `_experiments/` first.
- `@Forge` then implements the feature using the PoC as a reference.
- `@Beaker` can write the tests in parallel or sequentially after `@Forge` completes the UI logic.
