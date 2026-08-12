import { app, ipcMain } from "electron";
import { join } from "path";
import { promises as fs } from "fs";
import { isTrustedSender } from "./ipc/ipcUtils";
import { homedir } from "os";
import { existsSync, mkdirSync, writeFileSync } from "fs";

const CONFIG_DIR = join(homedir(), ".config", "vet");
const SESSION_FILE = join(CONFIG_DIR, "session.json");
const PROFILES_FILE = join(CONFIG_DIR, "profiles.json");

let sessionState: any = null;

export function initSessionManager() {
  if (!existsSync(CONFIG_DIR)) {
    try {
      mkdirSync(CONFIG_DIR, { recursive: true });
    } catch (err) {
      console.warn("Failed to create session config directory:", err);
    }
  }

  ipcMain.handle("session:save", async (_event, state: any) => {
    sessionState = state;
  });

  ipcMain.handle("session:get", async () => {
    return await getSessionData();
  });

  ipcMain.handle("session:save-profile", async (event, name: string, state: any) => {
    if (!isTrustedSender(event)) return;
    const profiles = await getProfilesData();
    profiles[name] = state;
    await fs.writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf-8");
  });

  ipcMain.handle("session:get-profiles", async (event) => {
    if (!isTrustedSender(event)) return {};
    return await getProfilesData();
  });

  ipcMain.handle("session:delete-profile", async (event, name: string) => {
    if (!isTrustedSender(event)) return;
    const profiles = await getProfilesData();
    if (profiles[name]) {
      delete profiles[name];
      await fs.writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf-8");
    }
  });

  app.on("before-quit", () => {
    if (sessionState) {
      try {
        writeFileSync(SESSION_FILE, JSON.stringify(sessionState));
      } catch (err) {
        console.error("Failed to save session on quit", err);
      }
    }
  });
}

export async function getSessionData(): Promise<any | null> {
  try {
    const content = await fs.readFile(SESSION_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function getProfilesData(): Promise<Record<string, any>> {
  try {
    const content = await fs.readFile(PROFILES_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}
