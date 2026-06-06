# 🔭 Pioneer: URL and Path Detection in xterm.js

## 💡 What
Investigated the feasibility of using `@xterm/addon-web-links` with custom regular expressions to detect not just standard HTTP/HTTPS URLs, but also local file paths (both absolute and relative) and file paths containing line numbers (e.g., `src/main/index.ts:45`). This is a critical feature for a modern terminal to allow easy navigation to errors and files.

## 🎯 Findings

**Pros:**
- `@xterm/addon-web-links` natively supports overriding the `urlRegex` option to match arbitrary text.
- Provides built-in `hover`, `leave`, and `click` handlers, simplifying the implementation of tooltips or open-in-editor functionality.
- Bundle size impact is minimal since `@xterm/addon-web-links` is already a listed dependency.

**Cons:**
- The custom regex must be carefully crafted to avoid false positives in terminal output while still capturing valid URLs and Windows/Unix paths.
- The default behavior of `WebLinksAddon` does not distinguish between a web URL and a local path; custom logic must be written in the click handler to determine whether to open it in a browser or an editor.

**Regex Developed:**
```javascript
const customRegex = /(?:https?:\/\/[^\s]+)|(?:(?:[a-zA-Z]:[\\/]+|\/)?(?:[\w\.\-]+[\\/]+)+[\w\.\-]+(?::\d+)?)/;
```
This regex successfully matches:
- `http://google.com`
- `https://github.com/microsoft/vscode`
- `src/main/index.ts`
- `src/main/index.ts:45`
- `/Users/user/project/file.txt`
- `C:\Users\user\project\file.txt:100`
- `http://localhost:3000`

## ⚖️ Recommendation
**Go.** The PoC (`_experiments/url-detection/poc.ts`) proves that it is entirely feasible to implement robust link and path detection using the existing `@xterm/addon-web-links` package without needing a separate addon or complex custom parsing logic. The click handler should just evaluate if it starts with `http` to open externally, or otherwise parse the path/line number and emit an event to the main process to open it in the configured editor or preview panel.
