import { parentPort, workerData } from "node:worker_threads";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface SearchRequest {
  rootPath: string;
  query: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  maxResults: number;
  filePattern?: string;
}

async function runSearch(request: SearchRequest) {
  const { rootPath, query, maxResults } = request;
  const pattern = request.wholeWord ? `\\b${query}\\b` : query;
  const regex = new RegExp(pattern, request.caseSensitive ? "g" : "gi");
  const ignored = new Set([
    ".git", "node_modules", "dist", "out", "build", ".next", ".cache",
    "coverage", ".gemini", ".agents",
  ]);
  const matches: Array<{
    filePath: string;
    relativePath: string;
    line: number;
    column: number;
    lineContent: string;
    matchLength: number;
  }> = [];

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 8 || matches.length >= maxResults) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (matches.length >= maxResults) break;
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootPath, fullPath);
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name) && !entry.name.startsWith(".")) {
          await walk(fullPath, depth + 1);
        }
        continue;
      }
      if (!entry.isFile()) continue;
      const filePattern = request.filePattern?.trim().toLowerCase();
      if (filePattern && !entry.name.toLowerCase().includes(filePattern) &&
          !relativePath.toLowerCase().includes(filePattern)) continue;
      try {
        const stat = await fs.stat(fullPath);
        if (stat.size > 2 * 1024 * 1024) continue;
        const handle = await fs.open(fullPath, "r");
        const sample = Buffer.alloc(Math.min(512, stat.size));
        const { bytesRead } = await handle.read(sample, 0, sample.length, 0);
        await handle.close();
        if (sample.subarray(0, bytesRead).includes(0)) continue;
        const lines = (await fs.readFile(fullPath, "utf8")).split(/\r?\n/);
        for (let lineIndex = 0; lineIndex < lines.length && matches.length < maxResults; lineIndex++) {
          const lineContent = lines[lineIndex]!;
          regex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(lineContent)) !== null && matches.length < maxResults) {
            matches.push({
              filePath: fullPath,
              relativePath,
              line: lineIndex + 1,
              column: match.index + 1,
              lineContent: lineContent.slice(0, 300),
              matchLength: match[0].length,
            });
            if (match[0].length === 0) regex.lastIndex++;
          }
        }
      } catch { /* Skip unreadable or changing files. */ }
    }
  };
  await walk(rootPath, 0);
  return matches;
}

runSearch(workerData as SearchRequest)
  .then((matches) => parentPort?.postMessage({ matches }))
  .catch((error: unknown) => parentPort?.postMessage({ error: String(error) }));
