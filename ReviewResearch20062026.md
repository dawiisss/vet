# Codebase Review Validation Notes — 2026-06-20

I have audited the codebase at the specified locations for all 30 primary items in [Review20062026.md](file:///home/dawiisss/Documents/GitHub/vet2/Review20062026.md) plus the minor items. Every single item identified is correct and represents an actual bug, resource leak, security issue, or quality regression.

---

## 🚨 Critical Validation & Discoveries

### 1. Item 30 (History Database Pruning) is a Catastrophic Data Loss Bug
The review correctly identifies that the size-based pruning loop in [historyDb.ts](file:///home/dawiisss/Documents/GitHub/vet2/src/main/historyDb.ts#L335-L356) runs synchronously. However, my audit revealed a much more severe issue: **it will delete the entire database history.**
```ts
while (sizeMb > limitMb) {
  // Deletes oldest 10 sessions from the database
  ...
  sizeMb = getDatabaseSizeMb(); // Reads size on disk
}
db.exec("VACUUM"); // Outside the loop
```
* **Why it fails**: SQLite does not automatically release deleted pages back to the filesystem (the file size on disk does not shrink upon row deletion).
* **The result**: `getDatabaseSizeMb()` (which does a synchronous `fs.statSync` of the database file) will return the exact same size in every iteration of the loop. The loop will run indefinitely, deleting sessions 10-by-10 until **every single session is deleted** and the database is completely empty. Only then does the loop terminate and run `VACUUM`.

### 2. Hidden TypeScript Compilation Errors
In `jest.config.ts`, `diagnostics: false` is masking actual compilation errors. Running a check manually reveals errors in the following files:
* **[terminalHandlers.ts](file:///home/dawiisss/Documents/GitHub/vet2/src/main/ipc/terminalHandlers.ts#L49-L50)**: Destructuring `const [width, height] = win.getSize();` flags `width` and `height` as possibly `undefined` under `noUncheckedIndexedAccess: true`.
* **[IntroModal.tsx](file:///home/dawiisss/Documents/GitHub/vet2/src/renderer/src/shared/components/IntroModal.tsx#L353)**: `config.theme` is typed as `string | ThemeConfig` and cannot be rendered directly as a React child. Additionally, indexing `slides[currentSlide]` yields a `Slide | undefined`, resulting in `slide` being possibly `undefined`.

---

## 🔍 Validation Summary for Key Issues

| # | Item Description | Status | File / Reference | Audit Details & Actionability |
|---|---|---|---|---|
| **1** | SSH Passwords over IPC | **Valid** | [config.ts:308-329](file:///home/dawiisss/Documents/GitHub/vet2/src/main/config.ts#L308-L329) | `sanitizeConfig` does not strip `password`/`passphrase` fields, causing plaintext secrets to be sent to renderers via IPC. |
| **2** | Path Traversal / Arbitrary Read | **Valid** | [workspace.ts:32-120](file:///home/dawiisss/Documents/GitHub/vet2/src/main/workspace.ts#L32-L120) | `listDir` and `readFileHead` take raw renderer-provided paths, expanding `~` but performing zero boundary/allowlist validation. |
| **3** | Cross-Window Injection | **Valid** | [terminalHandlers.ts:150-155](file:///home/dawiisss/Documents/GitHub/vet2/src/main/ipc/terminalHandlers.ts#L150-L155) | `terminal:write` does not verify if the target terminal ID is owned by the sender window (unlike `terminal:destroy` which does). |
| **4** | Adblocker Listener Leak | **Valid** | [adblocker.ts:252-271](file:///home/dawiisss/Documents/GitHub/vet2/src/main/adblocker.ts#L252-L271) | Toggling the adblocker accumulates `request-blocked` event listeners on the `blocker` object because they are never unregistered in `disableAdblocker`. |
| **5** | DB Connection Leak | **Valid** | [historyDb.ts](file:///home/dawiisss/Documents/GitHub/vet2/src/main/historyDb.ts#L453-L466) | `cleanupHistoryDb` is exported but never registered or called during app quit/shutdown in `index.ts`. |
| **8** | Sysinfo Polling Loop | **Valid** | [sysinfo.ts:5-28](file:///home/dawiisss/Documents/GitHub/vet2/src/main/sysinfo.ts#L5-L28) | The `scheduleNext` timeout chain continues running forever even after the main window is closed. |
| **9** | Orphaned Intervals in simulation | **Valid** | [updaterHandlers.ts:92-133](file:///home/dawiisss/Documents/GitHub/vet2/src/main/ipc/updaterHandlers.ts#L92-L133) | `setInterval` triggers multiple times and lacks guards to clear the active timer when closed. |
| **10** | SFTP Connection Race | **Valid** | [sftp.ts:108-145](file:///home/dawiisss/Documents/GitHub/vet2/src/main/sftp.ts#L108-L145) | If a socket closes before the asynchronous `client.sftp()` and `pwd` flow finishes, `sftpSessions.delete(sshHostId)` is called before the session is ever set in the map, leaving a dead socket in the map permanently. |
| **11** | Chokidar FSWatcher Leak | **Valid** | [config.ts:295-301](file:///home/dawiisss/Documents/GitHub/vet2/src/main/config.ts#L295-L301) | Config watcher is never closed or cleaned up. |
| **12** | Command Palette Array Rebuild | **Valid** | [ModalManager.tsx:63-178](file:///home/dawiisss/Documents/GitHub/vet2/src/renderer/src/shared/components/ModalManager.tsx#L63-L178) | A large array of commands is reconstructed on every render. Needs `useMemo`. |
| **13** | Terminal Config Dependency | **Valid** | [useTerminal.ts:427-466](file:///home/dawiisss/Documents/GitHub/vet2/src/renderer/src/features/terminal/hooks/useTerminal.ts#L427-L466) | The entire `config` object is a dependency. Needs to depend on destructured properties. |
| **14** | Shell Whitelist Bypass | **Valid** | [pty.ts:56-67](file:///home/dawiisss/Documents/GitHub/vet2/src/main/pty.ts#L56-L67) | Any file existing on disk bypasses the safe commands whitelist because the validation logic has an early exit-success path. |
| **15** | SshHost Global Type | **Valid** | [sshPty.ts:6](file:///home/dawiisss/Documents/GitHub/vet2/src/main/sshPty.ts#L6) | `SshHost` is a global type from `src/types.d.ts` (so it does not fail compilation), but using it without explicit import is bad practice for modularity. |
| **20** | Empty/Assertionless Tests | **Valid** | `Sidebar.test.tsx`, `panels.test.tsx` | Specific tests are completely empty, duplicate existing assertions, or mock components but never render/assert them. |
| **23** | Dead Mock Files | **Valid** | `src/__mocks__/@xterm` | The mocks in this folder are completely ignored; tests mock xterm addons inline in every test file. |
| **26** | Duplicate Code | **Valid** | Multiple files | `pathsEqual`, directory sort, and browser home fallback are duplicated across main and renderer codebases. |
| **27** | ESLint Scope | **Valid** | [eslint.config.mjs](file:///home/dawiisss/Documents/GitHub/vet2/eslint.config.mjs) | React plugins apply globally, running on main/preload processes and flagging non-React hooks-like functions. |
| **29** | Dead `allowScripts` | **Valid** | [package.json](file:///home/dawiisss/Documents/GitHub/vet2/package.json#L123-L125) | The `allowScripts` block is ignored by npm (it is yarn/pnpm specific) and should be removed. |

---

## 📈 Recommendation and Execution Plan

All fixes/improvements should be executed. I recommend grouping them by severity:

1. **Security & Data Loss**: Fix Item 30 (History Database Pruning data-wiping loop), Item 1 (Plaintext SSH Password leak), Item 2 (Workspace path traversal), Item 3 (Cross-window terminal injection), and Item 14 (Shell whitelist bypass).
2. **Resource Leaks**: Fix Item 4 (Adblocker listener leak), Item 5 (Close history database connection), Item 8 (Sysinfo loop), Item 9 (Updater interval), and Item 11 (Chokidar watcher).
3. **TypeScript & Performance**: Address the compiler errors in `terminalHandlers.ts` and `IntroModal.tsx`, resolve `diagnostics: false` (Item 28), and optimize `useTerminal` (Item 13) and `ModalManager` (Item 12).
4. **Code Quality**: Deduplicate helper functions (Item 26), scope ESLint correctly (Item 27), and clean up empty tests (Item 20) and unused mocks (Item 23).
