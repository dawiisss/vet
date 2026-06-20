import { spawn } from "node-pty";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { platform } from "os";
import { getConfig } from "./config";
import * as historyDb from "./historyDb";
import { createSshPty } from "./sshPty";

const execFileAsync = promisify(execFile);

interface PtyProcess {
  pty: ReturnType<typeof spawn>;
  id: string;
}

const terminals: Map<string, PtyProcess> = new Map();
const forwardTargets: Map<string, (event: string, ...args: unknown[]) => void> =
  new Map();
const terminalHistories: Map<string, string> = new Map();
const terminalSshHosts: Map<string, string> = new Map();
const outputBuffers: Map<string, string> = new Map();
const outputTimeouts: Map<string, NodeJS.Timeout> = new Map();
const foregroundTerminalIds: Set<string> = new Set();
const terminalHistoryOrder: string[] = [];
const MAX_BACKGROUND_TERMINAL_HISTORIES = 4;

const SAFE_COMMANDS = new Set([
  "bash",
  "sh",
  "zsh",
  "fish",
  "dash",
  "ksh",
  "csh",
  "tcsh",
  "ash",
  "git-bash.exe",
  "git-bash",
  "tmux",
  "screen",
  "node",
  "python",
  "python3",
  "python2",
  "ssh",
  "docker",
  "kubectl",
  "cmd.exe",
  "cmd",
  "powershell.exe",
  "powershell",
  "pwsh.exe",
  "pwsh",
  "wsl.exe",
  "wsl",
]);

function isValidShell(shellPath: string): boolean {
  if (!shellPath) return false;
  const baseName = path.basename(shellPath).toLowerCase();
  if (SAFE_COMMANDS.has(baseName)) {
    return true;
  }
  
  // Option B: Allow user-configured shells from config
  try {
    const config = getConfig();
    if (config.allowedShells && Array.isArray(config.allowedShells)) {
      const userAllowed = config.allowedShells.map((s: string) =>
        path.basename(s).toLowerCase(),
      );
      if (userAllowed.includes(baseName)) {
        return true;
      }
    }
  } catch (e) {
    console.warn("Failed to retrieve allowed shells from config:", e);
  }
  
  return false;
}

export function setForwardTarget(
  terminalId: string,
  target: (event: string, ...args: unknown[]) => void,
): void {
  forwardTargets.set(terminalId, target);
}

export function removeForwardTarget(terminalId: string): void {
  forwardTargets.delete(terminalId);
}

export function getHistory(id: string): {
  data: string;
  oldestTimestamp: number;
} {
  const config = getConfig();
  if (config.historyLoggingEnabled === false) {
    return {
      data: terminalHistories.get(id) || "",
      oldestTimestamp: Date.now(),
    };
  } else {
    const chunks = historyDb.getScrollbackChunk(id, Date.now() + 100000);
    if (!chunks || chunks.length === 0) {
      return { data: "", oldestTimestamp: Date.now() };
    }
    return {
      data: chunks.map((c) => c.data).join(""),
      oldestTimestamp: chunks[0]!.timestamp,
    };
  }
}

export function setForegroundTerminals(ids: string[]): void {
  const newSet = new Set(ids);

  for (const id of foregroundTerminalIds) {
    if (!newSet.has(id)) {
      const idx = terminalHistoryOrder.indexOf(id);
      if (idx !== -1) {
        terminalHistoryOrder.splice(idx, 1);
      }
      terminalHistoryOrder.unshift(id);
    }
  }

  for (const id of ids) {
    const idx = terminalHistoryOrder.indexOf(id);
    if (idx !== -1) {
      terminalHistoryOrder.splice(idx, 1);
    }
  }

  while (terminalHistoryOrder.length > MAX_BACKGROUND_TERMINAL_HISTORIES) {
    const evicted = terminalHistoryOrder.pop()!;
    terminalHistories.delete(evicted);
  }

  foregroundTerminalIds.clear();
  for (const id of ids) {
    foregroundTerminalIds.add(id);
  }
}

