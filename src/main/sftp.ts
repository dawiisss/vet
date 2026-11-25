import { ipcMain, app } from "electron";
import { Client, SFTPWrapper, type ConnectConfig } from "ssh2";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import os from "os";
import { createHash, randomUUID } from "node:crypto";
import { getConfig, onConfigChanged } from "./config";
import { sortDirectoryItems } from "../shared/utils/pathUtils";
import { isTrustedSender } from "./ipc/ipcUtils";

interface SftpSession {
  sftp: SFTPWrapper;
  homeDir: string;
}

interface SftpRevision {
  fingerprint: string;
  connectionId: string;
  verifiedHostKey?: string;
  controller: AbortController;
  session?: Promise<SftpSession>;
}

type SftpHostConfig = Omit<SshHost, "name" | "authType"> & { authType: SshHost["authType"] | "auto" };

const revisions = new Map<string, SftpRevision>();
const tempPasswords = new Map<string, string>();
let unsubscribeConfig: (() => void) | undefined;

const connectionChanged = () => new Error("SSH connection settings changed. Reconnect the SSH terminal or close and reopen the remote file.");

function knownHostsFilePath(): string {
  return path.join(app.getPath("userData"), "sftp_known_hosts.json");
}

function loadKnownHosts(): Record<string, string> {
  try {
    const raw = fsSync.readFileSync(knownHostsFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { /* intentional ignore */ return {}; }
}

function saveKnownHosts(hosts: Record<string, string>): void {
  try {
    fsSync.mkdirSync(path.dirname(knownHostsFilePath()), { recursive: true });
    fsSync.writeFileSync(knownHostsFilePath(), JSON.stringify(hosts, null, 2), {
      mode: 0o600,
    });
  } catch { /* intentional ignore */ }
}

/**
 * TOFU host-key verification: pins the first-seen host key per host:port and
 * rejects subsequent connections whose key differs (possible MITM).
 */
function makeHostVerifier(host: string, port: number) {
  return (key: Buffer): boolean => {
    try {
      const fingerprint = key.toString("base64");
      const hostKey = `${host}:${port}`;
      const known = loadKnownHosts();
      const existing = known[hostKey];
      if (existing === undefined) {
        known[hostKey] = fingerprint;
        saveKnownHosts(known);
        return true;
      }
      if (existing === fingerprint) return true;
      console.error(
        `[security] Host key mismatch for ${hostKey} — possible MITM, connection rejected`,
      );
      return false;
    } catch (err) {
      console.error("[security] Failed to verify host key:", err);
      return false;
    }
  };
}

function resolveSftpHost(sshHostId: string): SftpHostConfig {
  const hosts: SshHost[] = getConfig().sshHosts ?? [];
  const configured = hosts.find((host) => host.id === sshHostId);
  if (configured) return configured;
  if (!sshHostId.startsWith("auto-")) throw new Error("SSH Host profile not found");

  const target = sshHostId.slice(5);
  const at = target.lastIndexOf("@");
  const host = target.slice(at + 1);
  const username = at === -1 ? process.env.USER || "root" : target.slice(0, at);
  return hosts.find((entry) => entry.host === host && (at === -1 || entry.username === username)) ??
    { id: sshHostId, host, username, port: 22, authType: "auto" };
}

function connectionFingerprint(host: SftpHostConfig): string {
  const identity = [host.id, host.host, host.port || 22, host.username, host.authType,
    host.password, host.privateKeyPath, host.passphrase];
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

function invalidateRevision(sshHostId: string, revision: SftpRevision): void {
  revisions.delete(sshHostId);
  tempPasswords.delete(sshHostId);
  revision.controller.abort(connectionChanged());
}

function invalidateChangedSessions(): void {
  for (const [id, revision] of revisions) {
    try {
      if (revision.fingerprint === connectionFingerprint(resolveSftpHost(id))) continue;
    } catch {
      /* The profile was deleted. */
    }
    invalidateRevision(id, revision);
  }
}

function getSftpRevision(sshHostId: string, hostConfig: SftpHostConfig, expectedConnectionId?: string): SftpRevision {
  const fingerprint = connectionFingerprint(hostConfig);
  let revision = revisions.get(sshHostId);
  if (revision && revision.fingerprint !== fingerprint) {
    invalidateRevision(sshHostId, revision);
    revision = undefined;
  }
  if (expectedConnectionId !== undefined && expectedConnectionId !== revision?.connectionId) {
    throw connectionChanged();
  }
  if (!revision) {
    revision = { fingerprint, connectionId: randomUUID(), controller: new AbortController() };
    revisions.set(sshHostId, revision);
  }
  return revision;
}

export function getSftpConnectionId(sshHostId: string): string {
  return getSftpRevision(sshHostId, resolveSftpHost(sshHostId)).connectionId;
}

async function getSftpSession(sshHostId: string, expectedConnectionId?: string) {
  let hostConfig: SftpHostConfig;
  try {
    hostConfig = resolveSftpHost(sshHostId);
  } catch (error) {
    if (expectedConnectionId !== undefined) throw connectionChanged();
    throw error;
  }
  const current = getSftpRevision(sshHostId, hostConfig, expectedConnectionId);
  if (!current.session) {
    const password = hostConfig.authType === "auto" ? tempPasswords.get(sshHostId) : undefined;
    const credentials: SftpHostConfig = password ? { ...hostConfig, authType: "password", password } : hostConfig;
    const promise = createSftpSession(credentials, current, () => {
      if (current.session === promise) delete current.session;
    }).finally(() => {
      if (password && tempPasswords.get(sshHostId) === password) tempPasswords.delete(sshHostId);
    });
    current.session = promise;
  }

  const pending = current.session;
  try {
    const session = await pending;
    current.controller.signal.throwIfAborted();
    return { ...session, connectionId: current.connectionId, signal: current.controller.signal };
  } catch (error) {
    if (current.session === pending) delete current.session;
    throw error;
  }
}

async function createSftpSession(
  hostConfig: SftpHostConfig,
  revision: SftpRevision,
  onDisconnected: () => void,
): Promise<SftpSession> {
  const signal = revision.controller.signal;
  const verifyHost = makeHostVerifier(hostConfig.host, hostConfig.port || 22);
  const connOpts: ConnectConfig = {
    host: hostConfig.host,
    port: hostConfig.port || 22,
    username: hostConfig.username,
    hostVerifier: (key: Buffer) => {
      if (signal.aborted) return false;
      const fingerprint = key.toString("base64");
      if (revision.verifiedHostKey && revision.verifiedHostKey !== fingerprint) return false;
      if (!verifyHost(key)) return false;
      revision.verifiedHostKey = fingerprint;
      return true;
    },
  };

  if (hostConfig.authType === "password") {
    if (!hostConfig.password)
      throw new Error("Password required but not provided in profile");
    connOpts.password = hostConfig.password;
  } else if (hostConfig.authType === "key") {
    if (!hostConfig.privateKeyPath)
      throw new Error("Private key path required");
    let keyPath = hostConfig.privateKeyPath;
    const homeDir = process.env.HOME || os.homedir();
    if (keyPath === "~" || keyPath.startsWith("~/") || keyPath.startsWith("~\\")) {
      keyPath = path.join(homeDir, keyPath.slice(1));
    }
    try {
      connOpts.privateKey = await fs.readFile(keyPath, "utf8");
      if (hostConfig.passphrase) {
        connOpts.passphrase = hostConfig.passphrase;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read private key: ${message}`);
    }
  } else if (hostConfig.authType === "agent") {
    if (process.env.SSH_AUTH_SOCK) connOpts.agent = process.env.SSH_AUTH_SOCK;
  } else if (hostConfig.authType === "auto") {
    if (process.env.SSH_AUTH_SOCK) {
      connOpts.agent = process.env.SSH_AUTH_SOCK;
    }
    const home = process.env.HOME || os.homedir();
    const defaultKeys = ["id_rsa", "id_ed25519", "id_ecdsa", "id_dsa"];
    for (const keyName of defaultKeys) {
      try {
        const keyPath = path.join(home, ".ssh", keyName);
        connOpts.privateKey = await fs.readFile(keyPath, "utf8");
        break;
      } catch {
        /* intentional ignore */
      }
    }
  }

  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const client = new Client();
    let closed = false;

    const abort = () => {
      closed = true;
      reject(signal.reason);
      try {
        client.end();
      } catch {
        /* The connection may already be closed. */
      }
    };
    const disconnect = (error: Error) => {
      closed = true;
      signal.removeEventListener("abort", abort);
      onDisconnected();
      reject(error);
    };

    signal.addEventListener("abort", abort, { once: true });
    client.on("ready", () => {
      if (closed) return;
      client.sftp((err, sftp) => {
        if (closed) return;
        if (err) {
          disconnect(err);
          client.end();
          return;
        }

        const onRealpath = (error: Error | undefined, absPath?: string) => {
          if (closed) return;
          const homeDir = !error && absPath ? absPath.trim() || "/" : "/";
          resolve({ sftp, homeDir });
        };

        if (typeof sftp.realpath === "function") sftp.realpath(".", onRealpath);
        else onRealpath(undefined, "/");
      });
    });
    client.on("error", disconnect);
    client.on("end", () => disconnect(new Error("SSH connection ended")));
    client.on("close", () => disconnect(new Error("SSH connection closed")));

    try {
      client.connect(connOpts);
    } catch (error) {
      disconnect(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function remotePath(filePath: string, homeDir: string): string {
  if (filePath === "~") return homeDir;
  return filePath.startsWith("~/") ? homeDir.replace(/\/$/, "") + filePath.slice(1) : filePath;
}

export function initSftpManager() {
  unsubscribeConfig = onConfigChanged(invalidateChangedSessions);
  ipcMain.handle(
    "sftp:set-temp-password",
    (event, sshHostId: string, password: string) => {
      if (!isTrustedSender(event)) return;
      tempPasswords.set(sshHostId, password);
      // Clear after 60 seconds to prevent credentials from lingering in memory indefinitely
      setTimeout(() => {
        if (tempPasswords.get(sshHostId) === password) {
          tempPasswords.delete(sshHostId);
        }
      }, 60000).unref();
    },
  );

  ipcMain.handle(
    "sftp:list-dir",
    async (event, sshHostId: string, dirPath: string, connectionId?: string) => {
      if (!isTrustedSender(event)) return [];
      try {
        const session = await getSftpSession(sshHostId, connectionId);
        return await new Promise((resolve, reject) => {
          const targetPath = remotePath(dirPath, session.homeDir);
          session.sftp.readdir(targetPath, (err, list) => {
            if (err) {
              if (err.message === "No such file") return resolve([]);
              return reject(err);
            }

            const items = list.map((f) => ({
              name: f.filename,
              isDirectory: f.attrs.isDirectory(),
              size: f.attrs.size,
              ext: path.extname(f.filename).toLowerCase(),
            }));

            resolve(sortDirectoryItems(items));
          });
        });
      } catch (err: unknown) {
        return { __ipcError: true, message: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ipcMain.handle(
    "sftp:read-file-head",
    async (event, sshHostId: string, filePath: string) => {
      if (!isTrustedSender(event)) return { __ipcError: true, message: "Access denied" };
      try {
        const session = await getSftpSession(sshHostId);
        return await new Promise((resolve, reject) => {
          const targetPath = remotePath(filePath, session.homeDir);

          session.sftp.open(targetPath, "r", (err, handle) => {
            if (err) return reject(err);

            const buffer = Buffer.alloc(50 * 1024);
            session.sftp.read(
              handle,
              buffer,
              0,
              buffer.length,
              0,
              (err, bytesRead) => {
                session.sftp.close(handle, () => {});
                if (err) return reject(err);
                resolve(buffer.toString("utf8", 0, bytesRead));
              },
            );
          });
        });
      } catch (err: unknown) {
        return { __ipcError: true, message: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ipcMain.handle(
    "sftp:read-file",
    async (event, sshHostId: string, filePath: string, connectionId?: string) => {
      if (!isTrustedSender(event)) return { __ipcError: true, message: "Access denied" };
      try {
        const session = await getSftpSession(sshHostId, connectionId);
        return await new Promise((resolve, reject) => {
          const targetPath = remotePath(filePath, session.homeDir);

          session.sftp.stat(targetPath, (err, stats) => {
            if (err) return reject(err);
            if (stats.size > 10 * 1024 * 1024) {
              return resolve({
                __ipcError: true,
                message: "File exceeds maximum editable size (10 MB)",
              });
            }

            session.sftp.readFile(targetPath, "utf8", (err, content) => {
              if (err) return reject(err);
              if (session.signal.aborted) return reject(session.signal.reason);
              resolve({
                content: typeof content === "string" ? content : content.toString("utf8"),
                connectionId: session.connectionId,
              });
            });
          });
        });
      } catch (err: unknown) {
        return { __ipcError: true, message: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ipcMain.handle(
    "sftp:write-file",
    async (event, sshHostId: string, filePath: string, content: string, connectionId?: string) => {
      if (!isTrustedSender(event)) return { __ipcError: true, message: "Access denied" };
      if (typeof content !== "string" || content.length > 10 * 1024 * 1024) {
        return { __ipcError: true, message: "Invalid content or exceeds 10 MB limit" };
      }
      try {
        if (typeof connectionId !== "string") throw connectionChanged();
        const session = await getSftpSession(sshHostId, connectionId);
        return await new Promise((resolve, reject) => {
          const targetPath = remotePath(filePath, session.homeDir);

          session.sftp.writeFile(targetPath, content, "utf8", (err) => {
            if (err) return reject(err);
            resolve(true);
          });
        });
      } catch (err: unknown) {
        return { __ipcError: true, message: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ipcMain.handle("sftp:file-exists", async (event, sshHostId: string, filePath: string) => {
    if (!isTrustedSender(event)) throw new Error("Access denied");
    const session = await getSftpSession(sshHostId);
    return new Promise<boolean>((resolve, reject) => {
      session.sftp.lstat(remotePath(filePath, session.homeDir), (error) => {
        if (!error) resolve(true);
        else if ("code" in error && error.code === 2) resolve(false); // SSH_FX_NO_SUCH_FILE
        else reject(error);
      });
    });
  });

  ipcMain.handle("sftp:get-home", async (event, sshHostId: string, connectionId?: string) => {
    if (!isTrustedSender(event)) return { __ipcError: true, message: "Access denied" };
    try {
      const session = await getSftpSession(sshHostId, connectionId);
      return session.homeDir;
    } catch (err: unknown) {
      return { __ipcError: true, message: err instanceof Error ? err.message : String(err) };
    }
  });
}

export function cleanupSftpSessions() {
  unsubscribeConfig?.();
  unsubscribeConfig = undefined;
  for (const [id, revision] of revisions) invalidateRevision(id, revision);
  tempPasswords.clear();
}
