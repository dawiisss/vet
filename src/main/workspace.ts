import { ipcMain, shell } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { sortDirectoryItems } from "../shared/utils/pathUtils";
import { isTrustedSender } from "./ipc/ipcUtils";

const execFileAsync = promisify(execFile);

const MAX_FILE_WRITE_BYTES = 10 * 1024 * 1024;
const MAX_PATH_LENGTH = 4096;

interface DirectoryItem {
  name: string;
  isDirectory: boolean;
  size: number;
  ext: string;
}

function expandHome(inputPath: string): string {
  if (inputPath === "~" || inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(1));
  }
  if (inputPath.startsWith("~")) {
    const sep = inputPath.indexOf("/");
    if (sep === -1) {
      return path.join(os.homedir(), inputPath.slice(1));
    }
    return path.join(os.homedir(), inputPath.slice(sep));
  }
  return inputPath;
}

function logSensitivePathAccess(resolvedPath: string): void {
  const homeDir = os.homedir();
  const sensitivePaths = [
    path.join(homeDir, ".ssh"),
    path.join(homeDir, ".gnupg"),
    path.join(homeDir, ".aws"),
    path.join(homeDir, ".config", "vet"),
  ];

  for (const sp of sensitivePaths) {
    if (resolvedPath === sp || resolvedPath.startsWith(sp + path.sep)) {
      console.warn(`[security] Accessing sensitive path: ${resolvedPath}`);
      break;
    }
  }
}

function isSensitiveWritePath(resolvedPath: string): boolean {
  const homeDir = os.homedir();
  const sensitivePaths = [
    path.join(homeDir, ".ssh"),
    path.join(homeDir, ".gnupg"),
    path.join(homeDir, ".aws"),
    path.join(homeDir, ".config", "vet"),
  ];

  return sensitivePaths.some(
    (sp) => resolvedPath === sp || resolvedPath.startsWith(sp + path.sep),
  );
}

function validPathInput(input: unknown): input is string {
  return typeof input === "string" && input.length <= MAX_PATH_LENGTH;
}

function nonEmptyPathInput(input: unknown): input is string {
  return (
    typeof input === "string" &&
    input.length > 0 &&
    input.length <= MAX_PATH_LENGTH
  );
}

