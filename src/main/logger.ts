import { app } from "electron";
import { join } from "path";
import { appendFile, stat, writeFile } from "fs/promises";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function logError(error: Error | string, context: string = "Global"): Promise<void> {
  try {
    const logPath = join(app.getPath("userData"), "vet-error.log");
    
    try {
      const stats = await stat(logPath);
      if (
        stats.size > MAX_LOG_SIZE_BYTES ||
        (stats.birthtimeMs !== 0 && Date.now() - stats.birthtimeMs > SEVEN_DAYS_MS)
      ) {
        await writeFile(logPath, "=== Vet Error Log ===\n\n", "utf-8");
      }
    } catch {
      /* intentional ignore */
    }

    const timestamp = new Date().toISOString();
    
    const errorMessage = typeof error === "string" ? error : (error.stack || error.message);
    
    const logEntry = `[${timestamp}] [${context}]\n${errorMessage}\n\n`;
    await appendFile(logPath, logEntry, "utf-8");
  } catch (err) {
    console.error("Failed to write to error log:", err);
  }
}
