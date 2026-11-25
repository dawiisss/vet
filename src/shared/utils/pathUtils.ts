/**
 * Compares two path arrays (e.g. number[]) for equality.
 */
export function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Sorts directory items: folders first, then alphabetically.
 */
export interface SortableItem {
  name: string;
  isDirectory: boolean;
}

export function sortDirectoryItems<T extends SortableItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Safely quotes a shell argument for POSIX shells when it contains characters
 * outside a conservative unquoted-safe set. Strips NUL/CR/LF control characters
 * to prevent command-line injection when writing commands to a terminal PTY.
 */
export function quotePosixArg(arg: string): string {
  const cleaned = arg.replace(/[\r\n\0]/g, "");
  if (cleaned.length > 0 && /^[A-Za-z0-9_./:@+-]+$/.test(cleaned) && !cleaned.startsWith("-")) {
    return cleaned;
  }
  return `'${cleaned.replace(/'/g, "'\\''")}'`;
}

/**
 * Default browser homepage fallback URL.
 */
export const DEFAULT_BROWSER_HOMEPAGE = "https://duckduckgo.com";
