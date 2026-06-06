import { Terminal } from '@xterm/xterm';
import { WebLinksAddon } from '@xterm/addon-web-links';

// Custom regex for detecting URLs, local paths, and paths with line numbers
// Matches:
// - http://google.com
// - https://github.com/microsoft/vscode
// - src/main/index.ts
// - src/main/index.ts:45
// - /Users/user/project/file.txt
// - C:\Users\user\project\file.txt:100
// - http://localhost:3000
const customRegex = /(?:https?:\/\/[^\s]+)|(?:(?:[a-zA-Z]:[\\/]+|\/)?(?:[\w\.\-]+[\\/]+)+[\w\.\-]+(?::\d+)?)/;

console.log("Regex tests:");
const testCases = [
    "http://google.com",
    "https://github.com/microsoft/vscode",
    "src/main/index.ts",
    "src/main/index.ts:45",
    "/Users/user/project/file.txt",
    "C:\\Users\\user\\project\\file.txt:100",
    "just some regular text",
    "http://localhost:3000"
];

testCases.forEach(t => {
    console.log(`"${t}": ${customRegex.exec(t)?.[0]}`);
});

try {
    const terminal = new Terminal();
    const addon = new WebLinksAddon((event, uri) => {
        console.log(`Link clicked: ${uri}`);
    }, {
        urlRegex: customRegex,
        hover: (event, text, location) => {
            console.log(`Hovering over: ${text}`);
        },
        leave: (event, text) => {
            console.log(`Left hover on: ${text}`);
        }
    });

    terminal.loadAddon(addon);
    console.log("Terminal addon loaded successfully.");
} catch (e) {
    console.error("Error loading terminal addon (expected in Node without DOM):", e);
}
