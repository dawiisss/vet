const { DatabaseSync } = require('node:sqlite');

function runBenchmark(useInClause, iterations) {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE sessions (id TEXT PRIMARY KEY, created_at INTEGER);
    CREATE TABLE session_search (session_id TEXT);
  `);

  // Insert some data
  const insertSession = db.prepare('INSERT INTO sessions (id, created_at) VALUES (?, ?)');
  const insertSearch = db.prepare('INSERT INTO session_search (session_id) VALUES (?)');

  for (let i = 0; i < iterations * 10; i++) {
    insertSession.run(`id-${i}`, i);
    insertSearch.run(`id-${i}`);
  }

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const oldestStmt = db.prepare('SELECT id FROM sessions ORDER BY created_at ASC LIMIT 10');
    const oldest = oldestStmt.all();

    if (useInClause) {
      if (oldest.length > 0) {
        const placeholders = oldest.map(() => '?').join(',');
        const deleteStmt = db.prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`);
        const deleteSearchStmt = db.prepare(`DELETE FROM session_search WHERE session_id IN (${placeholders})`);

        const ids = oldest.map(r => r.id);
        deleteStmt.run(...ids);
        deleteSearchStmt.run(...ids);
      }
    } else {
      const deleteStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
      const deleteSearchStmt = db.prepare('DELETE FROM session_search WHERE session_id = ?');
      for (const row of oldest) {
        deleteStmt.run(row.id);
        deleteSearchStmt.run(row.id);
      }
    }
  }

  const end = performance.now();
  return end - start;
}

const N = 1000;
console.log('Warming up...');
runBenchmark(false, 100);
runBenchmark(true, 100);

console.log('Running benchmark for N=', N);
const timeOld = runBenchmark(false, N);
const timeNew = runBenchmark(true, N);

console.log(`Baseline (N+1 queries): ${timeOld.toFixed(2)} ms`);
console.log(`Optimized (IN clause): ${timeNew.toFixed(2)} ms`);
console.log(`Improvement: ${((timeOld - timeNew) / timeOld * 100).toFixed(2)}%`);
