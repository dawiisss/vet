import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import type { Database as DatabaseType, Statement } from "better-sqlite3";
import { getConfig } from "./config";

const DB_DIR = path.join(app.getPath("home"), ".config", "vet");
const DB_FILE = path.join(DB_DIR, "vet_history.db");

let db: DatabaseType | null = null;
let dbInitError: string | null = null;
let dbReady = false;

let insertChunkStmt: Statement | null = null;
let insertSearchStmt: Statement | null = null;
let updateSessionCloseStmt: Statement | null = null;
let insertSessionStmt: Statement | null = null;

export function getDbInitError(): string | null {
  return dbInitError;
}

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
  if (dbReady || db) return;

  const Database = require("better-sqlite3") as typeof import("better-sqlite3");

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  try {
    db = new Database(DB_FILE);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("foreign_keys = ON");
    db.pragma("auto_vacuum = INCREMENTAL");

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

    insertChunkStmt = db.prepare(
      "INSERT INTO session_chunks (session_id, timestamp, data) VALUES (?, ?, ?)",
    );
    insertSearchStmt = db.prepare(
      "INSERT INTO session_search (session_id, text) VALUES (?, ?)",
    );
    insertSessionStmt = db.prepare(
      "INSERT INTO sessions (id, title, created_at, connection_type, connection_target) VALUES (?, ?, ?, ?, ?)",
    );
    updateSessionCloseStmt = db.prepare(
      "UPDATE sessions SET closed_at = ? WHERE id = ?",
    );

    flushInterval = setInterval(flushBuffer, 500);

    setTimeout(pruneHistory, 2000);

    dbReady = true;
    dbInitError = null;
  } catch (err: any) {
    console.error("Failed to initialize history DB:", err);
    dbInitError = err instanceof Error ? err.message : String(err);
  }
}

export function startSession(
  id: string,
  title: string,
  connectionType: string,
  connectionTarget: string,
) {
  if (!db || !insertSessionStmt) return;
  const config = getConfig();
  if (config.historyLoggingEnabled === false) return;

  try {
    insertSessionStmt.run(id, title, Date.now(), connectionType, connectionTarget);
  } catch (err) {
    console.error("DB Insert Error:", err);
  }
}

