function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validEditorOptions(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  const { line, column, view, sshConnectionId } = value;
  const validPosition = (position: unknown) =>
    position === undefined || (typeof position === "number" && Number.isSafeInteger(position) && position > 0);
  return validPosition(line) && validPosition(column) &&
    (sshConnectionId === undefined || typeof sshConnectionId === "string") &&
    (view === undefined || view === "text" || view === "git-diff");
}

function validRoot(root: unknown): boolean {
  const pending = [root];
  const seen = new Set<unknown>();
  while (pending.length > 0) {
    const node = pending.pop();
    if (!isRecord(node) || seen.has(node)) return false;
    seen.add(node);
    if (node.children !== undefined) {
      if (!Array.isArray(node.children) || node.children.length === 0 ||
          (node.direction !== "horizontal" && node.direction !== "vertical") ||
          !Array.isArray(node.sizes) || node.sizes.length !== node.children.length ||
          node.sizes.some((size) => typeof size !== "number" || !Number.isFinite(size) || size < 0)) return false;
      for (const child of node.children) pending.push(child);
      continue;
    }
    const ids = [node.terminalId, node.browserId, node.editorId].filter((id) => id !== undefined);
    if (ids.length !== 1 || typeof ids[0] !== "string" || ids[0].length === 0) return false;
    if (node.browserId && node.url !== undefined && typeof node.url !== "string") return false;
    if (node.editorId && (typeof node.filePath !== "string" ||
        (node.sshHostId != null && typeof node.sshHostId !== "string") ||
        !validEditorOptions(node.editorOptions))) return false;
  }
  return true;
}

export function isWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  if (!isRecord(value) || !Array.isArray(value.tabs) ||
      (value.activeTabId != null && typeof value.activeTabId !== "string")) return false;
  const ids = new Set<string>();
  for (const tab of value.tabs) {
    if (!isRecord(tab) || typeof tab.id !== "string" || !tab.id || ids.has(tab.id) ||
        typeof tab.label !== "string" || !validRoot(tab.root) ||
        (tab.focusedPath !== undefined && (!Array.isArray(tab.focusedPath) ||
          tab.focusedPath.some((index) => typeof index !== "number" || !Number.isSafeInteger(index) || index < 0)))) return false;
    ids.add(tab.id);
  }
  return true;
}