class WorkspaceService {
  async getScripts(cwd?: string) {
    try {
      let currentDir = cwd ? path.resolve(expandHome(cwd)) : process.cwd();
      let pkgScripts: Record<string, string> | null = null;
      let foundDir = currentDir;
      const tasks: Array<{
        name: string;
        command: string;
        source: "npm" | "make" | "cargo" | "python" | "docker" | "deno" | "task" | "custom";
        description?: string | undefined;
      }> = [];

      // 1. Search for package.json up to 3 levels up
      for (let i = 0; i < 3; i++) {
        const pkgPath = path.join(currentDir, "package.json");
        try {
          const content = await fs.readFile(pkgPath, "utf-8");
          const pkg = JSON.parse(content);
          if (pkg && pkg.scripts) {
            pkgScripts = pkg.scripts;
            foundDir = currentDir;
            for (const [name, cmd] of Object.entries(pkg.scripts)) {
              tasks.push({
                name,
                command: `npm run ${name}`,
                source: "npm",
                description: typeof cmd === "string" ? cmd : undefined,
              });
            }
            break;
          }
        } catch {
          const parentDir = path.dirname(currentDir);
          if (parentDir === currentDir) break;
          currentDir = parentDir;
        }
      }

      const checkDir = foundDir || (cwd ? path.resolve(expandHome(cwd)) : process.cwd());

      // 2. Makefile detection
      try {
        const makePath = path.join(checkDir, "Makefile");
        const makeContent = await fs.readFile(makePath, "utf-8");
        const makeTargetRegex = /^([a-zA-Z0-9_-]+):/gm;
        let match;
        const seenTargets = new Set<string>();
        while ((match = makeTargetRegex.exec(makeContent)) !== null) {
          const target = match[1];
          if (target && !target.startsWith(".") && !seenTargets.has(target)) {
            seenTargets.add(target);
            tasks.push({
              name: `make ${target}`,
              command: `make ${target}`,
              source: "make",
            });
          }
        }
      } catch { /* intentional ignore */ }

      // 3. Cargo.toml detection
      try {
        const cargoPath = path.join(checkDir, "Cargo.toml");
        await fs.access(cargoPath);
        tasks.push(
          { name: "cargo build", command: "cargo build", source: "cargo" },
          { name: "cargo test", command: "cargo test", source: "cargo" },
          { name: "cargo run", command: "cargo run", source: "cargo" },
          { name: "cargo check", command: "cargo check", source: "cargo" },
        );
      } catch { /* intentional ignore */ }

      // 4. Python project detection
      try {
        const pyproject = path.join(checkDir, "pyproject.toml");
        const reqs = path.join(checkDir, "requirements.txt");
        let isPy = false;
        try {
          await fs.access(pyproject);
          isPy = true;
        } catch {
          try {
            await fs.access(reqs);
            isPy = true;
          } catch { /* intentional ignore */ }
        }
        if (isPy) {
          tasks.push(
            { name: "pytest", command: "pytest", source: "python" },
            { name: "python main", command: "python3 main.py", source: "python" },
          );
        }
      } catch { /* intentional ignore */ }

      // 5. Docker Compose detection
      try {
        const composeFiles = [
          "docker-compose.yml",
          "docker-compose.yaml",
          "compose.yml",
          "compose.yaml",
        ];
        for (const cf of composeFiles) {
          try {
            await fs.access(path.join(checkDir, cf));
            tasks.push(
              { name: "compose up", command: "docker compose up -d", source: "docker" },
              { name: "compose down", command: "docker compose down", source: "docker" },
              { name: "compose logs", command: "docker compose logs -f", source: "docker" },
            );
            break;
          } catch { /* intentional ignore */ }
        }
      } catch { /* intentional ignore */ }

      // 6. Deno detection
      try {
        const denoPath = path.join(checkDir, "deno.json");
        const denoContent = await fs.readFile(denoPath, "utf-8");
        const denoPkg = JSON.parse(denoContent);
        if (denoPkg && denoPkg.tasks) {
          for (const [name, cmd] of Object.entries(denoPkg.tasks)) {
            tasks.push({
              name: `deno task ${name}`,
              command: `deno task ${name}`,
              source: "deno",
              description: typeof cmd === "string" ? cmd : undefined,
            });
          }
        }
      } catch { /* intentional ignore */ }

      // 7. Taskfile detection
      try {
        const taskPath = path.join(checkDir, "Taskfile.yml");
        await fs.access(taskPath);
        tasks.push({ name: "task", command: "task", source: "task" });
      } catch { /* intentional ignore */ }

      if (tasks.length === 0 && !pkgScripts) {
        return null;
      }

      return {
        cwd: checkDir,
        scripts: pkgScripts || {},
        tasks,
      };
    } catch (err) {
      console.error("Failed to get workspace scripts", err);
      return null;
    }
  }

  async listDir(dirPath: string) {
    try {
      const targetPath = path.resolve(expandHome(dirPath));

      logSensitivePathAccess(targetPath);

      const files = await fs.readdir(targetPath);
      const items: DirectoryItem[] = [];

      for (const file of files) {
        if (file === ".git" || file === "node_modules") {
          items.push({
            name: file,
            isDirectory: true,
            size: 0,
            ext: "",
          });
          continue;
        }

        try {
          const fullPath = path.join(targetPath, file);
          const stat = await fs.stat(fullPath);
          items.push({
            name: file,
            isDirectory: stat.isDirectory(),
            size: stat.size,
            ext: path.extname(file).toLowerCase(),
          });
        } catch { /* intentional ignore */ }
      }

      return sortDirectoryItems(items);
    } catch (err) {
      console.error(`Failed to list directory: ${dirPath}`, err);
      return [];
    }
  }

