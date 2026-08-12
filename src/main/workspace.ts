import { ipcMain, shell, BrowserWindow } from "electron";
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
      // Find package.json in cwd or its parents up to 3 levels
      let currentDir = cwd || process.cwd();
      for (let i = 0; i < 3; i++) {
        const pkgPath = path.join(currentDir, "package.json");
        try {
          const content = await fs.readFile(pkgPath, "utf-8");
          const pkg = JSON.parse(content);
          if (pkg && pkg.scripts) {
            return { cwd: currentDir, scripts: pkg.scripts };
          }
        } catch {
          // not found or not parsable, go up
          const parentDir = path.dirname(currentDir);
          if (parentDir === currentDir) break;
          currentDir = parentDir;
        }
      }
      return null;
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
        // Skip reading stats for heavy files to avoid PTY/Main blocks
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
    } catch (err: any) {
      console.error(`Failed to read file head: ${filePath}`, err);
      return { __ipcError: true, message: err.message };
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
    } catch (err: any) {
      console.error(`Failed to write file: ${filePath}`, err);
      return { __ipcError: true, message: err.message };
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

      const relCwd = path.relative(repoRoot, targetDir);

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