export function createTerminal(options: {
  cwd?: string;
  profileId?: string | undefined;
  sshHostId?: string | undefined;
  cols?: number;
  rows?: number;
}): string {
  const id = uuidv4();
  if (options.sshHostId) {
    terminalSshHosts.set(id, options.sshHostId);
  }
  const config = getConfig();

  let pty: ReturnType<typeof spawn>;
  let connectionType = "local";
  let connectionTarget = "localhost";
  let resolvedCwd = options.cwd || process.cwd();

  const cleanEnv: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

  let sshHost: any = null;
  if (options.sshHostId) {
    sshHost = (config.sshHosts || []).find(
      (h: any) => h.id === options.sshHostId,
    );
  }

  try {
    if (sshHost) {
      connectionType = "ssh";
      connectionTarget = `${sshHost.username}@${sshHost.host}`;
      pty = createSshPty(sshHost, cleanEnv, options.cols, options.rows);
    } else {
      let shell = process.env["SHELL"] || "/bin/bash";
      let args: string[] = [];
      let env = { ...process.env } as Record<string, string>;

      if (
        config.profiles &&
        Array.isArray(config.profiles) &&
        config.profiles.length > 0
      ) {
        const profile =
          config.profiles.find((p: any) => p.id === options.profileId) ||
          config.profiles[0];
        if (profile) {
          if (profile.shell) shell = profile.shell;
          if (profile.args) args = profile.args;
          if (profile.env) env = { ...env, ...profile.env };
          if (profile.cwd && !options.cwd) resolvedCwd = profile.cwd;
        }
      }

      if (!isValidShell(shell)) {
        console.warn(
          `Blocked attempt to launch invalid shell: ${shell}. Falling back to default shell.`,
        );
        shell =
          process.platform === "win32"
            ? "cmd.exe"
            : process.env["SHELL"] || "/bin/bash";
      }

      // Handle ~ in resolvedCwd manually
      if (resolvedCwd.startsWith("~") && process.env.HOME) {
        resolvedCwd = resolvedCwd.replace(/^~/, process.env.HOME);
      }

      // Validate resolvedCwd exists and is a directory
      try {
        if (fs.existsSync(resolvedCwd)) {
          const stat = fs.statSync(resolvedCwd);
          if (!stat.isDirectory()) {
            resolvedCwd = process.env.HOME || process.cwd();
          }
        } else {
          resolvedCwd = process.env.HOME || process.cwd();
        }
      } catch (err) {
        console.warn(`Failed to validate/resolve cwd '${resolvedCwd}', falling back:`, err);
        resolvedCwd = process.env.HOME || process.cwd();
      }

      const cleanEnvLocal = { ...cleanEnv };
      if (env && typeof env === "object") {
        for (const [key, value] of Object.entries(env)) {
          if (typeof key === "string" && typeof value === "string") {
            if (key.length < 256 && value.length < 8192) {
              cleanEnvLocal[key] = value;
            }
          }
        }
      }

      pty = spawn(shell, args, {
        name: "xterm-256color",
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd: resolvedCwd,
        env: cleanEnvLocal,
      });

      if (shell.endsWith("ssh")) {
        connectionType = "ssh";
        connectionTarget = args[0] || "remote";
      } else if (shell.endsWith("docker") && args[0] === "exec") {
        connectionType = "docker";
        const itIdx = args.indexOf("-it");
        connectionTarget = itIdx >= 0 ? args[itIdx + 1] || "container" : "container";
      }
    }
  } catch (err: any) {
    console.error("Failed to spawn PTY process:", err);
    throw new Error(`Failed to spawn terminal process: ${err?.message || err}`);
  }

  try {
    historyDb.startSession(
      id,
      `${path.basename(resolvedCwd || "unknown")} : ${path.basename(pty.process || "unknown")}`,
      connectionType,
      connectionTarget,
    );
  } catch (e) {
    console.error("Failed to start database session for terminal:", e);
  }

  pty.onData((data: string) => {
    outputBuffers.set(id, (outputBuffers.get(id) || "") + data);
    if (!outputTimeouts.has(id)) {
      outputTimeouts.set(
        id,
        setTimeout(() => {
          const bufferedData = outputBuffers.get(id);
          if (bufferedData) {
            const history = terminalHistories.get(id) || "";
            terminalHistories.set(id, (history + bufferedData).slice(-100000));
            try {
              historyDb.logOutput(id, bufferedData);
            } catch (e) {
              console.error("Failed to log terminal output:", e);
            }

            const target = forwardTargets.get(id);
            if (target) {
              target("terminal:data", { id, data: bufferedData });
            }
          }
          outputBuffers.delete(id);
          outputTimeouts.delete(id);
        }, 10),
      );
    }
  });

  pty.onExit(({ exitCode }: { exitCode: number }) => {
    try {
      const timeout = outputTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        outputTimeouts.delete(id);
      }
      const bufferedData = outputBuffers.get(id);
      if (bufferedData) {
        const target = forwardTargets.get(id);
        if (target) {
          target("terminal:data", { id, data: bufferedData });
        }
        try {
          historyDb.logOutput(id, bufferedData);
        } catch (e) {
          console.error("Failed to log terminal output on exit:", e);
        }
      }
      outputBuffers.delete(id);

      const target = forwardTargets.get(id);
      if (target) {
        target("terminal:exit", { id, exitCode });
      }
      try {
        historyDb.closeSession(id);
      } catch (e) {
        console.error("Failed to close database session on exit:", e);
      }
    } finally {
      terminals.delete(id);
      forwardTargets.delete(id);
      terminalHistories.delete(id);
      terminalSshHosts.delete(id);
    }
  });

  terminals.set(id, { pty, id });
  return id;
}

