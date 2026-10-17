import { create } from "zustand";

interface EditorDocumentState {
  content: string;
  isDirty: boolean;
  isSaving: boolean;
  isTransferring: boolean;
}

const useDocuments = create<{ documents: Map<string, EditorDocumentState> }>(() => ({
  documents: new Map(),
}));
const pendingSaves = new Map<string, Promise<void>>();
const transferringKeys = new Set<string>();

function key(editorId: string, filePath: string, sshHostId?: string | null): string {
  return JSON.stringify([editorId, sshHostId || "local", filePath.split("#")[0]]);
}

function updateDocument(documentKey: string, update: Partial<EditorDocumentState>): void {
  useDocuments.setState(({ documents }) => {
    const next = new Map(documents);
    next.set(documentKey, {
      content: "",
      isDirty: false,
      isSaving: false,
      isTransferring: transferringKeys.has(documentKey),
      ...documents.get(documentKey),
      ...update,
    });
    return { documents: next };
  });
}

export function useEditorDocument(editorId: string, filePath: string, sshHostId?: string | null) {
  return useDocuments((state) => state.documents.get(key(editorId, filePath, sshHostId)));
}

export function getEditorDocument(
  editorId: string,
  filePath: string,
  sshHostId?: string | null,
): EditorDocumentState | undefined {
  return useDocuments.getState().documents.get(key(editorId, filePath, sshHostId));
}

export function setEditorDocument(
  editorId: string,
  filePath: string,
  sshHostId: string | null | undefined,
  state: Pick<EditorDocumentState, "content" | "isDirty">,
): void {
  updateDocument(key(editorId, filePath, sshHostId), state);
}

// Saves outlive layout components. Newer edits stay dirty and are never
// replaced by the buffer submitted to an earlier write.
export function saveEditorDocument(
  editorId: string,
  filePath: string,
  sshHostId: string | null | undefined,
  write: (content: string) => Promise<void>,
): Promise<void> {
  const documentKey = key(editorId, filePath, sshHostId);
  const pending = pendingSaves.get(documentKey);
  if (pending) return pending;
  const document = getEditorDocument(editorId, filePath, sshHostId);
  if (!document || document.isTransferring) return Promise.resolve();

  const submittedContent = document.content;
  updateDocument(documentKey, { isSaving: true });
  const operation = (async () => {
    try {
      await Promise.resolve().then(() => write(submittedContent));
      const latest = getEditorDocument(editorId, filePath, sshHostId);
      if (latest) updateDocument(documentKey, { isDirty: latest.content !== submittedContent });
    } finally {
      pendingSaves.delete(documentKey);
      if (useDocuments.getState().documents.has(documentKey)) {
        updateDocument(documentKey, { isSaving: false });
      }
    }
  })();
  pendingSaves.set(documentKey, operation);
  return operation;
}

export function hydrateEditorDocuments(documents: EditorDocumentSnapshot[]): void {
  for (const document of documents) {
    setEditorDocument(document.editorId, document.filePath, document.sshHostId, {
      content: document.content,
      isDirty: document.isDirty,
    });
  }
}

export function forgetEditorDocuments(root: TabTransferNode): void {
  const keys = new Set<string>();
  const visit = (node: TabTransferNode) => {
    if (node.editorId) keys.add(key(node.editorId, node.filePath || "", node.sshHostId));
    node.children?.forEach(visit);
  };
  visit(root);
  useDocuments.setState(({ documents }) => {
    const next = new Map(documents);
    keys.forEach((documentKey) => next.delete(documentKey));
    return { documents: next };
  });
}

export async function prepareEditorTransfer(root: TabTransferNode): Promise<{
  editorDocuments: EditorDocumentSnapshot[];
  release: () => void;
}> {
  const leaves: TabTransferNode[] = [];
  const visit = (node: TabTransferNode): void => {
    if (node.editorId) leaves.push(node);
    node.children?.forEach(visit);
  };
  visit(root);
  const keys = leaves.map((node) => key(node.editorId!, node.filePath || "", node.sshHostId));
  if (keys.some((documentKey) => transferringKeys.has(documentKey))) {
    throw new Error("An editor transfer is already in progress");
  }
  for (const documentKey of keys) {
    transferringKeys.add(documentKey);
    if (useDocuments.getState().documents.has(documentKey)) {
      updateDocument(documentKey, { isTransferring: true });
    }
  }
  const release = () => {
    for (const documentKey of keys) {
      transferringKeys.delete(documentKey);
      if (useDocuments.getState().documents.has(documentKey)) {
        updateDocument(documentKey, { isTransferring: false });
      }
    }
  };
  // Failed saves still transfer their unsaved buffer.
  await Promise.allSettled(keys.map((documentKey) => pendingSaves.get(documentKey)));
  const editorDocuments: EditorDocumentSnapshot[] = [];
  for (const node of leaves) {
    const filePath = (node.filePath || "").split("#")[0]!;
    const document = getEditorDocument(node.editorId!, filePath, node.sshHostId);
    if (document) editorDocuments.push({
      editorId: node.editorId!,
      filePath,
      sshHostId: node.sshHostId,
      content: document.content,
      isDirty: document.isDirty,
    });
  }
  return { editorDocuments, release };
}
