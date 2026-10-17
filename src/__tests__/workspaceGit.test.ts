import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() }, shell: {},
  BrowserWindow: { fromWebContents: jest.fn(() => ({})) },
}));

import { ipcMain } from "electron";
import { initWorkspaceManager } from "../main/workspace";

describe("Git rename unstaging", () => {
  let root: string;
  let handlers: Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>;
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const invoke = (name: string, ...args: unknown[]) => handlers.get(`workspace:${name}`)!({}, ...args);

  beforeAll(async () => {
    await initWorkspaceManager();
    handlers = new Map((ipcMain.handle as jest.Mock).mock.calls.map(([name, handler]) => [name, handler]));
  });
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "vet-git-test-"));
    git("init", "-q");
    git("config", "user.name", "Vet Test");
    git("config", "user.email", "vet-test@example.invalid");
    fs.mkdirSync(path.join(root, "nested"));
    fs.writeFileSync(path.join(root, "old.txt"), "original contents\n");
    fs.writeFileSync(path.join(root, "unrelated.txt"), "unrelated\n");
    git("add", ".");
    git("commit", "-qm", "initial");
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  test.each(["new.txt", "spaced é name.txt"])("unstages both rename paths for %s from a nested cwd", async (destination) => {
    git("mv", "old.txt", destination);
    fs.writeFileSync(path.join(root, "unrelated.txt"), "keep staged\n");
    git("add", "unrelated.txt");
    const cwd = path.join(root, "nested");
    const status = await invoke("git-detailed-status", cwd) as GitDetailedStatus;
    expect(status.staged).toContainEqual({ path: destination, status: "R" });
    expect(await invoke("git-unstage", cwd, [destination])).toEqual({ success: true });
    expect(git("diff", "--cached", "--name-status")).toBe("M\tunrelated.txt\n");
    expect(fs.readFileSync(path.join(root, destination), "utf8")).toBe("original contents\n");
    expect(fs.existsSync(path.join(root, "old.txt"))).toBe(false);
  });

  test("unstaging an ordinary added file preserves other staged changes", async () => {
    fs.copyFileSync(path.join(root, "old.txt"), path.join(root, "copy.txt"));
    fs.writeFileSync(path.join(root, "old.txt"), "independent source edit\n");
    git("add", "copy.txt", "old.txt");
    expect(await invoke("git-unstage", root, ["copy.txt"])).toEqual({ success: true });
    expect(git("diff", "--cached", "--name-status")).toBe("M\told.txt\n");
  });
});
