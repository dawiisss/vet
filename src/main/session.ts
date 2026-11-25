import { app, ipcMain } from "electron";
import { join } from "path";
import { promises as fs } from "fs";
import { isTrustedSender } from "./ipc/ipcUtils";
import { homedir } from "os";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "fs";
import { randomUUID } from "node:crypto";
import { isWorkspaceSnapshot } from "../shared/utils/workspaceSnapshot";

const CONFIG_DIR = join(homedir(), ".config", "vet");
const SESSION_FILE = join(CONFIG_DIR, "session.json");
const PROFILES_FILE = join(CONFIG_DIR, "profiles.json");
const RESERVED_PROFILE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isValidProfileName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= 256 &&
    !RESERVED_PROFILE_KEYS.has(name)
  );
}

let profileWriteQueue: Promise<void> = Promise.resolve();

function enqueueProfileWrite(task: () => Promise<void>): Promise<void> {
  const next = profileWriteQueue.then(task, task);
  profileWriteQueue = next.catch(() => { /* keep queue healthy */ });
  return next;
}

async function writeProfilesAtomic(profiles: Record<string, unknown>): Promise<void> {
  const tempProfilesFile = `${PROFILES_FILE}.${randomUUID()}.tmp`;
  await fs.writeFile(tempProfilesFile, JSON.stringify(profiles, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
  await fs.rename(tempProfilesFile, PROFILES_FILE);
}

export function initSessionManager(isMainSender: (sender: Electron.WebContents) => boolean) {
  let pendingSnapshot: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tempFile = `${SESSION_FILE}.${randomUUID()}.tmp`;

  const flushSession = () => {
    clearTimeout(timer);
    timer = undefined;
    if (pendingSnapshot === undefined) return;

    try {
      writeFileSync(tempFile, pendingSnapshot, { encoding: "utf-8", mode: 0o600 });
      renameSync(tempFile, SESSION_FILE);
      pendingSnapshot = undefined;
    } catch (error) {
      console.error("Failed to write workspace session:", error);
    }
  };
  if (!existsSync(CONFIG_DIR)) {
    try {
      mkdirSync(CONFIG_DIR, { recursive: true });
    } catch (err) {
      console.warn("Failed to create session config directory:", err);
    }
  }

  ipcMain.handle("session:save", (event, state: unknown) => {
    if (!isMainSender(event.sender) || !isWorkspaceSnapshot(state)) return;
    pendingSnapshot = JSON.stringify(state);
    clearTimeout(timer);
    timer = setTimeout(flushSession, 250);
  });

  ipcMain.handle("session:get", async (event) => {
    if (!isTrustedSender(event)) return null;
    return await getSessionData();
  });

  ipcMain.handle("session:save-profile", async (event, name: string, state: unknown) => {
    if (!isTrustedSender(event) || !isValidProfileName(name)) return;
    await enqueueProfileWrite(async () => {
      const profiles = await getProfilesData();
      profiles[name] = state;
      await writeProfilesAtomic(profiles);
    });
  });

  ipcMain.handle("session:get-profiles", async (event) => {
    if (!isTrustedSender(event)) return {};
    return await getProfilesData();
  });

  ipcMain.handle("session:delete-profile", async (event, name: string) => {
    if (!isTrustedSender(event) || !isValidProfileName(name)) return;
    await enqueueProfileWrite(async () => {
      const profiles = await getProfilesData();
      if (Object.prototype.hasOwnProperty.call(profiles, name)) {
        delete profiles[name];
        await writeProfilesAtomic(profiles);
      }
    });
  });

  app.on("will-quit", flushSession);
}

export async function getSessionData(): Promise<unknown | null> {
  try {
    const content = await fs.readFile(SESSION_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function getProfilesData(): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(PROFILES_FILE, "utf-8");
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const clean: Record<string, unknown> = Object.create(null);
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!RESERVED_PROFILE_KEYS.has(k)) {
        clean[k] = v;
      }
    }
    return clean;
  } catch {
    return {};
  }
}
