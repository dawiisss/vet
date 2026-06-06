## 2024-10-25 - xterm.js WebLinksAddon Custom Regex
**Learning:** The `@xterm/addon-web-links` allows customization of `urlRegex` to support both web links and file paths (with optional line numbers). This eliminates the need for separate link detection libraries.
**Action:** Use a unified regex and handle protocol checking (http vs file path) within the click handler when implementing terminal link detection.
