import { Terminal } from '@xterm/xterm';

// Mock simple store to hold intercepted copies
export class ClipboardHistoryStore {
  private history: string[] = [];
  private maxItems = 50;

  add(text: string) {
    if (!text || text.trim() === '') return;

    // Don't add duplicates consecutively
    if (this.history[0] === text) return;

    this.history.unshift(text);
    if (this.history.length > this.maxItems) {
      this.history.pop();
    }

    console.log(`[ClipboardHistory] Saved: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`);
    console.log(`[ClipboardHistory] Total items: ${this.history.length}`);
  }

  get() {
    return [...this.history];
  }
}

export const store = new ClipboardHistoryStore();

export function setupSelectionInterceptor(term: Terminal) {
  return term.onSelectionChange(() => {
    const selection = term.getSelection();
    if (selection) {
      console.log(`[Terminal] Selection changed: "${selection}"`);
    }
  });
}

export function setupClipboardPatch(navigatorObj: any) {
  const originalWriteText = navigatorObj.clipboard.writeText;

  // We override the writeText method
  navigatorObj.clipboard.writeText = async function(text: string) {
    console.log(`[Interceptor] Caught writeText: "${text}"`);

    // Save to our history store
    store.add(text);

    // Call the original method to ensure standard clipboard still works
    return originalWriteText.call(navigatorObj.clipboard, text);
  };

  console.log('[Interceptor] navigator.clipboard.writeText patched');

  return () => {
    // Cleanup function
    navigatorObj.clipboard.writeText = originalWriteText;
    console.log('[Interceptor] navigator.clipboard.writeText restored');
  };
}