export function closeSession(id: string) {
  if (!db || !updateSessionCloseStmt) return;
  flushBuffer();

  try {
    updateSessionCloseStmt.run(Date.now(), id);
    setTimeout(pruneHistory, 500);
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

  if (writeBuffer.length > 500) {
    flushBuffer();
  }
}

function flushBuffer() {
  if (!db || !insertChunkStmt || !insertSearchStmt || writeBuffer.length === 0) return;

  const chunks = [...writeBuffer];
  writeBuffer = [];

  const trx = db.transaction(() => {
    const sessionTextMap = new Map<string, string>();

    for (const chunk of chunks) {
      try {
        insertChunkStmt!.run(chunk.sessionId, chunk.timestamp, chunk.data);

        const plainText = chunk.data.replace(ANSI_REGEX, "");
        if (plainText.trim()) {
          const existing = sessionTextMap.get(chunk.sessionId) || "";
          sessionTextMap.set(chunk.sessionId, existing + plainText);
        }
      } catch (err: any) {
        if (err?.code !== "SQLITE_CONSTRAINT ForeignKey") {
          console.warn("Failed to insert chunk:", err);
        }
      }
    }

    for (const [sessionId, text] of sessionTextMap.entries()) {
      try {
        insertSearchStmt!.run(sessionId, text);
      } catch {
        // Ignore orphaned FTS entries
      }
    }
  });

  try {
    trx();
  } catch (err) {
    console.error("DB Flush Error:", err);
  }
}

export function searchHistory(query: string): any[] {
  if (!db) return [];
  try {
    // Sanitize for FTS5: escape double quotes and wrap each term in quotes
    // to prevent special characters from being interpreted as FTS5 operators
    const sanitized = query
      .replace(/"/g, '""')
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"`)
      .join(" ");
    if (!sanitized) return [];

    const stmt = db.prepare(`
      SELECT 
        s.id, s.title, s.created_at, s.closed_at, s.connection_type, s.connection_target,
        snippet(session_search, 1, '<b>', '</b>', '...', 20) AS snippet
      FROM session_search ss
      JOIN sessions s ON ss.session_id = s.id
      WHERE session_search MATCH ?
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT 100
    `);
    const rows = stmt.all(sanitized) as any[];

    const uniqueSessions: any[] = [];
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
  } catch {
    return null;
  }
}

export function getSessionTranscript(id: string): string {
  if (!db) return "";
  flushBuffer();
  try {
    const stmt = db.prepare(
      "SELECT data FROM session_chunks WHERE session_id = ? ORDER BY timestamp ASC, id ASC",
    );
    const rows = stmt.all(id) as { data: string }[];
    return rows.map((r) => r.data).join("");
  } catch {
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
    const stmt = db.prepare(`
      SELECT timestamp, data FROM session_chunks 
      WHERE session_id = ? AND timestamp < ? 
      ORDER BY timestamp DESC, id DESC LIMIT 50
    `);
    const rows = stmt.all(id, beforeTimestamp) as {
      data: string;
      timestamp: number;
    }[];
    return rows.reverse();
  } catch {
    return [];
  }
}

export function clearHistory() {
  if (!db) return;
  writeBuffer = [];
  try {
    db.exec("DELETE FROM session_search");
    db.exec("DELETE FROM sessions");
    db.pragma("incremental_vacuum");
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

function getLogicalDatabaseSizeMb(): number {
  if (!db) return 0;
  try {
    const pageCount = db.pragma("page_count", { simple: true }) as number;
    const freelistCount = db.pragma("freelist_count", { simple: true }) as number;
    const pageSize = db.pragma("page_size", { simple: true }) as number;

    const logicalSize = (pageCount - freelistCount) * pageSize;
    return logicalSize / (1024 * 1024);
  } catch (err) {
    console.error("Failed to get logical DB size:", err);
    return getDatabaseSizeMb();
  }
}

function pruneHistory() {
  if (!db || !dbReady) return;
  const config = getConfig();
  const limitMb = config.historyDatabaseLimitMb || 100;
  const keepDays = config.historyKeepDays || 30;

  try {
    const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;

    const pruneDaysStmt = db.prepare(
      "DELETE FROM sessions WHERE created_at < ?",
    );
    pruneDaysStmt.run(cutoffTime);

    const pruneBrowserStmt = db.prepare(
      "DELETE FROM browser_history WHERE timestamp < ?",
    );
    pruneBrowserStmt.run(cutoffTime);

    let sizeMb = getLogicalDatabaseSizeMb();
    if (sizeMb > limitMb) {
      let deletedCount = 0;
      while (sizeMb > limitMb) {
        const oldestStmt = db.prepare(
          "SELECT id FROM sessions ORDER BY created_at ASC, id ASC LIMIT 100",
        );
        const oldest = oldestStmt.all() as { id: string }[];
        if (oldest.length === 0) break;

        const ids = oldest.map((row) => row.id);
        const placeholders = ids.map(() => "?").join(",");
        const deleteStmt = db.prepare(
          `DELETE FROM sessions WHERE id IN (${placeholders})`,
        );
        const deleteSearchStmt = db.prepare(
          `DELETE FROM session_search WHERE session_id IN (${placeholders})`,
        );

        const trx = db.transaction(() => {
          deleteStmt.run(...ids);
          deleteSearchStmt.run(...ids);
        });
        trx();

        deletedCount += oldest.length;
        sizeMb = getLogicalDatabaseSizeMb();

        if (deletedCount > 1000) {
          console.warn("Pruning stopped: reached safety limit of 1000 deleted sessions");
          break;
        }
      }
    }
    db.pragma("incremental_vacuum");
  } catch (err) {
    console.error("Prune Error:", err);
  }
}

export function getHistorySessions(): any[] {
  if (!db) return [];
  try {
    const stmt = db.prepare(
      "SELECT * FROM sessions ORDER BY created_at DESC, id DESC LIMIT 100",
    );
    return stmt.all();
  } catch {
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
      WHERE url LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\' 
      ORDER BY timestamp DESC, id DESC LIMIT 100
    `);
    const escaped = query.replace(/[%_]/g, "\\$&");
    const searchPattern = `%${escaped}%`;
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
    db.pragma("incremental_vacuum");
  } catch (err) {
    console.error("Clear Browser History Error:", err);
  }
}

export function cleanupHistoryDb() {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
  if (db) {
    flushBuffer();
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
      db.close();
    } catch (err) {
      console.error("Error closing database:", err);
    }
    db = null;
    insertChunkStmt = null;
    insertSearchStmt = null;
    insertSessionStmt = null;
    updateSessionCloseStmt = null;
    dbReady = false;
  }
}