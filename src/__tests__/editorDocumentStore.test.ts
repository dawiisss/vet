import {
  getEditorDocument, setEditorDocument, saveEditorDocument,
  prepareEditorTransfer, hydrateEditorDocuments,
} from "../renderer/src/features/workspace/editorDocumentStore";

test("overlapping saves share the pending write and preserve later edits", async () => {
  let finish!: () => void;
  const write = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  setEditorDocument("overlap", "/tmp/a.txt", null, { content: "first", isDirty: true });
  const first = saveEditorDocument("overlap", "/tmp/a.txt", null, write);
  await Promise.resolve();
  setEditorDocument("overlap", "/tmp/a.txt", null, { content: "second", isDirty: true });
  const second = saveEditorDocument("overlap", "/tmp/a.txt", null, write);
  expect(first).toBe(second);
  finish();
  await first;
  expect(write).toHaveBeenCalledTimes(1);
  expect(getEditorDocument("overlap", "/tmp/a.txt")).toMatchObject({ content: "second", isDirty: true, isSaving: false });
});

test("a transfer waits for pending saves and snapshots the newest remote buffer", async () => {
  let finish!: () => void;
  const write = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const node = { editorId: "remote", filePath: "/remote/test.ts#L4", sshHostId: "server" };
  setEditorDocument(node.editorId, node.filePath, node.sshHostId, { content: "first", isDirty: true });
  const save = saveEditorDocument(node.editorId, node.filePath, node.sshHostId, write);
  await Promise.resolve();
  setEditorDocument(node.editorId, node.filePath, node.sshHostId, { content: "newest", isDirty: true });
  let prepared = false;
  const preparing = prepareEditorTransfer(node).then((result) => { prepared = true; return result; });
  await Promise.resolve();
  expect(prepared).toBe(false);
  expect(getEditorDocument(node.editorId, node.filePath, node.sshHostId)?.isTransferring).toBe(true);
  finish();
  await save;
  const transfer = await preparing;
  expect(transfer.editorDocuments).toEqual([{
    editorId: "remote", filePath: "/remote/test.ts", sshHostId: "server", content: "newest", isDirty: true,
  }]);
  transfer.release();
  expect(getEditorDocument(node.editorId, node.filePath, node.sshHostId)?.isTransferring).toBe(false);
});

test("failed saves keep their buffer transferable and allow retry", async () => {
  const node = { editorId: "failed", filePath: "/tmp/failed.txt" };
  setEditorDocument(node.editorId, node.filePath, null, { content: "valuable text", isDirty: true });
  const save = saveEditorDocument(node.editorId, node.filePath, null, () => { throw new Error("write failed"); });
  const assertion = expect(save).rejects.toThrow("write failed");
  const transfer = await prepareEditorTransfer(node);
  await assertion;
  expect(transfer.editorDocuments[0]).toMatchObject({ content: "valuable text", isDirty: true });
  transfer.release();
  await saveEditorDocument(node.editorId, node.filePath, null, async () => undefined);
  expect(getEditorDocument(node.editorId, node.filePath)).toMatchObject({ isDirty: false, isSaving: false });
});

test("hydrating a transfer replaces stale destination content", () => {
  setEditorDocument("incoming", "/tmp/incoming.txt", null, { content: "stale", isDirty: false });
  hydrateEditorDocuments([{ editorId: "incoming", filePath: "/tmp/incoming.txt", content: "unsaved edits", isDirty: true }]);
  expect(getEditorDocument("incoming", "/tmp/incoming.txt")).toMatchObject({ content: "unsaved edits", isDirty: true });
});
