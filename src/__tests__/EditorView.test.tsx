/** @jest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom";
import { render, fireEvent, screen, act } from "@testing-library/react";

jest.mock("@uiw/react-codemirror", () => ({
  __esModule: true,
  default: (props: { value: string; editable: boolean; extensions: unknown[]; onChange: (value: string) => void }) =>
    React.createElement("textarea", {
      "data-testid": "editor",
      "data-extension-count": props.extensions.length,
      value: props.value,
      readOnly: !props.editable,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange(event.target.value),
    }),
}));
jest.mock("@codemirror/language-data", () => ({
  languages: [{ name: "TypeScript", extensions: ["ts"], load: jest.fn(async () => ({ language: "test" })) }],
}));

import { EditorView } from "../renderer/src/features/workspace/components/EditorView";
import { getEditorDocument, prepareEditorTransfer } from "../renderer/src/features/workspace/editorDocumentStore";
import { languages } from "@codemirror/language-data";

let nextId = 0;
function editorProps() {
  return { editorId: `editor-test-${++nextId}`, filePath: `/tmp/editor-test-${nextId}.ts`, isActive: true };
}

beforeEach(() => {
  window.workspaceApi = {
    readFile: jest.fn(async () => "disk content"),
    writeFile: jest.fn(async () => undefined),
  } as unknown as WorkspaceApi;
});

test("edits typed during a save stay dirty and survive remounting", async () => {
  let finishSave!: () => void;
  (window.workspaceApi.writeFile as jest.Mock).mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  const props = editorProps();
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<EditorView {...props} />); });
  fireEvent.change(screen.getByTestId("editor"), { target: { value: "version A" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
  fireEvent.change(screen.getByTestId("editor"), { target: { value: "version B" } });
  await act(async () => { finishSave(); });
  expect(window.workspaceApi.writeFile).toHaveBeenCalledWith(props.filePath, "version A");
  expect(getEditorDocument(props.editorId, props.filePath)).toMatchObject({ content: "version B", isDirty: true, isSaving: false });
  view.unmount();
  await act(async () => { render(<EditorView {...props} />); });
  expect(screen.getByTestId("editor")).toHaveValue("version B");
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});

test("save completion updates an editor that remounted during the write", async () => {
  let finishSave!: () => void;
  (window.workspaceApi.writeFile as jest.Mock).mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  const props = editorProps();
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<EditorView {...props} />); });
  fireEvent.change(screen.getByTestId("editor"), { target: { value: "saved text" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
  view.unmount();
  await act(async () => { render(<EditorView {...props} />); });
  expect(getEditorDocument(props.editorId, props.filePath)?.isSaving).toBe(true);
  await act(async () => { finishSave(); });
  expect(getEditorDocument(props.editorId, props.filePath)).toMatchObject({ content: "saved text", isDirty: false, isSaving: false });
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
});

test("cached remount reloads the language extension without rereading the file", async () => {
  const load = languages[0]!.load as jest.Mock;
  load.mockClear();
  const props = editorProps();
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<EditorView {...props} />); });
  expect(screen.getByTestId("editor")).toHaveAttribute("data-extension-count", "3");
  view.unmount();
  await act(async () => { render(<EditorView {...props} />); });
  expect(load).toHaveBeenCalledTimes(2);
  expect(window.workspaceApi.readFile).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("editor")).toHaveAttribute("data-extension-count", "3");
});

test("editor buffers are read-only while a window transfer is pending", async () => {
  const props = editorProps();
  await act(async () => { render(<EditorView {...props} />); });
  let transfer!: Awaited<ReturnType<typeof prepareEditorTransfer>>;
  await act(async () => { transfer = await prepareEditorTransfer(props); });
  expect(screen.getByTestId("editor")).toHaveAttribute("readonly");
  fireEvent.change(screen.getByTestId("editor"), { target: { value: "late edit" } });
  expect(getEditorDocument(props.editorId, props.filePath)?.content).toBe("disk content");
  await act(async () => { transfer.release(); });
  expect(screen.getByTestId("editor")).not.toHaveAttribute("readonly");
});
