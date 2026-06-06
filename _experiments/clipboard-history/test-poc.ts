import { setupClipboardPatch, store } from './clipboard-interceptor-poc';

const mockNavigator = {
  clipboard: {
    writeText: async (text: string) => {
      console.log(`[Mock Native] Wrote to native clipboard: ${text}`);
      return Promise.resolve();
    },
    readText: async () => Promise.resolve(''),
    read: async () => Promise.resolve([]),
    write: async () => Promise.resolve()
  }
} as any;

async function runTest() {
  console.log("--- Starting Clipboard Interceptor Test ---");

  const restore = setupClipboardPatch(mockNavigator);

  console.log("\nSimulating terminal copy (TerminalView.tsx line 322):");
  await mockNavigator.clipboard.writeText("npm install express");

  console.log("\nSimulating context menu copy (TerminalView.tsx line 454):");
  await mockNavigator.clipboard.writeText("docker-compose up -d");

  console.log("\nSimulating duplicate copy (should be ignored):");
  await mockNavigator.clipboard.writeText("docker-compose up -d");

  console.log("\nRestoring original clipboard...");
  restore();

  console.log("\nSimulating copy after restore (should NOT be intercepted):");
  await mockNavigator.clipboard.writeText("git status");

  console.log("\nStore final state:");
  console.log(store.get());

  console.log("\n--- Test Complete ---");
}

runTest();
