import { ipcMain, shell } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { sortDirectoryItems } from "../shared/utils/pathUtils";

function isPathAllowed(targetPath: string): boolean {
  try {
    const resolvedPath = path.resolve(targetPath);
    const homeDir = os.homedir();

    // Sensitive directories to monitor
    const sensitivePaths = [
      path.join(homeDir, ".ssh"),
      path.join(homeDir, ".gnupg"),
      path.join(homeDir, ".aws"),
      path.join(homeDir, ".config", "vet"),
      "/etc/shadow",
      "/etc/passwd",
    ];

    for (const sp of sensitivePaths) {
      if (resolvedPath === sp || resolvedPath.startsWith(sp + path.sep)) {
        console.warn(`[security] Accessing sensitive path: ${resolvedPath}`);
      }
    }

    return true; // Option C: Allow all paths, but log warnings for sensitive ones
  } catch {
    return true;
  }
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
        } catch (err) {
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
      let targetPath = dirPath;
      if (targetPath.startsWith("~") && process.env.HOME) {
        targetPath = targetPath.replace(/^~/, process.env.HOME);
      }

      isPathAllowed(targetPath);

      const files = await fs.readdir(targetPath);
      const items: any[] = [];

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
        } catch {
          // Ignore files that fail stat (e.g. broken symlinks)
        }
      }

      return sortDirectoryItems(items);
    } catch (err) {
      console.error(`Failed to list directory: ${dirPath}`, err);
      return [];
    }
  }

  revealPath(itemPath: string) {
    try {
      let targetPath = itemPath;
      if (targetPath.startsWith("~") && process.env.HOME) {
        targetPath = targetPath.replace(/^~/, process.env.HOME);
      }

      isPathAllowed(targetPath);

      shell.showItemInFolder(targetPath);
    } catch (err) {
      console.error(`Failed to reveal path: ${itemPath}`, err);
    }
  }

  async readFileHead(filePath: string) {
    try {
      let targetPath = filePath;
      if (targetPath.startsWith("~") && process.env.HOME) {
        targetPath = targetPath.replace(/^~/, process.env.HOME);
      }

      isPathAllowed(targetPath);

      // Read first 50KB only to prevent main process memory bloat
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
      return `Error: Failed to read file. ${err.message}`;
    }
  }
}

export function initWorkspaceManager() {
  const workspaceService = new WorkspaceService();

  ipcMain.handle("workspace:getScripts", async (_, cwd?: string) => {
    return workspaceService.getScripts(cwd);
  });

  ipcMain.handle("workspace:list-dir", async (_, dirPath: string) => {
    return workspaceService.listDir(dirPath);
  });

  ipcMain.handle("workspace:reveal-path", async (_, itemPath: string) => {
    return workspaceService.revealPath(itemPath);
  });

  ipcMain.handle("workspace:read-file-head", async (_, filePath: string) => {
    return workspaceService.readFileHead(filePath);
  });
}
