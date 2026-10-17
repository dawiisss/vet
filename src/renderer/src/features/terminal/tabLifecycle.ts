import { getEditorDocument } from "../workspace/editorDocumentStore";

const transferringTabs = new Set<string>();
const windowDirtyChecks = new Set<() => boolean>();
let replacingWorkspace = false;

export function isTabLocked(tabId: string): boolean {
  return replacingWorkspace || transferringTabs.has(tabId);
}

export function isWorkspaceLocked(): boolean {
  return replacingWorkspace;
}

export function hasPendingTabOperation(): boolean {
  return replacingWorkspace || transferringTabs.size > 0;
}

export function lockTabTransfer(tabId: string): (() => void) | null {
  if (isTabLocked(tabId)) return null;
  transferringTabs.add(tabId);
  return () => { transferringTabs.delete(tabId); };
}

export function lockWorkspaceReplacement(): (() => void) | null {
  if (hasPendingTabOperation()) return null;
  replacingWorkspace = true;
  return () => { replacingWorkspace = false; };
}

export function hasDirtyDocuments(roots: TabTransferNode[]): boolean {
  return roots.some((node) =>
    (node.editorId && getEditorDocument(node.editorId, node.filePath || "", node.sshHostId)?.isDirty) ||
    (node.children && hasDirtyDocuments(node.children)),
  );
}

export function confirmDiscardDocuments(roots: TabTransferNode[]): boolean {
  return !hasDirtyDocuments(roots) || window.confirm("You have unsaved changes. Discard them and continue?");
}

// Floating editors are not part of a tab tree. Register their live dirty
// state so the application has one confirmation for all unsaved documents.
export function registerWindowDirtyCheck(check: () => boolean): () => void {
  windowDirtyChecks.add(check);
  return () => { windowDirtyChecks.delete(check); };
}

// Electron fires beforeunload for native window close, app quit, and the title
// bar close IPC. Read live roots so detached/closed documents are not included.
export function registerWindowCloseGuard(getRoots: () => TabTransferNode[]): () => void {
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    const hasUnsavedChanges = hasDirtyDocuments(getRoots()) ||
      [...windowDirtyChecks].some((check) => check());
    if (hasPendingTabOperation() || (hasUnsavedChanges &&
        !window.confirm("You have unsaved changes. Discard them and continue?"))) {
      event.preventDefault();
      event.returnValue = false;
    }
  };
  window.addEventListener("beforeunload", onBeforeUnload);
  return () => window.removeEventListener("beforeunload", onBeforeUnload);
}
