import { app, ipcMain } from "electron";
import { join } from "path";
import { promises as fs } from "fs";
import { existsSync, mkdirSync } from "fs";
import { getConfig } from "./config";

const CONFIG_DIR = join(app.getPath("home"), ".config", "vet");
const CLIPBOARD_FILE = join(CONFIG_DIR, "clipboard-history.json");

interface ClipboardItem {
  id: string;
  text: string;
  timestamp: number;
}

export function initClipboardHistoryManager() {
  if (!existsSync(CONFIG_DIR)) {
    try {
      mkdirSync(CONFIG_DIR, { recursive: true });
    } catch {}
  }

  ipcMain.handle("clipboard:get-history", async () => {
    return await loadHistory();
  });

  ipcMain.handle(
    "clipboard:set-history",
    async (_event, items: ClipboardItem[]) => {
      await saveHistory(items);
    },
  );
}

async function loadHistory(): Promise<ClipboardItem[]> {
  try {
    const content = await fs.readFile(CLIPBOARD_FILE, "utf-8");
    const items: ClipboardItem[] = JSON.parse(content);
    if (!Array.isArray(items)) return [];

    // Filter out items older than clipboardHistoryKeepDays
    const config = getConfig();
    const keepDays =
      typeof config.clipboardHistoryKeepDays === "number"
        ? config.clipboardHistoryKeepDays
        : 7;
    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    const filtered = items.filter((item) => item.timestamp >= cutoff);

    // Rewrite file with filtered items if any were removed
    if (filtered.length !== items.length) {
      await saveHistory(filtered);
    }

    return filtered;
  } catch {
    return [];
  }
}

async function saveHistory(items: ClipboardItem[]): Promise<void> {
  try {
    const content = JSON.stringify(items, null, 2);
    await fs.writeFile(CLIPBOARD_FILE, content, "utf-8");
  } catch (e) {
    console.error("Failed to save clipboard history:", e);
  }
}
