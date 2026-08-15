import { ipcMain } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import os from "os";
import { getConfig } from "./config";
import { isValidShell } from "./pty";
import { isTrustedSender } from "./ipc/ipcUtils";

const execFileAsync = promisify(execFile);

export interface ConnectionInfo {
  id?: string;
  name: string;
  command: string;
  source: "docker" | "ssh_global" | "ssh_app";
}

export function initConnectionsManager() {
  ipcMain.handle(
    "connections:get-ssh-hosts",
    async (event): Promise<ConnectionInfo[]> => {
      if (!isTrustedSender(event)) return [];
      const config = getConfig();
      const hosts: ConnectionInfo[] = []; 

      if (config.sshParseGlobal) {
        try {
          const sshConfigPath = path.join(os.homedir(), ".ssh", "config");
          const content = await fs.readFile(sshConfigPath, "utf-8");
          const lines = content.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (
              trimmed.toLowerCase().startsWith("host ") &&
              !trimmed.toLowerCase().startsWith("host *")
            ) {
              const hostNames = trimmed.substring(5).trim().split(/\s+/);
              for (const name of hostNames) {
                hosts.push({
                  name,
                  command: `ssh ${name}`,
                  source: "ssh_global",
                });
              }
            }
          }
        } catch { /* intentional ignore */ }
      }

      if (config.sshHosts && Array.isArray(config.sshHosts)) {
        for (const h of config.sshHosts) {
          if (h.name && h.host && h.username) {
            const command = `ssh ${h.port ? `-p ${h.port} ` : ""}${h.username}@${h.host}`;
            hosts.push({ id: h.id, name: h.name, command, source: "ssh_app" });
          }
        }
      }

      // Deduplicate by name just in case
      const seen = new Set<string>();
      return hosts.filter((h) => {
        if (seen.has(h.name)) return false;
        seen.add(h.name);
        return true;
      });
    },
  );

  ipcMain.handle(
    "connections:get-docker",
    async (event): Promise<ConnectionInfo[]> => {
      if (!isTrustedSender(event)) return [];
      try {
        const { stdout } = await execFileAsync("docker", [
          "ps",
          "--format",
          "{{.Names}}",
        ]);
        const lines = stdout
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        const config = getConfig();
        const dockerShell = config.dockerDefaultShell ?? "/bin/bash";
        const shell = isValidShell(dockerShell) ? dockerShell : "/bin/bash";

        return lines.map((name) => ({
          name,
          command: `docker exec -it ${name} ${shell}`,
          source: "docker",
        }));
      } catch {
        // Ignore if docker is not installed or not running
        return [];
      }
    },
  );

  ipcMain.handle(
    "connections:get-docker-detailed",
    async (event): Promise<Array<{
      id: string;
      name: string;
      image: string;
      state: "running" | "exited" | "paused" | "created" | "restarting" | "dead" | "unknown";
      status: string;
      ports: string;
      created: string;
    }>> => {
      if (!isTrustedSender(event)) return [];
      try {
        const { stdout } = await execFileAsync("docker", [
          "ps",
          "-a",
          "--format",
          "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.State}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}",
        ]);
        const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
        return lines.map((line) => {
          const [id, name, image, state, status, ports, created] = line.split("\t");
          const normalizedState = (state?.toLowerCase() || "unknown") as DockerContainerDetailed["state"];
          return {
            id: id || "",
            name: name || "",
            image: image || "",
            state: normalizedState,
            status: status || "",
            ports: ports || "",
            created: created || "",
          };
        });
      } catch {
        return [];
      }
    },
  );

  ipcMain.handle(
    "connections:docker-action",
    async (
      event,
      target: string,
      action: "start" | "stop" | "restart" | "rm",
    ): Promise<{ success: boolean; error?: string }> => {
      if (!isTrustedSender(event)) return { success: false, error: "Access denied" };
      if (typeof target !== "string" || !["start", "stop", "restart", "rm"].includes(action)) {
        return { success: false, error: "Invalid parameters" };
      }
      try {
        await execFileAsync("docker", [action, target]);
        return { success: true };
      } catch (err: unknown) {
        const e = err as { stderr?: string; message?: string };
        return { success: false, error: e.stderr || e.message || String(err) };
      }
    },
  );

  ipcMain.handle(
    "connections:docker-logs",
    async (event, target: string, tail: number = 100): Promise<string> => {
      if (!isTrustedSender(event)) return "";
      if (typeof target !== "string") return "";
      try {
        const { stdout, stderr } = await execFileAsync("docker", [
          "logs",
          "--tail",
          String(Math.min(1000, Math.max(10, tail))),
          target,
        ]);
        return stdout || stderr || "";
      } catch (err: unknown) {
        const e = err as { stderr?: string; message?: string };
        return e.stderr || e.message || "Failed to fetch logs";
      }
    },
  );

  ipcMain.handle(
    "connections:get-docker-images",
    async (event): Promise<Array<{
      id: string;
      repository: string;
      tag: string;
      size: string;
      created: string;
    }>> => {
      if (!isTrustedSender(event)) return [];
      try {
        const { stdout } = await execFileAsync("docker", [
          "images",
          "--format",
          "{{.ID}}\t{{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}",
        ]);
        const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
        return lines.map((line) => {
          const [id, repository, tag, size, created] = line.split("\t");
          return {
            id: id || "",
            repository: repository || "",
            tag: tag || "",
            size: size || "",
            created: created || "",
          };
        });
      } catch {
        return [];
      }
    },
  );
}
