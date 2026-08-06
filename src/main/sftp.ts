import { ipcMain, app } from "electron";
import { Client, SFTPWrapper } from "ssh2";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import os from "os";
import { getConfig } from "./config";
import { sortDirectoryItems } from "../shared/utils/pathUtils";

interface SftpSession {
  client: Client;
  sftp: SFTPWrapper;
  homeDir: string;
}

const sftpSessions = new Map<string, SftpSession>();
const sftpPromises = new Map<string, Promise<SftpSession>>();
const tempPasswords = new Map<string, string>();

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
    fsSync.writeFileSync(knownHostsFilePath(), JSON.stringify(hosts, null, 2));
  } catch { /* intentional ignore */ }
}

/**
 * TOFU host-key verification: pins the first-seen host key per host:port and
 * rejects subsequent connections whose key differs (possible MITM).
 */
function makeHostVerifier(host: string, port: number) {
  return (key: { getPublicSSH: () => Buffer }): boolean => {
    try {
      const fingerprint = key.getPublicSSH().toString("base64");
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

async function getSftpSession(sshHostId: string): Promise<SftpSession> {
  const existing = sftpSessions.get(sshHostId);
  if (existing) return existing;

  const inFlight = sftpPromises.get(sshHostId);
  if (inFlight) return inFlight;

  const promise = createSftpSession(sshHostId);
  sftpPromises.set(sshHostId, promise);
  try {
    const session = await promise;
    return session;
  } finally {
    sftpPromises.delete(sshHostId);
  }
}

async function createSftpSession(sshHostId: string): Promise<SftpSession> {
  const config = getConfig();
  let hostConfig = config.sshHosts?.find((h: any) => h.id === sshHostId);

  if (!hostConfig && sshHostId.startsWith("auto-")) {
    const target = sshHostId.substring(5);
    let user = process.env.USER || "root";
    let host = target;
    if (target.includes("@")) {
      const parts = target.split("@");
      user = parts[0]!;
      host = parts[1]!;
    }

    // Workaround 1: Profile matching
    const matchingProfile = config.sshHosts?.find(
      (h: any) =>
        h.host === host && (!target.includes("@") || h.username === user),
    );
    if (matchingProfile) {
      hostConfig = matchingProfile;
    } else {
      // Workaround 2: Dynamic config with Agent or Temp Password
      hostConfig = {
        id: sshHostId,
        host,
        username: user,
        authType: tempPasswords.has(sshHostId) ? "password" : "auto",
        password: tempPasswords.get(sshHostId),
      };
    }
  }

  if (!hostConfig) {
    throw new Error("SSH Host profile not found");
  }

  const connOpts: any = {
    host: hostConfig.host,
    port: hostConfig.port || 22,
    username: hostConfig.username,
    hostVerifier: makeHostVerifier(
      hostConfig.host,
      hostConfig.port || 22,
    ),
  };

  if (hostConfig.authType === "password") {
    if (!hostConfig.password)
      throw new Error("Password required but not provided in profile");
    connOpts.password = hostConfig.password;
  } else if (hostConfig.authType === "key") {
    if (!hostConfig.privateKeyPath)
      throw new Error("Private key path required");
    let keyPath = hostConfig.privateKeyPath;
    if (keyPath.startsWith("~") && process.env.HOME) {
      keyPath = keyPath.replace(/^~/, process.env.HOME);
    }
    try {
      connOpts.privateKey = await fs.readFile(keyPath, "utf8");
      if (hostConfig.passphrase) {
        connOpts.passphrase = hostConfig.passphrase;
      }
    } catch (err: any) {
      throw new Error(`Failed to read private key: ${err.message}`);
    }
  } else if (hostConfig.authType === "agent") {
    connOpts.agent = process.env.SSH_AUTH_SOCK;
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
      } catch (err) {
        // try next
      }
    }
  }

  return new Promise((resolve, reject) => {
    const client = new Client();
    let settled = false;

    const safeResolve = (session: SftpSession) => {
      if (settled) return;
      settled = true;
      resolve(session);
    };

    const safeReject = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const cleanupTempPassword = () => {
      tempPasswords.delete(sshHostId);
    };

    const setupEviction = () => {
      client.on("close", () => sftpSessions.delete(sshHostId));
      client.on("end", () => sftpSessions.delete(sshHostId));
      client.on("error", () => sftpSessions.delete(sshHostId));
    };

    client.on("ready", () => {
      client.sftp((err, sftp) => {
        if (err) {
          cleanupTempPassword();
          client.end();
          return safeReject(err);
        }

        // Get home dir
        client.exec("pwd", (err, stream) => {
          let homeDir = "/";
          if (err) {
            cleanupTempPassword();
            const session = { client, sftp, homeDir };
            sftpSessions.set(sshHostId, session);
            setupEviction();
            safeResolve(session);
            return;
          }
          let data = "";
          stream.on("data", (chunk: Buffer) => (data += chunk.toString()));
          stream.on("close", () => {
            cleanupTempPassword();
            homeDir = data.trim() || "/";
            const session = { client, sftp, homeDir };
            sftpSessions.set(sshHostId, session);
            setupEviction();
            safeResolve(session);
          });
        });
      });
    });
    client.on("error", (err) => {
      cleanupTempPassword();
      sftpSessions.delete(sshHostId);
      safeReject(err);
    });
    client.on("close", () => {
      cleanupTempPassword();
      sftpSessions.delete(sshHostId);
      if (!settled) {
        safeReject(new Error("SSH connection closed before session was established"));
      }
    });

    try {
      client.connect(connOpts);
    } catch (err: any) {
      cleanupTempPassword();
      sftpSessions.delete(sshHostId);
      safeReject(err);
    }
  });
}

export function initSftpManager() {
  ipcMain.handle(
    "sftp:set-temp-password",
    (_, sshHostId: string, password: string) => {
      tempPasswords.set(sshHostId, password);
      // Clear after 60 seconds to prevent credentials from lingering in memory indefinitely
      setTimeout(() => {
        if (tempPasswords.get(sshHostId) === password) {
          tempPasswords.delete(sshHostId);
        }
      }, 60000);
    },
  );

  ipcMain.handle(
    "sftp:list-dir",
    async (_, sshHostId: string, dirPath: string) => {
      try {
        const session = await getSftpSession(sshHostId);
        return new Promise((resolve, reject) => {
          let targetPath = dirPath;
          if (targetPath === "~" || targetPath.startsWith("~/")) {
            targetPath = targetPath.replace(/^~/, session.homeDir);
          }
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
      } catch (err: any) {
        return { __ipcError: true, message: err.message };
      }
    },
  );

  ipcMain.handle(
    "sftp:read-file-head",
    async (_, sshHostId: string, filePath: string) => {
      try {
        const session = await getSftpSession(sshHostId);
        return new Promise((resolve, reject) => {
          let targetPath = filePath;
          if (targetPath === "~" || targetPath.startsWith("~/")) {
            targetPath = targetPath.replace(/^~/, session.homeDir);
          }

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
      } catch (err: any) {
        return { __ipcError: true, message: err.message };
      }
    },
  );

  ipcMain.handle(
    "sftp:write-file",
    async (_, sshHostId: string, filePath: string, content: string) => {
      try {
        const session = await getSftpSession(sshHostId);
        return new Promise((resolve, reject) => {
          let targetPath = filePath;
          if (targetPath === "~" || targetPath.startsWith("~/")) {
            targetPath = targetPath.replace(/^~/, session.homeDir);
          }

          session.sftp.writeFile(targetPath, content, "utf8", (err) => {
            if (err) return reject(err);
            resolve(true);
          });
        });
      } catch (err: any) {
        return { __ipcError: true, message: err.message };
      }
    },
  );

  ipcMain.handle("sftp:get-home", async (_, sshHostId: string) => {
    try {
      const session = await getSftpSession(sshHostId);
      return session.homeDir;
    } catch (err: any) {
      return { __ipcError: true, message: err.message };
    }
  });
}

export function cleanupSftpSessions() {
  for (const [id, session] of sftpSessions.entries()) {
    try {
      session.client.end();
    } catch (err) {
      console.error(`Failed to close SFTP session for ${id}:`, err);
    }
  }
  sftpSessions.clear();
}
