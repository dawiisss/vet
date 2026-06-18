import { BrowserWindow, app } from "electron";
import { autoUpdater } from "electron-updater";
import { registerHandlers } from "./ipcUtils";

export function registerUpdaterHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  // Disable auto-download so users have control
  autoUpdater.autoDownload = false;

  // Enable dev update configuration and logging to debug issues in development
  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
    autoUpdater.logger = console;

    const fs = require("fs");
    const path = require("path");
    const devConfigPath = path.join(process.cwd(), "dev-app-update.yml");
    if (!fs.existsSync(devConfigPath)) {
      try {
        fs.writeFileSync(
          devConfigPath,
          "provider: github\nowner: dawiisss\nrepo: vet\n",
        );
      } catch (err) {
        console.error("Failed to create dev-app-update.yml:", err);
      }
    }
  }

  // Helper to safely send IPC messages to the main window
  const sendStatus = (status: string, extra?: unknown) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updater:status", status, extra);
    }
  };

  const sendProgress = (progressObj: unknown) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updater:progress", progressObj);
    }
  };

  // Register autoUpdater event handlers
  autoUpdater.on("checking-for-update", () => {
    sendStatus("checking");
  });

  autoUpdater.on("update-available", (info) => {
    sendStatus("available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes:
        typeof info.releaseNotes === "string" ? info.releaseNotes : "",
    });
  });

  autoUpdater.on("update-not-available", () => {
    sendStatus("uptodate");
  });

  autoUpdater.on("error", (err) => {
    sendStatus(
      "error",
      err.message || "An error occurred checking for updates",
    );
  });

  autoUpdater.on("download-progress", (progressObj) => {
    sendProgress({
      percent: progressObj.percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendStatus("downloaded", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes:
        typeof info.releaseNotes === "string" ? info.releaseNotes : "",
    });
  });

  let isSimulationActive = false;

  registerHandlers({
    "updater:simulate": () => {
      isSimulationActive = true;
      sendStatus("checking");

      setTimeout(() => {
        sendStatus("available", {
          version: "1.2.5-simulated",
          releaseDate: new Date().toISOString(),
          releaseNotes:
            "### Vet v1.2.5 (Simulated)\n\n* **Added simulation mode** for auto-updater checks\n* **High-fidelity animation** of progress bar\n* **Speed and transfer counters** fully working\n* Double check closing behavior on Escape",
        });
      }, 1500);
    },
    "updater:check": async () => {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, result };
    },
    "updater:download": async () => {
      if (isSimulationActive) {
        let percent = 0;
        const totalBytes = 1024 * 1024 * 18.5; // 18.5 MB
        const interval = setInterval(() => {
          percent += 4;
          if (percent >= 100) {
            percent = 100;
            clearInterval(interval);
            sendStatus("downloaded", {
              version: "1.2.5-simulated",
              releaseDate: new Date().toISOString(),
              releaseNotes:
                "### Vet v1.2.5 (Simulated)\n\n* **Added simulation mode** for auto-updater checks\n* **High-fidelity animation** of progress bar\n* **Speed and transfer counters** fully working\n* Double check closing behavior on Escape",
            });
          } else {
            sendProgress({
              percent,
              bytesPerSecond: 1024 * 1024 * 2.3, // 2.3 MB/s
              transferred: totalBytes * (percent / 100),
              total: totalBytes,
            });
          }
        }, 150);
        return { success: true };
      }

      await autoUpdater.downloadUpdate();
      return { success: true };
    },
    "updater:install": async () => {
      if (isSimulationActive) {
        console.log(
          "Simulated install called! Restarting app in simulation mode.",
        );
        isSimulationActive = false;
        sendStatus("idle");
        app.relaunch();
        app.exit(0);
        return { success: true };
      }

      autoUpdater.quitAndInstall();
      return { success: true };
    },
  });
}
