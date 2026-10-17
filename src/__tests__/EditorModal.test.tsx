/** @jest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom";
import { render, fireEvent, screen, act, cleanup } from "@testing-library/react";

jest.mock("@uiw/react-codemirror", () => ({
  __esModule: true,
  default: (props: { value: string; onChange: (value: string) => void; onKeyDown: React.KeyboardEventHandler }) =>
    React.createElement("textarea", {
      "data-testid": "modal-editor",
      value: props.value,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange(event.target.value),
      onKeyDown: props.onKeyDown,
    }),
}));
jest.mock("@codemirror/language-data", () => ({ languages: [] }));

import { EditorModal } from "../renderer/src/features/workspace/components/EditorModal";
import { registerWindowCloseGuard } from "../renderer/src/features/terminal/tabLifecycle";
import { setEditorDocument } from "../renderer/src/features/workspace/editorDocumentStore";

let removeGuard: () => void;
beforeEach(() => {
  window.workspaceApi = {
    readFile: jest.fn(async () => "disk content"),
    writeFile: jest.fn(async () => undefined),
  } as unknown as WorkspaceApi;
  window.sftpApi = {
    readFile: jest.fn(async () => "remote content"),
    writeFile: jest.fn(async () => undefined),
  } as unknown as SftpApi;
  jest.spyOn(window, "confirm").mockReturnValue(false);
  removeGuard = registerWindowCloseGuard(() => []);
});

afterEach(() => {
  cleanup();
  removeGuard();
  jest.restoreAllMocks();
});

function closeWindow() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

test.each([null, "remote-host"])("window closure checks dirty modal edits for host %s", async (sshHostId) => {
  const onClose = jest.fn();
  await act(async () => { render(<EditorModal filePath="/tmp/modal.txt" sshHostId={sshHostId} onClose={onClose} />); });
  expect(closeWindow().defaultPrevented).toBe(false);
  expect(window.confirm).not.toHaveBeenCalled();
  fireEvent.change(screen.getByTestId("modal-editor"), { target: { value: "valuable unsaved text" } });
  expect(closeWindow().defaultPrevented).toBe(true);
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("modal-editor")).toHaveValue("valuable unsaved text");
  expect(onClose).not.toHaveBeenCalled();
  (window.confirm as jest.Mock).mockReturnValueOnce(true);
  expect(closeWindow().defaultPrevented).toBe(false);
});

test("saving a modal clears its window-close warning", async () => {
  await act(async () => { render(<EditorModal filePath="/tmp/modal.txt" onClose={jest.fn()} />); });
  fireEvent.change(screen.getByTestId("modal-editor"), { target: { value: "saved text" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
  expect(window.workspaceApi.writeFile).toHaveBeenCalledWith("/tmp/modal.txt", "saved text");
  expect(closeWindow().defaultPrevented).toBe(false);
  expect(window.confirm).not.toHaveBeenCalled();
});

test("newer modal edits remain protected after an earlier save completes", async () => {
  let finishSave!: () => void;
  (window.workspaceApi.writeFile as jest.Mock).mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  await act(async () => { render(<EditorModal filePath="/tmp/modal.txt" onClose={jest.fn()} />); });
  fireEvent.change(screen.getByTestId("modal-editor"), { target: { value: "version A" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
  expect(closeWindow().defaultPrevented).toBe(true);
  fireEvent.change(screen.getByTestId("modal-editor"), { target: { value: "version B" } });
  await act(async () => { finishSave(); });
  expect(screen.getByTestId("modal-editor")).toHaveValue("version B");
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  expect(closeWindow().defaultPrevented).toBe(true);
});

test("a failed modal save retains its buffer and window-close warning", async () => {
  (window.workspaceApi.writeFile as jest.Mock).mockRejectedValueOnce(new Error("Write denied"));
  jest.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => { render(<EditorModal filePath="/tmp/modal.txt" onClose={jest.fn()} />); });
  fireEvent.change(screen.getByTestId("modal-editor"), { target: { value: "unsaved text" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
  expect(screen.getByTestId("modal-editor")).toHaveValue("unsaved text");
  expect(closeWindow().defaultPrevented).toBe(true);
});

test("unmounting a dirty modal removes its window-close registration", async () => {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<EditorModal filePath="/tmp/modal.txt" onClose={jest.fn()} />); });
  fireEvent.change(screen.getByTestId("modal-editor"), { target: { value: "unsaved text" } });
  expect(closeWindow().defaultPrevented).toBe(true);
  view.unmount();
  (window.confirm as jest.Mock).mockClear();
  expect(closeWindow().defaultPrevented).toBe(false);
  expect(window.confirm).not.toHaveBeenCalled();
});

test("dirty modal and tab editors share a single window-close confirmation", async () => {
  removeGuard();
  setEditorDocument("modal-guard-tab", "/tmp/tab.txt", null, { content: "tab edits", isDirty: true });
  removeGuard = registerWindowCloseGuard(() => [{ editorId: "modal-guard-tab", filePath: "/tmp/tab.txt" }]);
  await act(async () => { render(<EditorModal filePath="/tmp/modal.txt" onClose={jest.fn()} />); });
  fireEvent.change(screen.getByTestId("modal-editor"), { target: { value: "modal edits" } });
  (window.confirm as jest.Mock).mockReturnValueOnce(true);
  expect(closeWindow().defaultPrevented).toBe(false);
  expect(window.confirm).toHaveBeenCalledTimes(1);
});