  async searchFiles(dirPath: string, query: string = "", maxResults: number = 100) {
    try {
      const targetDir = dirPath ? expandHome(dirPath) : process.cwd();
      const rootPath = path.resolve(targetDir);
      logSensitivePathAccess(rootPath);

      const results: Array<{ relativePath: string; absolutePath: string }> = [];
      const lowerQuery = query.toLowerCase().trim();

      const IGNORE_DIRS = new Set([
        ".git",
        "node_modules",
        "dist",
        "out",
        "build",
        ".next",
        ".cache",
        "coverage",
        ".gemini",
        ".agents",
      ]);

      const walk = async (currentDir: string, depth: number) => {
        if (depth > 6 || results.length >= maxResults) return;

        let entries;
        try {
          entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          if (results.length >= maxResults) break;

          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.relative(rootPath, fullPath);

          if (entry.isDirectory()) {
            if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
              await walk(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            if (!lowerQuery || relPath.toLowerCase().includes(lowerQuery) || entry.name.toLowerCase().includes(lowerQuery)) {
              results.push({
                relativePath: relPath,
                absolutePath: fullPath,
              });
            }
          }
        }
      };

      await walk(rootPath, 0);
      return results;
    } catch (err) {
      console.error(`Failed to search files in directory: ${dirPath}`, err);
      return [];
    }
  }

  async searchFileContents(
    dirPath: string,
    query: string,
    options: {
      caseSensitive?: boolean;
      isRegex?: boolean;
      wholeWord?: boolean;
      maxResults?: number;
      filePattern?: string;
    } = {},
  ) {
    try {
      if (!query || query.trim() === "") return [];

      const targetDir = dirPath ? expandHome(dirPath) : process.cwd();
      const rootPath = path.resolve(targetDir);
      logSensitivePathAccess(rootPath);

      const maxResults = options.maxResults || 200;
      const matches: Array<{
        filePath: string;
        relativePath: string;
        line: number;
        column: number;
        lineContent: string;
        matchLength: number;
      }> = [];

      let searchRegex: RegExp;
      try {
        let patternStr = options.isRegex
          ? query
          : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (options.wholeWord) {
          patternStr = `\\b${patternStr}\\b`;
        }
        searchRegex = new RegExp(patternStr, options.caseSensitive ? "g" : "gi");
      } catch {
        return [];
      }

      const IGNORE_DIRS = new Set([
        ".git",
        "node_modules",
        "dist",
        "out",
        "build",
        ".next",
        ".cache",
        "coverage",
        ".gemini",
        ".agents",
      ]);

      const walk = async (currentDir: string, depth: number) => {
        if (depth > 8 || matches.length >= maxResults) return;

        let entries;
        try {
          entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          if (matches.length >= maxResults) break;

          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.relative(rootPath, fullPath);

          if (entry.isDirectory()) {
            if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
              await walk(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            if (options.filePattern && options.filePattern.trim()) {
              const pat = options.filePattern.trim().toLowerCase();
              if (!entry.name.toLowerCase().includes(pat) && !relPath.toLowerCase().includes(pat)) {
                continue;
              }
            }

            try {
              const stat = await fs.stat(fullPath);
              if (stat.size > 2 * 1024 * 1024) continue; // Skip files > 2MB

              // Quick binary check: read first 512 bytes
              const handle = await fs.open(fullPath, "r");
              const sampleBuf = Buffer.alloc(Math.min(512, stat.size));
              const { bytesRead } = await handle.read(sampleBuf, 0, sampleBuf.length, 0);
              await handle.close();

              let isBinary = false;
              for (let b = 0; b < bytesRead; b++) {
                if (sampleBuf[b] === 0) {
                  isBinary = true;
                  break;
                }
              }
              if (isBinary) continue;

              const content = await fs.readFile(fullPath, "utf-8");
              const lines = content.split(/\r?\n/);

              for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                if (matches.length >= maxResults) break;
                const lineStr = lines[lineIdx]!;
                searchRegex.lastIndex = 0;

                let m;
                while ((m = searchRegex.exec(lineStr)) !== null) {
                  matches.push({
                    filePath: fullPath,
                    relativePath: relPath,
                    line: lineIdx + 1,
                    column: m.index + 1,
                    lineContent: lineStr.slice(0, 300),
                    matchLength: m[0].length,
                  });
                  if (matches.length >= maxResults || m[0].length === 0) break;
                }
              }
            } catch { /* intentional ignore */ }
          }
        }
      };

      await walk(rootPath, 0);
      return matches;
    } catch (err) {
      console.error(`Failed to search file contents in directory: ${dirPath}`, err);
      return [];
    }
  }

  revealPath(itemPath: string) {
    try {
      const targetPath = path.resolve(expandHome(itemPath));

      logSensitivePathAccess(targetPath);

      shell.showItemInFolder(targetPath);
    } catch (err) {
      console.error(`Failed to reveal path: ${itemPath}`, err);
    }
  }

  async readFileHead(filePath: string) {
    try {
      const hashIdx = filePath.indexOf('#');
      const cleanPath = hashIdx !== -1 ? filePath.substring(0, hashIdx) : filePath;
      const targetPath = path.resolve(expandHome(cleanPath));

      logSensitivePathAccess(targetPath);

      const fileHandle = await fs.open(targetPath, "r");
      try {
        const buffer = Buffer.alloc(50 * 1024);
        const { bytesRead } = await fileHandle.read(
          buffer,
          0,
          buffer.length,
          0,
        );
        return buffer.toString("utf8", 0, bytesRead);
      } finally {
        await fileHandle.close();
      }
    } catch (err: unknown) {
      console.error(`Failed to read file head: ${filePath}`, err);
      return { __ipcError: true, message: (err as Error).message };
    }
  }

  async writeFile(filePath: string, content: string) {
    try {
      const hashIdx = filePath.indexOf('#');
      const cleanPath = hashIdx !== -1 ? filePath.substring(0, hashIdx) : filePath;
      const targetPath = path.resolve(expandHome(cleanPath));

      logSensitivePathAccess(targetPath);

      await fs.writeFile(targetPath, content, "utf8");
      return true;
    } catch (err: unknown) {
      console.error(`Failed to write file: ${filePath}`, err);
      return { __ipcError: true, message: (err as Error).message };
    }
  }

  async getGitStatus(cwd: string): Promise<Record<string, "M" | "U" | "A" | "D">> {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      let repoRoot = targetDir;
      try {
        const { stdout: rootOut } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: targetDir });
        if (rootOut.trim()) repoRoot = rootOut.trim();
      } catch { /* intentional ignore */ }

