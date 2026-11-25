import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() }, shell: {},
  BrowserWindow: { fromWebContents: jest.fn(() => ({})) },
}));

import { ipcMain } from "electron";
import { initWorkspaceManager } from "../main/workspace";

describe("Workspace files and Git", () => {
  let root: string;
  let handlers: Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>;
  const execGit = promisify(execFile);
  const git = async (...args: string[]) => (await execGit("git", args, { cwd: root })).stdout;
  const invoke = (name: string, ...args: unknown[]) => handlers.get(`workspace:${name}`)!({}, ...args);

  beforeAll(async () => {
    await initWorkspaceManager();
    handlers = new Map((ipcMain.handle as jest.Mock).mock.calls.map(([name, handler]) => [name, handler]));
  });
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "vet-git-test-"));
    await git("init", "-q");
    await git("config", "core.autocrlf", "false");
    await git("config", "user.name", "Vet Test");
    await git("config", "user.email", "vet-test@example.invalid");
    fs.mkdirSync(path.join(root, "nested"));
    fs.writeFileSync(path.join(root, "old.txt"), "original contents\n");
    fs.writeFileSync(path.join(root, "unrelated.txt"), "unrelated\n");
    await git("add", ".");
    await git("commit", "-qm", "initial");
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  test.each(["new.txt", "spaced é name.txt"])("unstages both rename paths for %s from a nested cwd", async (destination) => {
    await git("mv", "old.txt", destination);
    fs.writeFileSync(path.join(root, "unrelated.txt"), "keep staged\n");
    await git("add", "unrelated.txt");
    const cwd = path.join(root, "nested");
    const status = await invoke("git-detailed-status", cwd) as GitDetailedStatus;
    expect(status.staged).toContainEqual({ path: destination, status: "R" });
    expect(await invoke("git-unstage", cwd, [destination])).toEqual({ success: true });
    expect(await git("diff", "--cached", "--name-status")).toBe("M\tunrelated.txt\n");
    expect(fs.readFileSync(path.join(root, destination), "utf8")).toBe("original contents\n");
    expect(fs.existsSync(path.join(root, "old.txt"))).toBe(false);
  });

  test("unstaging an ordinary added file preserves other staged changes", async () => {
    fs.copyFileSync(path.join(root, "old.txt"), path.join(root, "copy.txt"));
    fs.writeFileSync(path.join(root, "old.txt"), "independent source edit\n");
    await git("add", "copy.txt", "old.txt");
    expect(await invoke("git-unstage", root, ["copy.txt"])).toEqual({ success: true });
    expect(await git("diff", "--cached", "--name-status")).toBe("M\told.txt\n");
  });
  test("discard and stage respect a selected filename with bracket characters", async () => {
    const selected = "draft[1].txt";
    const neighbor = "draft1.txt";
    for (const file of [selected, neighbor]) fs.writeFileSync(path.join(root, file), "before\n");
    await git("add", ".");
    await git("commit", "-qm", "Add draft files");
    for (const file of [selected, neighbor]) fs.writeFileSync(path.join(root, file), "after\n");
    fs.writeFileSync(path.join(root, "untracked.txt"), "keep\n");

    expect(await invoke("git-stage", root, [selected])).toEqual({ success: true });
    expect((await git("diff", "--cached", "--name-only")).trim()).toBe(selected);
    expect(await invoke("git-unstage", root, [selected])).toEqual({ success: true });
    expect(await invoke("git-discard", root, [selected])).toEqual({ success: true });
    expect(fs.readFileSync(path.join(root, selected), "utf8")).toBe("before\n");
    expect(fs.readFileSync(path.join(root, neighbor), "utf8")).toBe("after\n");
    expect(fs.readFileSync(path.join(root, "untracked.txt"), "utf8")).toBe("keep\n");
  });

  test("local editor reads and writes the literal file containing a hash", async () => {
    const literalPath = path.join(root, "notes#draft.txt");
    const neighbor = path.join(root, "notes");
    fs.writeFileSync(literalPath, "draft");
    fs.writeFileSync(neighbor, "other");
    expect(await invoke("file-exists", literalPath)).toBe(true);
    expect(await invoke("read-file", literalPath)).toBe("draft");
    expect(await invoke("write-file", literalPath, "updated")).toBe(true);
    expect(fs.readFileSync(literalPath, "utf8")).toBe("updated");
    expect(fs.readFileSync(neighbor, "utf8")).toBe("other");
  });
});
