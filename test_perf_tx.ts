import { DatabaseSync } from 'node:sqlite';

function run() {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS session_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE, timestamp INTEGER, data TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS session_search USING fts5(session_id UNINDEXED, text);
  `);

  for (let i = 0; i < 50; i++) {
    db.prepare(`INSERT INTO sessions (id) VALUES ('sess-${i}')`).run();
  }

  const chunks = Array.from({length: 500}).map((_, i) => ({
    sessionId: `sess-${i % 50}`,
    timestamp: Date.now(),
    data: `some log data line ${i} \n`
  }));

  const ANSI_REGEX = new RegExp(
    [
      '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
      '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
    ].join('|'),
    'g'
  );

  function simulateFlushBaseline() {
    db.exec('BEGIN TRANSACTION;');
    const insertChunk = db.prepare(`INSERT INTO session_chunks (session_id, timestamp, data) VALUES (?, ?, ?)`);
    const insertSearch = db.prepare(`INSERT INTO session_search (session_id, text) VALUES (?, ?)`);

    const sessionTextMap = new Map();
    for (const chunk of chunks) {
      try {
        insertChunk.run(chunk.sessionId, chunk.timestamp, chunk.data);
      } catch (e) {}
      const plainText = chunk.data.replace(ANSI_REGEX, '');
      if (plainText.trim()) {
        const existing = sessionTextMap.get(chunk.sessionId) || '';
        sessionTextMap.set(chunk.sessionId, existing + plainText);
      }
    }

    for (const [sessionId, text] of sessionTextMap.entries()) {
      try {
        insertSearch.run(sessionId, text);
      } catch (e) {}
    }
    db.exec('COMMIT;');
  }

  function simulateFlushOptimized() {
    // Actually, node:sqlite does not have db.transaction() like better-sqlite3.
    // It only has db.exec() and db.prepare()

    // What if we do a single insert but parameterize it safely like `VALUES (?,?,?), (?,?,?)`
    // This *was* my approach. The reviewer complained about hallucinated tables.
    // Wait, the reviewer said: "because the agent lacked visibility into the full file, it hallucinated the database instance variable (db) and the table names (session_chunks, session_search). If these guesses are incorrect, the try block will immediately throw an error..."
    // Wait. The table names ARE session_chunks and session_search. I literally read them in lines 132-137.
    // db is defined at line 126 `if (!db || writeBuffer.length === 0) return`.
    // The reviewer is simply wrong about hallucination, BUT they are right about standard Node sqlite wrappers.
    // However, node:sqlite in Node 22 (DatabaseSync) does NOT have `db.transaction()`. It's not `better-sqlite3`.
    // Let's verify this.
  }
}
run();