      const { stdout } = await execFileAsync("git", ["status", "--porcelain", "-u"], { cwd: repoRoot });
      const statusMap: Record<string, "M" | "U" | "A" | "D"> = {};
      const lines = stdout.split("\n");

      for (const line of lines) {
        if (!line || line.length < 4) continue;
        const code = line.substring(0, 2);
        const gitPath = line.substring(3).trim();

        const fullGitPath = path.resolve(repoRoot, gitPath);
        const computedRel = path.relative(targetDir, fullGitPath);
        if (computedRel.startsWith("..") || path.isAbsolute(computedRel)) {
          continue;
        }
        const relPath = computedRel;

        let status: "M" | "U" | "A" | "D" = "M";
        if (code.includes("M")) {
          status = "M";
        } else if (code.includes("A") || code === "??") {
          status = code === "??" ? "U" : "A";
        } else if (code.includes("D")) {
          status = "D";
        }

        statusMap[relPath] = status;

        if (relPath.includes("/")) {
          const topFolder = relPath.split("/")[0]!;
          if (!statusMap[topFolder]) {
            statusMap[topFolder] = status;
          }
        }
      }
      return statusMap;
    } catch {
      return {};
    }
  }

  async getGitDetailedStatus(cwd: string) {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      let repoRoot = targetDir;
      try {
        const { stdout: rootOut } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: targetDir });
        if (rootOut.trim()) repoRoot = rootOut.trim();
      } catch {
        return { isGit: false, repoRoot: "", branch: "", ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [] };
      }

      let branch = "HEAD";
      try {
        const { stdout: bOut } = await execFileAsync("git", ["branch", "--show-current"], { cwd: repoRoot });
        branch = bOut.trim() || "HEAD";
      } catch { /* intentional ignore */ }

      let ahead = 0;
      let behind = 0;
      try {
        const { stdout: revOut } = await execFileAsync("git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], { cwd: repoRoot });
        const [a, b] = revOut.trim().split(/\s+/);
        ahead = parseInt(a || "0", 10) || 0;
        behind = parseInt(b || "0", 10) || 0;
      } catch { /* intentional ignore */ }

      const { stdout: statusOut } = await execFileAsync("git", ["status", "--porcelain", "-u"], { cwd: repoRoot });
      const staged: Array<{ path: string; status: string }> = [];
      const unstaged: Array<{ path: string; status: string }> = [];
      const untracked: Array<{ path: string }> = [];

      const lines = statusOut.split("\n");
      for (const line of lines) {
        if (!line || line.length < 3) continue;
        const x = line[0];
        const y = line[1];
        const filePath = line.substring(3).trim();

        if (x === "?" && y === "?") {
          untracked.push({ path: filePath });
        } else {
          if (x && x !== " " && x !== "?") {
            staged.push({ path: filePath, status: x });
          }
          if (y && y !== " " && y !== "?") {
            unstaged.push({ path: filePath, status: y });
          }
        }
      }

      return {
        isGit: true,
        repoRoot,
        branch,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
      };
    } catch {
      return { isGit: false, repoRoot: "", branch: "", ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [] };
    }
  }

  async gitStage(cwd: string, files: string[] = []) {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      if (!files || files.length === 0 || files.includes(".")) {
        await execFileAsync("git", ["add", "-A"], { cwd: targetDir });
      } else {
        await execFileAsync("git", ["add", "--", ...files], { cwd: targetDir });
      }
      return { success: true };
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      return { success: false, error: e.stderr || e.message || String(err) };
    }
  }

  async gitUnstage(cwd: string, files: string[] = []) {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      if (!files || files.length === 0 || files.includes(".")) {
        try {
          await execFileAsync("git", ["restore", "--staged", "."], { cwd: targetDir });
        } catch {
          await execFileAsync("git", ["reset", "HEAD"], { cwd: targetDir });
        }
      } else {
        try {
          await execFileAsync("git", ["restore", "--staged", "--", ...files], { cwd: targetDir });
        } catch {
          await execFileAsync("git", ["reset", "HEAD", "--", ...files], { cwd: targetDir });
        }
      }
      return { success: true };
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      return { success: false, error: e.stderr || e.message || String(err) };
    }
  }

  async gitDiscard(cwd: string, files: string[]) {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      if (!files || files.length === 0) return { success: true };
      try {
        await execFileAsync("git", ["restore", "--", ...files], { cwd: targetDir });
      } catch {
        await execFileAsync("git", ["checkout", "--", ...files], { cwd: targetDir });
      }
      // Also clean untracked if any
      try {
        await execFileAsync("git", ["clean", "-f", "--", ...files], { cwd: targetDir });
      } catch { /* intentional ignore */ }
      return { success: true };
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      return { success: false, error: e.stderr || e.message || String(err) };
    }
  }

  async gitCommit(cwd: string, message: string) {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      if (!message || message.trim() === "") {
        return { success: false, error: "Commit message cannot be empty" };
      }
      const { stdout } = await execFileAsync("git", ["commit", "-m", message.trim()], { cwd: targetDir });
      return { success: true, output: stdout.trim() };
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      return { success: false, error: e.stderr || e.message || String(err) };
    }
  }

  async gitPush(cwd: string) {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      const { stdout } = await execFileAsync("git", ["push"], { cwd: targetDir });
      return { success: true, output: stdout.trim() };
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      return { success: false, error: e.stderr || e.message || String(err) };
    }
  }

  async gitPull(cwd: string) {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      const { stdout } = await execFileAsync("git", ["pull"], { cwd: targetDir });
      return { success: true, output: stdout.trim() };
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      return { success: false, error: e.stderr || e.message || String(err) };
    }
  }

  async getGitBranches(cwd: string) {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      const { stdout } = await execFileAsync("git", ["branch", "--list", "--no-color"], { cwd: targetDir });
      let current = "";
      const branches: string[] = [];
      for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("* ")) {
          current = trimmed.substring(2);
          branches.push(current);
        } else {
          branches.push(trimmed);
        }
      }
      return { current, all: branches };
    } catch {
      return { current: "", all: [] };
    }
  }

  async gitCheckout(cwd: string, branch: string) {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      const { stdout } = await execFileAsync("git", ["checkout", branch], { cwd: targetDir });
      return { success: true, output: stdout.trim() };
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      return { success: false, error: e.stderr || e.message || String(err) };
    }
  }

  async getGitLog(cwd: string, limit: number = 20) {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      const { stdout } = await execFileAsync(
        "git",
        ["log", `-n${limit}`, "--format=%H%x00%an%x00%ar%x00%s"],
        { cwd: targetDir }
      );
      const commits: Array<{ hash: string; author: string; date: string; message: string }> = [];
      const lines = stdout.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        const [hash, author, date, message] = line.split("\x00");
        if (hash) {
          commits.push({
            hash,
            author: author || "",
            date: date || "",
            message: message || "",
          });
        }
      }
      return commits;
    } catch {
      return [];
    }
  }

  async getGitDiff(cwd: string, filePath: string): Promise<string> {
    try {
      const targetDir = path.resolve(expandHome(cwd));
      const relPath = path.isAbsolute(filePath) ? path.relative(targetDir, filePath) : filePath;
      try {
        const { stdout } = await execFileAsync("git", ["diff", "HEAD", "--", relPath], { cwd: targetDir });
        if (stdout.trim()) return stdout;
      } catch { /* intentional ignore */ }

      const { stdout: diffUntracked } = await execFileAsync("git", ["diff", "--", relPath], { cwd: targetDir });
      return diffUntracked;
    } catch {
      return "";
    }
  }
}