export function writeToTerminal(id: string, data: string): void {
  const terminal = terminals.get(id);
  if (terminal) {
    try {
      terminal.pty.write(data);
    } catch (e) {
      console.error(`Failed to write to terminal ${id}:`, e);
    }
  }
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  const terminal = terminals.get(id);
  if (terminal) {
    try {
      terminal.pty.resize(cols, rows);
    } catch (e) {
      console.error(`Failed to resize terminal ${id}:`, e);
    }
  }
}

export function destroyTerminal(id: string): void {
  const terminal = terminals.get(id);
  if (terminal) {
    const timeout = outputTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      outputTimeouts.delete(id);
    }
    outputBuffers.delete(id);

    try {
      terminal.pty.kill();
    } catch (e) {
      console.error(`Failed to kill terminal PTY process ${id}:`, e);
    }
    try {
      historyDb.closeSession(id);
    } catch (e) {
      console.error(`Failed to close database session for terminal ${id}:`, e);
    }
    terminals.delete(id);
    forwardTargets.delete(id);
    terminalHistories.delete(id);
    terminalSshHosts.delete(id);
  }
}

export async function getTerminalInfo(
  id: string,
): Promise<{ title: string; cwd: string; sshHostId?: string | undefined }> {
  const terminal = terminals.get(id);
  const sshHostId = terminalSshHosts.get(id);
  if (!terminal) return { title: "Terminal", cwd: "", sshHostId };

  let cwd = "";
  let dynamicSshTarget = "";
  let finalProcName = path.basename(terminal.pty.process || "shell");

  try {
    if (platform() === "linux" || platform() === "darwin") {
      // Find foreground process group
      const { stdout: tpgidOut } = await execFileAsync("ps", [
        "-o",
        "tpgid=",
        "-p",
        String(terminal.pty.pid),
      ]);
      const tpgid = tpgidOut.trim();
      if (tpgid && tpgid !== String(terminal.pty.pid)) {
        const { stdout: pgrepOut } = await execFileAsync("pgrep", [
          "-g",
          tpgid,
        ]);
        const pids = pgrepOut.trim().split("\n").filter(Boolean);
        const cleanPids = pids.filter((p) => /^\d+$/.test(p));
        if (cleanPids.length > 0) {
          const { stdout: psOut } = await execFileAsync("ps", [
            "-o",
            "comm=,args=",
            "-p",
            cleanPids.join(","),
          ]);
          const lines = psOut.trim().split("\n");
          for (const line of lines) {
            const cmd = line.trim();
            if (!cmd) continue;
            const parts = cmd.split(/\s+/);
            const comm = parts[0];
            if (comm && (comm === "ssh" || comm.endsWith("/ssh"))) {
              finalProcName = "ssh";
              const args = cmd.substring(comm.length).trim().split(/\s+/);
              for (let i = args.length - 1; i >= 0; i--) {
                const arg = args[i];
                if (arg && !arg.startsWith("-")) {
                  dynamicSshTarget = arg;
                  break;
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Failed to resolve dynamic foreground process ssh target:", err);
  }

  try {
    if (platform() === "linux") {
      cwd = await fs.promises.readlink(`/proc/${terminal.pty.pid}/cwd`);
    } else if (platform() === "darwin") {
      const { stdout } = await execFileAsync("lsof", [
        "-a",
        "-d",
        "cwd",
        "-p",
        String(terminal.pty.pid),
        "-Fn",
      ]);
      const lines = stdout.split("\n");
      for (const line of lines) {
        if (line.startsWith("n")) {
          cwd = line.slice(1);
          break;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to resolve terminal cwd path:", err);
  }

  const resolvedCwd = cwd || process.cwd();
  const folder = resolvedCwd
    ? resolvedCwd === "/"
      ? "/"
      : path.basename(resolvedCwd)
    : "?";

  let effectiveSshHostId = sshHostId;
  if (!effectiveSshHostId && dynamicSshTarget) {
    effectiveSshHostId = `auto-${dynamicSshTarget}`;
  }

  return {
    title: `${folder} : ${finalProcName}`,
    cwd: resolvedCwd,
    sshHostId: effectiveSshHostId,
  };
}

export function getPtyPids(): number[] {
  return Array.from(terminals.values()).map((t) => t.pty.pid);
}
