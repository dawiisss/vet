import { ipcMain } from "electron";
import { Client, SFTPWrapper } from "ssh2";
import * as fs from "fs/promises";
import * as path from "path";
import os from "os";
import { getConfig } from "./config";

interface SftpSession {
  client: Client;
  sftp: SFTPWrapper;
  homeDir: string;
}

const sftpSessions = new Map<string, SftpSession>();
const tempPasswords = new Map<string, string>();

async function getSftpSession(sshHostId: string): Promise<SftpSession> {
  const existing = sftpSessions.get(sshHostId);
  if (existing) return existing;

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

    const cleanupTempPassword = () => {
      tempPasswords.delete(sshHostId);
    };

    client.on("ready", () => {
      client.sftp((err, sftp) => {
        if (err) {
          cleanupTempPassword();
          client.end();
          return reject(err);
        }

        // Get home dir
        client.exec("pwd", (err, stream) => {
          let homeDir = "/";
          if (err) {
            cleanupTempPassword();
            const session = { client, sftp, homeDir };
            sftpSessions.set(sshHostId, session);
            resolve(session);
            return;
          }
          let data = "";
          stream.on("data", (chunk: Buffer) => (data += chunk.toString()));
          stream.on("close", () => {
            cleanupTempPassword();
            homeDir = data.trim() || "/";
            const session = { client, sftp, homeDir };
            sftpSessions.set(sshHostId, session);
            resolve(session);
          });
        });
      });
    });
    client.on("error", (err) => {
      cleanupTempPassword();
      reject(err);
    });
    client.on("close", () => {
      cleanupTempPassword();
      sftpSessions.delete(sshHostId);
    });

    try {
      client.connect(connOpts);
    } catch (err) {
      cleanupTempPassword();
      reject(err);
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

            items.sort((a, b) => {
              if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            });

            resolve(items);
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

  ipcMain.handle("sftp:get-home", async (_, sshHostId: string) => {
    try {
      const session = await getSftpSession(sshHostId);
      return session.homeDir;
    } catch (err: any) {
      return { __ipcError: true, message: err.message };
    }
  });
}
