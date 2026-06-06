# 🔭 Pioneer Investigation: Intercepting Terminal Copies for Clipboard History

## 💡 What
Phase 5 of the project plan requires a "Terminal Clipboard" feature, which will persist terminal copy actions to a styled Clipboard panel. Before Forge can build this UI, we needed to research the most reliable way to intercept standard copy operations (both keyboard shortcuts and right-click) from an xterm.js instance in Electron and save the text to a temporary store.

## 🎯 Findings

After evaluating the codebase, particularly `src/renderer/src/features/terminal/components/TerminalView.tsx`, I found that the app explicitly uses `navigator.clipboard.writeText` to handle copying in both keyboard shortcut handlers and contextual menus.

**Approach 1: `term.onSelectionChange()`**
- **Pros:** Native to xterm.js. Good for "copy on select" features.
- **Cons:** Standard copy commands (Ctrl+Shift+C / Cmd+C) don't trigger this if the text is already selected. It also doesn't map 1-to-1 with actual intentional copy actions.

**Approach 2: DOM `copy` event listener**
- **Pros:** Standard browser API.
- **Cons:** xterm.js often intercepts keyboard events internally. Reading from the clipboard immediately after a `copy` event can be flaky due to timing issues.

**Approach 3: Monkey-patching `navigator.clipboard.writeText`**
- **Pros:** Catches exactly what the terminal explicitely writes to the clipboard. Intercepts both contextual menu copies (line 454) and terminal custom actions (line 322). Extremely reliable.
- **Cons:** Modifies a global browser API, which requires careful cleanup.

**Approach 4: Explicit Store Dispatch alongside `writeText`**
- **Pros:** No global monkey-patching. Safe and predictable.
- **Cons:** Requires updating every place in `TerminalView.tsx` where `navigator.clipboard.writeText` is called.

## ⚖️ Recommendation: Proceed with Approach 4 (or 3)

I have created a working Proof of Concept in `_experiments/clipboard-history/` that demonstrates Approach 3 (monkey-patching). The PoC successfully intercepts writes, deduplicates consecutive identical copies, and maintains a maximum history size.

However, for production integration by **@Forge**, I highly recommend **Approach 4** (Explicit dispatch). Since we manage state via Zustand in this app (e.g., `useConfigStore`, `useTabStore`), it is much cleaner to create a new `useClipboardStore` and simply call `useClipboardStore.getState().add(sel)` right next to the existing `navigator.clipboard.writeText(sel)` calls in `TerminalView.tsx`. This avoids the potential side effects of monkey-patching a global API while achieving the exact same result.

**Next Steps for Forge:**
1. Create a `useClipboardStore` (Zustand) with `add`, `remove`, `clear` actions and a `history` array.
2. Update `TerminalView.tsx` to call `add` when copying.
3. Build the UI in `ClipboardHistoryPanel.tsx` reading from this store.

**Maestro Link:** Resolves Phase 5 Clipboard Interception Research task in `orchestration-plan.md`.
