import { spawn } from "node-pty";

/**
 * Spawns a PTY process connected via SSH.
 */
export function createSshPty(host: SshHost, cleanEnv: Record<string, string>) {
  const shell = "ssh";
  const args: string[] = [];
  if (host.port) {
    args.push("-p", String(host.port));
  }
  if (host.authType === "key" && host.privateKeyPath) {
    let keyPath = host.privateKeyPath;
    if (keyPath.startsWith("~") && process.env.HOME) {
      keyPath = keyPath.replace(/^~/, process.env.HOME);
    }
    args.push("-i", keyPath);
  }
  args.push(`${host.username}@${host.host}`);

  return spawn(shell, args, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || process.cwd(),
    env: cleanEnv,
  });
}
