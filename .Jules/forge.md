## 2026-06-06 - xterm.js Addon Lifecycle Management
Learning: When adding new xterm.js addons like `ImageAddon`, they must be properly managed via refs, cached in `terminalCache`, and explicitly disposed using their `.dispose()` method when the terminal instance is destroyed to prevent memory leaks.
Action: Always verify the lifecycle logic (instantiation, caching, restoring, and disposal) matches the existing patterns (like `WebglAddon`) when introducing new xterm.js addons into React components.
