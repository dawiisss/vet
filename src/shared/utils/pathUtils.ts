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
 * Default browser homepage fallback URL.
 */
export const DEFAULT_BROWSER_HOMEPAGE = "https://duckduckgo.com";
