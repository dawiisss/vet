## 2024-10-25 - xterm.js WebLinksAddon Custom Regex
**Learning:** The `@xterm/addon-web-links` allows customization of `urlRegex` to support both web links and file paths (with optional line numbers). This eliminates the need for separate link detection libraries.
**Action:** Use a unified regex and handle protocol checking (http vs file path) within the click handler when implementing terminal link detection.
## 2025-02-28 - Terminal Clipboard Interception
Learning: xterm.js copy events can be reliably intercepted in Electron by monkey-patching `navigator.clipboard.writeText`, or more safely by explicit dispatch alongside existing `writeText` calls in the UI layer.
Action: Recommend explicit state dispatch for UI features that rely on terminal copy actions, rather than attempting to listen to internal xterm.js selection events which don't map cleanly to explicit copy commands.