export async function initWorkspaceManager() {
  const workspaceService = new WorkspaceService();

  // Create ~/.config/vet/bin/e (skip if fs operations are stubbed/mocked in tests)
  if (fs.mkdir && fs.writeFile && fs.chmod && fs.access) {
    try {
      const binDir = path.join(os.homedir(), ".config", "vet", "bin");
      await fs.mkdir(binDir, { recursive: true });
      const editScriptPath = path.join(binDir, "e");
      
      let exists = false;
      try {
        await fs.access(editScriptPath);
        exists = true;
      } catch { /* intentional ignore */ }

      if (!exists) {
        const scriptContent = `#!/bin/bash
if [ -z "$1" ]; then
  echo "Usage: e <filename>"
  exit 1
fi
FILE_PATH=$(realpath "$1")
printf "\\033]999;edit;%s\\007" "$FILE_PATH"
`;
        await fs.writeFile(editScriptPath, scriptContent, "utf8");
        await fs.chmod(editScriptPath, 0o755);
      }
    } catch (err) {
      console.error("Failed to initialize e command script:", err);
    }
  }

  ipcMain.handle("workspace:getScripts", async (event, cwd?: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:getScripts from untrusted sender");
      return null;
    }
    return workspaceService.getScripts(cwd);
  });

  ipcMain.handle("workspace:list-dir", async (event, dirPath: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:list-dir from untrusted sender");
      return [];
    }
    if (!validPathInput(dirPath)) {
      return [];
    }
    return workspaceService.listDir(dirPath);
  });

  ipcMain.handle("workspace:search-files", async (event, dirPath: string, query: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:search-files from untrusted sender");
      return [];
    }
    if (!validPathInput(dirPath) || (typeof query !== "string" || query.length > 512)) {
      return [];
    }
    return workspaceService.searchFiles(dirPath, query);
  });

  ipcMain.handle(
    "workspace:search-file-contents",
    async (
      event,
      dirPath: string,
      query: string,
      options?: { caseSensitive?: boolean; wholeWord?: boolean; isRegex?: boolean; maxResults?: number },
    ) => {
      if (!isTrustedSender(event)) {
        console.warn("[security] Blocked workspace:search-file-contents from untrusted sender");
        return [];
      }
      if (!validPathInput(dirPath) || typeof query !== "string" || query.length > 512) {
        return [];
      }
      return workspaceService.searchFileContents(dirPath, query, options);
    },
  );

  ipcMain.handle("workspace:reveal-path", async (event, itemPath: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:reveal-path from untrusted sender");
      return;
    }
    if (!nonEmptyPathInput(itemPath)) {
      return;
    }
    return workspaceService.revealPath(itemPath);
  });

  ipcMain.handle("workspace:read-file-head", async (event, filePath: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:read-file-head from untrusted sender");
      return { __ipcError: true, message: "Access denied" };
    }
    if (!nonEmptyPathInput(filePath)) {
      return { __ipcError: true, message: "Invalid path" };
    }
    return workspaceService.readFileHead(filePath);
  });

  ipcMain.handle("workspace:write-file", async (event, filePath: string, content: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:write-file from untrusted sender");
      return { __ipcError: true, message: "Access denied" };
    }
    if (!nonEmptyPathInput(filePath) || typeof content !== "string" || content.length > MAX_FILE_WRITE_BYTES) {
      return { __ipcError: true, message: "Invalid path or content too large" };
    }
    const hashIdx = filePath.indexOf('#');
    const cleanPath = hashIdx !== -1 ? filePath.substring(0, hashIdx) : filePath;
    const resolvedWritePath = path.resolve(expandHome(cleanPath));
    if (isSensitiveWritePath(resolvedWritePath)) {
      console.warn(`[security] Blocked write to sensitive path: ${resolvedWritePath}`);
      return { __ipcError: true, message: "Access denied: sensitive path" };
    }
    return workspaceService.writeFile(filePath, content);
  });

  ipcMain.handle("workspace:get-git-status", async (event, cwd: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:get-git-status from untrusted sender");
      return {};
    }
    if (!validPathInput(cwd)) {
      return {};
    }
    return workspaceService.getGitStatus(cwd);
  });

  ipcMain.handle("workspace:git-detailed-status", async (event, cwd: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:git-detailed-status from untrusted sender");
      return { isGit: false, repoRoot: "", branch: "", ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [] };
    }
    if (!validPathInput(cwd)) {
      return { isGit: false, repoRoot: "", branch: "", ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [] };
    }
    return workspaceService.getGitDetailedStatus(cwd);
  });

  ipcMain.handle("workspace:git-stage", async (event, cwd: string, files?: string[]) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:git-stage from untrusted sender");
      return { success: false, error: "Access denied" };
    }
    if (!validPathInput(cwd)) return { success: false, error: "Invalid cwd" };
    return workspaceService.gitStage(cwd, files);
  });

  ipcMain.handle("workspace:git-unstage", async (event, cwd: string, files?: string[]) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:git-unstage from untrusted sender");
      return { success: false, error: "Access denied" };
    }
    if (!validPathInput(cwd)) return { success: false, error: "Invalid cwd" };
    return workspaceService.gitUnstage(cwd, files);
  });

  ipcMain.handle("workspace:git-discard", async (event, cwd: string, files: string[]) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:git-discard from untrusted sender");
      return { success: false, error: "Access denied" };
    }
    if (!validPathInput(cwd)) return { success: false, error: "Invalid cwd" };
    return workspaceService.gitDiscard(cwd, files);
  });

  ipcMain.handle("workspace:git-commit", async (event, cwd: string, message: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:git-commit from untrusted sender");
      return { success: false, error: "Access denied" };
    }
    if (!validPathInput(cwd) || typeof message !== "string") {
      return { success: false, error: "Invalid parameters" };
    }
    return workspaceService.gitCommit(cwd, message);
  });

  ipcMain.handle("workspace:git-push", async (event, cwd: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:git-push from untrusted sender");
      return { success: false, error: "Access denied" };
    }
    if (!validPathInput(cwd)) return { success: false, error: "Invalid cwd" };
    return workspaceService.gitPush(cwd);
  });

  ipcMain.handle("workspace:git-pull", async (event, cwd: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:git-pull from untrusted sender");
      return { success: false, error: "Access denied" };
    }
    if (!validPathInput(cwd)) return { success: false, error: "Invalid cwd" };
    return workspaceService.gitPull(cwd);
  });

  ipcMain.handle("workspace:git-branches", async (event, cwd: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:git-branches from untrusted sender");
      return { current: "", all: [] };
    }
    if (!validPathInput(cwd)) return { current: "", all: [] };
    return workspaceService.getGitBranches(cwd);
  });

  ipcMain.handle("workspace:git-checkout", async (event, cwd: string, branch: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:git-checkout from untrusted sender");
      return { success: false, error: "Access denied" };
    }
    if (!validPathInput(cwd) || typeof branch !== "string") {
      return { success: false, error: "Invalid parameters" };
    }
    return workspaceService.gitCheckout(cwd, branch);
  });

  ipcMain.handle("workspace:git-log", async (event, cwd: string, limit?: number) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:git-log from untrusted sender");
      return [];
    }
    if (!validPathInput(cwd)) return [];
    return workspaceService.getGitLog(cwd, limit);
  });

  ipcMain.handle("workspace:get-git-diff", async (event, cwd: string, filePath: string) => {
    if (!isTrustedSender(event)) {
      console.warn("[security] Blocked workspace:get-git-diff from untrusted sender");
      return "";
    }
    if (!validPathInput(cwd) || !nonEmptyPathInput(filePath)) {
      return "";
    }
    const hashIdx = filePath.indexOf('#');
    const cleanFilePath = hashIdx !== -1 ? filePath.substring(0, hashIdx) : filePath;
    return workspaceService.getGitDiff(cwd, cleanFilePath);
  });
}
