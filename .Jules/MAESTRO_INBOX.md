# 🎼 Maestro Inbox — Daily Tasks

---

## 2026-06-06 — Rich URL & Path Detection Production Implementation

### @Forge 🔨
- [x] **Task:** Upgrade `WebLinksAddon` in `TerminalView.tsx` with Pioneer's custom regex and smart click handler
- **Context:** `_experiments/url-detection/poc.ts` — Replace the basic `WebLinksAddon` (lines 116-118) that only opens HTTP URLs. Use the custom regex to also detect local file paths (relative, absolute, with line numbers). Route URLs → `window.windowApi.openExternal`, paths → `window.workspaceApi.revealPath`.
- **File:** `src/renderer/src/features/terminal/components/TerminalView.tsx`
- **Status:** ✅ DONE

### @Beaker 🧪
- [x] **Task:** Update `TerminalView.test.tsx` to test the enhanced URL/path detection
- **Context:** The current `WebLinksAddon` mock is an empty class. Update to capture the constructor args (handler + options with custom regex). Add tests: URL click calls `openExternal`, path click calls `revealPath`.
- **File:** `src/__tests__/TerminalView.test.tsx`
- **Status:** ✅ DONE

### @Scribe 🪶
- [x] **Task:** Document the rich URL & path detection feature
- **Context:** Add a brief section to `README.md` describing how terminal output paths and URLs are clickable.
- **File:** `README.md`
- **Status:** ✅ DONE

---

**Sequence:** Forge → Beaker + Scribe (parallel after Forge)
**Verification:** ✅ `npm test` — 26 suites, 237 tests passed. TypeScript compiles cleanly.
