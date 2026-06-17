import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { DatabaseSync } from "node:sqlite";
import { getConfig } from "./config";

const DB_DIR = path.join(app.getPath("home"), ".config", "vet");
const DB_FILE = path.join(DB_DIR, "vet_history.db");

let db: DatabaseSync | null = null;

interface OutputChunk {
  sessionId: string;
  timestamp: number;
  data: string;
}

let writeBuffer: OutputChunk[] = [];
let flushInterval: NodeJS.Timeout | null = null;

const ANSI_REGEX = new RegExp(
  [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
  ].join("|"),
  "g",
);

export function initHistoryDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  try {
    db = new DatabaseSync(DB_FILE);
    db.exec("PRAGMA foreign_keys = ON;");

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at INTEGER,
        closed_at INTEGER,
        connection_type TEXT,
        connection_target TEXT
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS session_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        timestamp INTEGER,
        data TEXT
      );
    `);

    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS session_search USING fts5(
        session_id UNINDEXED,
        text
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS browser_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT,
        timestamp INTEGER NOT NULL
      );
    `);

    // Start flush interval
    flushInterval = setInterval(flushBuffer, 500);

    // Run initial prune
    pruneHistory();
  } catch (err) {
    console.error("Failed to initialize history DB:", err);
  }
}

export function startSession(
  id: string,
  title: string,
  connectionType: string,
  connectionTarget: string,
) {
  if (!db) return;
  const config = getConfig();
  if (config.historyLoggingEnabled === false) return;

  try {
    const stmt = db.prepare(`
      INSERT INTO sessions (id, title, created_at, connection_type, connection_target)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, title, Date.now(), connectionType, connectionTarget);
  } catch (err) {
    console.error("DB Insert Error:", err);
  }
}

export function closeSession(id: string) {
  if (!db) return;
  flushBuffer(); // Flush any pending logs for this session first

  try {
    const stmt = db.prepare("UPDATE sessions SET closed_at = ? WHERE id = ?");
    stmt.run(Date.now(), id);
    pruneHistory();
  } catch (err) {
    console.error("DB Update Error:", err);
  }
}

export function logOutput(sessionId: string, data: string) {
  const config = getConfig();
  if (config.historyLoggingEnabled === false) return;

  writeBuffer.push({
    sessionId,
    timestamp: Date.now(),
    data,
  });

  // Flush immediately if buffer is getting large (e.g., fast output stream)
  if (writeBuffer.length > 500) {
    flushBuffer();
  }
}

function flushBuffer() {
  if (!db || writeBuffer.length === 0) return;

  const chunks = [...writeBuffer];
  writeBuffer = [];

  try {
    const insertChunk = db.prepare(`
      INSERT INTO session_chunks (session_id, timestamp, data) VALUES (?, ?, ?)
    `);
    const insertSearch = db.prepare(`
      INSERT INTO session_search (session_id, text) VALUES (?, ?)
    `);

    db.exec("BEGIN TRANSACTION;");

    const sessionTextMap = new Map<string, string>();

    for (const chunk of chunks) {
      try {
        insertChunk.run(chunk.sessionId, chunk.timestamp, chunk.data);

        const plainText = chunk.data.replace(ANSI_REGEX, "");
        if (plainText.trim()) {
          const existing = sessionTextMap.get(chunk.sessionId) || "";
          sessionTextMap.set(chunk.sessionId, existing + plainText);
        }
      } catch (err: any) {
        // If the session was deleted (e.g. user cleared history), silently ignore the orphaned logs.
        if (
          err?.code !== "ERR_SQLITE_ERROR" ||
          !err?.errstr?.includes("constraint failed")
        ) {
          console.warn("Failed to insert chunk:", err);
        }
      }
    }

    for (const [sessionId, text] of sessionTextMap.entries()) {
      try {
        insertSearch.run(sessionId, text);
      } catch (e) {
        // Ignore orphaned full-text search entries too
      }
    }

    db.exec("COMMIT;");
  } catch (err) {
    try {
      db?.exec("ROLLBACK;");
    } catch (e) {} // Attempt rollback if possible
    console.error("DB Flush Error:", err);
  }
}

export function searchHistory(query: string): any[] {
  if (!db) return [];
  try {
    const stmt = db.prepare(`
      SELECT 
        s.id, s.title, s.created_at, s.closed_at, s.connection_type, s.connection_target,
        snippet(session_search, 1, '<b>', '</b>', '...', 20) AS snippet
      FROM session_search ss
      JOIN sessions s ON ss.session_id = s.id
      WHERE session_search MATCH ?
      ORDER BY s.created_at DESC
      LIMIT 100
    `);
    const rows = stmt.all(query) as any[];

    // Filter out duplicate sessions in JS since FTS5 snippet() doesn't support GROUP BY
    const uniqueSessions = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        uniqueSessions.push(row);
      }
    }
    return uniqueSessions;
  } catch (err) {
    console.error("Search DB Error:", err);
    return [];
  }
}

export function getSessionDetails(id: string): any | null {
  if (!db) return null;
  try {
    const stmt = db.prepare("SELECT * FROM sessions WHERE id = ?");
    return stmt.get(id) || null;
  } catch (err) {
    return null;
  }
}

export function getSessionTranscript(id: string): string {
  if (!db) return "";
  flushBuffer();
  try {
    const stmt = db.prepare(
      "SELECT data FROM session_chunks WHERE session_id = ? ORDER BY timestamp ASC",
    );
    const rows = stmt.all(id) as { data: string }[];
    return rows.map((r) => r.data).join("");
  } catch (err) {
    return "";
  }
}

export function getScrollbackChunk(
  id: string,
  beforeTimestamp: number,
  limitLines: number = 1000,
): { data: string; timestamp: number }[] {
  if (!db) return [];
  flushBuffer();
  try {
    // This fetches chunks. A chunk might contain multiple lines.
    // For simplicity, we fetch the last N chunks before the timestamp.
    const stmt = db.prepare(`
      SELECT timestamp, data FROM session_chunks 
      WHERE session_id = ? AND timestamp < ? 
      ORDER BY timestamp DESC LIMIT 50
    `);
    // SQLite returns them in DESC order (newest to oldest), but terminal needs them chronological (oldest to newest)
    const rows = stmt.all(id, beforeTimestamp) as {
      data: string;
      timestamp: number;
    }[];
    return rows.reverse();
  } catch (err) {
    return [];
  }
}

export function clearHistory() {
  if (!db) return;
  writeBuffer = [];
  try {
    db.exec("DELETE FROM sessions"); // Cascade deletes chunks
    db.exec("DELETE FROM session_search");
    db.exec("VACUUM");
  } catch (err) {
    console.error("Clear DB Error:", err);
  }
}

export function deleteSession(id: string) {
  if (!db) return;
  try {
    const stmt = db.prepare("DELETE FROM sessions WHERE id = ?");
    stmt.run(id);
    const stmtSearch = db.prepare(
      "DELETE FROM session_search WHERE session_id = ?",
    );
    stmtSearch.run(id);
  } catch (err) {
    console.error("Delete Session Error:", err);
  }
}

function getDatabaseSizeMb(): number {
  try {
    const stats = fs.statSync(DB_FILE);
    return stats.size / (1024 * 1024);
  } catch {
    return 0;
  }
}

function pruneHistory() {
  if (!db) return;
  const config = getConfig();
  const limitMb = config.historyDatabaseLimitMb || 100;
  const keepDays = config.historyKeepDays || 30;

  try {
    // 1. Prune by days
    const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    const pruneDaysStmt = db.prepare(
      "DELETE FROM sessions WHERE created_at < ?",
    );
    pruneDaysStmt.run(cutoffTime);

    const pruneBrowserStmt = db.prepare(
      "DELETE FROM browser_history WHERE timestamp < ?",
    );
    pruneBrowserStmt.run(cutoffTime);

    // 2. Prune by size (FIFO)
    let sizeMb = getDatabaseSizeMb();
    if (sizeMb > limitMb) {
      while (sizeMb > limitMb) {
        // Delete oldest 10 sessions
        const oldestStmt = db.prepare(
          "SELECT id FROM sessions ORDER BY created_at ASC LIMIT 10",
        );
        const oldest = oldestStmt.all() as { id: string }[];
        if (oldest.length === 0) break;

        const placeholders = oldest.map(() => "?").join(",");
        const deleteStmt = db.prepare(
          `DELETE FROM sessions WHERE id IN (${placeholders})`,
        );
        const deleteSearchStmt = db.prepare(
          `DELETE FROM session_search WHERE session_id IN (${placeholders})`,
        );
        const ids = oldest.map((row) => row.id);
        deleteStmt.run(...ids);
        deleteSearchStmt.run(...ids);

        sizeMb = getDatabaseSizeMb();
      }
      db.exec("VACUUM");
    }
  } catch (err) {
    console.error("Prune Error:", err);
  }
}

export function getHistorySessions(): any[] {
  if (!db) return [];
  try {
    const stmt = db.prepare(
      "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 100",
    );
    return stmt.all();
  } catch (err) {
    return [];
  }
}

export function addBrowserVisit(url: string, title: string) {
  if (!db) return;
  const config = getConfig();
  if (config.historyLoggingEnabled === false) return;

  try {
    const lastStmt = db.prepare(
      "SELECT id, url, timestamp FROM browser_history ORDER BY timestamp DESC, id DESC LIMIT 1",
    );
    const lastVisit = lastStmt.get() as
      | { id: number; url: string; timestamp: number }
      | undefined;

    if (lastVisit && lastVisit.url === url) {
      const updateStmt = db.prepare(
        "UPDATE browser_history SET timestamp = ?, title = ? WHERE id = ?",
      );
      updateStmt.run(Date.now(), title || null, lastVisit.id);
    } else {
      const insertStmt = db.prepare(
        "INSERT INTO browser_history (url, title, timestamp) VALUES (?, ?, ?)",
      );
      insertStmt.run(url, title || null, Date.now());
    }
  } catch (err) {
    console.error("DB addBrowserVisit Error:", err);
  }
}

export function getBrowserHistory(): any[] {
  if (!db) return [];
  try {
    const stmt = db.prepare(
      "SELECT * FROM browser_history ORDER BY timestamp DESC, id DESC LIMIT 100",
    );
    return stmt.all();
  } catch (err) {
    console.error("Get Browser History Error:", err);
    return [];
  }
}

export function searchBrowserHistory(query: string): any[] {
  if (!db) return [];
  try {
    const stmt = db.prepare(`
      SELECT * FROM browser_history 
      WHERE url LIKE ? OR title LIKE ? 
      ORDER BY timestamp DESC, id DESC LIMIT 100
    `);
    const searchPattern = `%${query}%`;
    return stmt.all(searchPattern, searchPattern);
  } catch (err) {
    console.error("Search Browser History Error:", err);
    return [];
  }
}

export function deleteBrowserVisit(id: number) {
  if (!db) return;
  try {
    const stmt = db.prepare("DELETE FROM browser_history WHERE id = ?");
    stmt.run(id);
  } catch (err) {
    console.error("Delete Browser Visit Error:", err);
  }
}

export function clearBrowserHistory() {
  if (!db) return;
  try {
    db.exec("DELETE FROM browser_history");
    db.exec("VACUUM");
  } catch (err) {
    console.error("Clear Browser History Error:", err);
  }
}

export function cleanupHistoryDb() {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}
