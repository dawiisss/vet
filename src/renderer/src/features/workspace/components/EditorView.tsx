import React, { useEffect, useState, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { languages } from "@codemirror/language-data";
import { acceptCompletion } from "@codemirror/autocomplete";
import { keymap, EditorView as CMEditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import ContextMenu, { ContextMenuAction } from "@/shared/components/ContextMenu";
import { parseDiffLines } from "../../../../../shared/utils/diffUtils";
import { useStatusBarStore } from "@/shared/stores/useStatusBarStore";

const tabCompletionExtension = Prec.highest(
  keymap.of([
    {
      key: "Tab",
      run: acceptCompletion,
    },
  ]),
);

interface EditorViewProps {
  editorId: string;
  filePath?: string | undefined;
  sshHostId?: string | null | undefined;
  isActive: boolean;
  isFocused?: boolean | undefined;
  onFocus?: (() => void) | undefined;
  onExit?: (() => void) | undefined;
  onExtract?: (() => void) | undefined;
  onContextMenuAction?: ((action: "split-h" | "split-v" | "close") => void) | undefined;
}

export const EditorView: React.FC<EditorViewProps> = ({
  editorId: _editorId,
  filePath: rawFilePath = "",
  sshHostId,
  isActive: _isActive,
  isFocused,
  onFocus,
  onExit,
  onExtract,
  onContextMenuAction,
}) => {
  const safeRawPath = rawFilePath || "";
  const isGitDiffInitial = safeRawPath.includes("#git-diff");
  const lineMatch = safeRawPath.match(/#L(\d+)/i);
  const targetLine = lineMatch && lineMatch[1] ? parseInt(lineMatch[1], 10) : undefined;
  const filePath = safeRawPath.split("#")[0]!;

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isDiffMode, setIsDiffMode] = useState(isGitDiffInitial);
  const [diffContent, setDiffContent] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);
  const [langExtensions, setLangExtensions] = useState<any[]>([]);

  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
  }>({ isOpen: false, x: 0, y: 0 });

  // 1. Fetch file content and dynamic language pack
  useEffect(() => {
    if (!filePath) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setStatusMsg(null);
    setIsDirty(false);

    // Resolve language based on extension safely
    const ext = filePath.split(".").pop()?.toLowerCase();
    if (ext) {
      const lang = languages.find(
        (l) =>
          (l.extensions && l.extensions.includes(ext)) ||
          (l.alias && l.alias.includes(ext)) ||
          (l.name && l.name.toLowerCase() === ext)
      );
      if (lang) {
        lang.load()
          .then((le) => {
            if (active) {
              setLangExtensions([le]);
              useStatusBarStore.getState().updateEditorStatus(_editorId, {
                language: lang.name,
              });
            }
          })
          .catch((err) => {
            console.warn("Failed to load language extensions:", err);
          });
      } else {
        useStatusBarStore.getState().updateEditorStatus(_editorId, {
          language: "Plain Text",
        });
      }
    } else {
      useStatusBarStore.getState().updateEditorStatus(_editorId, {
        language: "Plain Text",
      });
    }

    const readPromise = sshHostId
      ? window.sftpApi.readFileHead(sshHostId, filePath)
      : window.workspaceApi.readFileHead(filePath);

    readPromise
      .then((data) => {
        if (active) {
          if (data.startsWith("Error: Failed to read file.")) {
            setStatusMsg({ text: data, type: "error" });
            setContent("");
          } else {
            setContent(data);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setStatusMsg({ text: `Failed to read file: ${err.message || err}`, type: "error" });
          setContent("");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [filePath, sshHostId, _editorId]);

  const jumpToLine = (lineNum: number) => {
    const view = editorRef.current;
    if (!view) return;
    setTimeout(() => {
      try {
        const lineCount = view.state?.doc?.lines || 1;
        const validLine = Math.max(1, Math.min(lineNum, lineCount));
        const lineObj = view.state.doc.line(validLine);
        view.dispatch({
          selection: { anchor: lineObj.from, head: lineObj.from },
          effects: CMEditorView.scrollIntoView(lineObj.from, { y: "center" }),
        });
      } catch { /* intentional ignore */ }
    }, 100);
  };

  // Scroll to target line when file finishes loading or line changes
  useEffect(() => {
    if (!loading && targetLine) {
      jumpToLine(targetLine);
    }
  }, [loading, targetLine, rawFilePath]);

  // 2. Fetch Git diff content if in diff mode
  useEffect(() => {
    if (!isDiffMode || !filePath || sshHostId) return;
    let active = true;
    const parts = filePath.split("/");
    parts.pop();
    const dir = parts.join("/") || "/";
    window.workspaceApi
      .getGitDiff(dir, filePath)
      .then((diff) => {
        if (active) setDiffContent(diff || "No git changes detected.");
      })
      .catch(() => {
        if (active) setDiffContent("Failed to load git diff.");
      });
    return () => {
      active = false;
    };
  }, [isDiffMode, filePath, sshHostId]);

  // Set active pane when focused
  useEffect(() => {
    if (isFocused) {
      useStatusBarStore.getState().setActivePane("editor", _editorId);
    }
  }, [isFocused, _editorId]);

  // Sync general editor state metadata
  useEffect(() => {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const lang = languages.find(
      (l) =>
        (l.extensions && l.extensions.includes(ext)) ||
        (l.alias && l.alias.includes(ext)) ||
        (l.name && l.name.toLowerCase() === ext)
    );
    useStatusBarStore.getState().updateEditorStatus(_editorId, {
      filePath,
      sshHostId,
      isDirty,
      language: lang ? lang.name : "Plain Text",
    });
  }, [_editorId, filePath, sshHostId, isDirty]);

  // Focus editor when isFocused changes
  useEffect(() => {
    if (isFocused && editorRef.current) {
      try {
        editorRef.current.focus();
      } catch { /* intentional ignore */ }
    }
  }, [isFocused]);

  const handleSave = async (currentVal?: string) => {
    const valToSave = currentVal !== undefined ? currentVal : content;
    setSaving(true);
    setStatusMsg({ text: "Saving...", type: "info" });

    try {
      if (sshHostId) {
        await window.sftpApi.writeFile(sshHostId, filePath, valToSave);
      } else {
        await window.workspaceApi.writeFile(filePath, valToSave);
      }
      setIsDirty(false);
      setStatusMsg({ text: "Saved", type: "success" });
    } catch (err: any) {
      console.error("Save failed:", err);
      setStatusMsg({ text: `Failed: ${err.message || err}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseAttempt = () => {
    if (isDirty) {
      const confirmClose = window.confirm("You have unsaved changes. Are you sure you want to close this editor pane?");
      if (!confirmClose) return;
    }
    if (onExit) onExit();
  };

  const contextMenuActions: ContextMenuAction[] = [];
  if (isDirty && !saving) {
    contextMenuActions.push({
      id: "save",
      label: "Save File",
      shortcut: "Ctrl+S",
      onExecute: () => {
        const val = editorRef.current?.state?.doc?.toString() || content;
        handleSave(val);
      },
    });
  }

  contextMenuActions.push(
    {
      id: "split-h",
      label: "Split Horizontal",
      separator: true,
      onExecute: () => onContextMenuAction?.("split-h"),
    },
    {
      id: "split-v",
      label: "Split Vertical",
      onExecute: () => onContextMenuAction?.("split-v"),
    },
    {
      id: "close",
      label: "Close Pane",
      separator: true,
      onExecute: handleCloseAttempt,
    },
  );

  // Listener for CM selection and document updates to push coordinates to status store
  const updateListener = useRef<any>(null);
  if (!updateListener.current) {
    updateListener.current = CMEditorView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        const col = pos - line.from + 1;
        useStatusBarStore.getState().updateEditorStatus(_editorId, {
          line: line.number,
          col,
        });
      }
    });
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={onFocus}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenuState({ isOpen: true, x: e.clientX, y: e.clientY });
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "var(--app-bg)",
        border: isFocused
          ? "1px solid var(--app-accent)"
          : "1px solid var(--app-border)",
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Editor Navigation/Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "6px 12px",
          background: "rgba(0, 0, 0, 0.15)",
          borderBottom: "1px solid var(--app-border)",
          backdropFilter: "blur(8px)",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontSize: 10,
              color: sshHostId ? "var(--app-yellow)" : "var(--app-blue)",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
            }}
          >
            {sshHostId ? "Remote" : "Local"} Editor
          </span>
          {isDirty && (
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "var(--app-yellow)",
              }}
              title="Unsaved changes"
            />
          )}
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              color: "var(--app-fg-subtle)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={filePath || "Untitled"}
          >
            {filePath.split("/").pop() || "Untitled"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {statusMsg && (
            <span
              style={{
                fontSize: 11,
                color:
                  statusMsg.type === "error"
                    ? "var(--app-red)"
                    : statusMsg.type === "success"
                      ? "var(--app-green)"
                      : "var(--app-fg-subtle)",
                fontFamily: "monospace",
              }}
            >
              {statusMsg.text}
            </span>
          )}

          {!sshHostId && (
            <button
              onClick={() => setIsDiffMode((prev) => !prev)}
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                border: "1px solid var(--app-border)",
                backgroundColor: isDiffMode ? "var(--app-blue)" : "rgba(255,255,255,0.06)",
                color: isDiffMode ? "#000" : "var(--app-fg-subtle)",
                fontWeight: 600,
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              title="Toggle Git Diff view"
            >
              {isDiffMode ? "Edit" : "Diff"}
            </button>
          )}

          <button
            onClick={() => handleSave()}
            disabled={loading || saving || !isDirty}
            style={{
              padding: "3px 8px",
              borderRadius: 4,
              border: "none",
              backgroundColor: isDirty ? "var(--app-blue)" : "rgba(255,255,255,0.06)",
              color: isDirty ? "#000" : "var(--app-fg-subtle)",
              fontWeight: 600,
              fontSize: 11,
              cursor: isDirty && !saving ? "pointer" : "default",
              transition: "all 0.15s",
            }}
          >
            Save
          </button>

          {onExtract && (
            <button
              onClick={onExtract}
              title="Extract to new tab (Ctrl+Shift+E)"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--app-fg-subtle)",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10 14L21 3" />
                <path d="M15 3h6v6" />
                <path d="M14 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h11" />
              </svg>
            </button>
          )}

          <button
            onClick={handleCloseAttempt}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--app-fg-subtle)",
              cursor: "pointer",
              fontSize: 18,
              padding: 0,
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Editor Workspace */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative", display: "flex" }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              color: "var(--app-fg-subtle)",
              fontSize: 12,
            }}
          >
            Loading content...
          </div>
        ) : isDiffMode ? (
          <div
            className="app-scrollbar"
            style={{
              flex: 1,
              overflow: "auto",
              padding: 12,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              background: "rgba(0, 0, 0, 0.3)",
              color: "var(--app-fg)",
            }}
          >
            {diffContent ? (
              parseDiffLines(diffContent).map((item, idx) => {
                let color = "var(--app-fg)";
                let bg = "transparent";
                if (item.type === "add") {
                  color = "#a6e3a1";
                  bg = "rgba(166, 227, 161, 0.12)";
                } else if (item.type === "delete") {
                  color = "#f38ba8";
                  bg = "rgba(243, 139, 168, 0.12)";
                } else if (item.type === "hunk") {
                  color = "#cba6f7";
                  bg = "rgba(203, 166, 247, 0.15)";
                } else if (item.type === "header") {
                  color = "#89dceb";
                  bg = "rgba(137, 220, 235, 0.1)";
                }
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      color,
                      background: bg,
                      padding: "1px 4px",
                      borderRadius: 2,
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        textAlign: "right",
                        color: "var(--app-fg-muted)",
                        opacity: 0.5,
                        userSelect: "none",
                        paddingRight: 6,
                        flexShrink: 0,
                      }}
                    >
                      {item.oldNum}
                    </span>
                    <span
                      style={{
                        width: 32,
                        textAlign: "right",
                        color: "var(--app-fg-muted)",
                        opacity: 0.5,
                        userSelect: "none",
                        paddingRight: 8,
                        marginRight: 8,
                        borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                        flexShrink: 0,
                      }}
                    >
                      {item.newNum}
                    </span>
                    <span style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                      {item.line}
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={{ color: "var(--app-fg-subtle)", fontStyle: "italic" }}>
                No git diff available for this file.
              </div>
            )}
          </div>
        ) : (
          <CodeMirror
            value={content}
            height="100%"
            theme="dark"
            extensions={[...langExtensions, tabCompletionExtension, updateListener.current]}
            onChange={(value) => {
              setContent(value);
              setIsDirty(true);
              if (statusMsg?.type === "success") {
                setStatusMsg(null);
              }
            }}
            onCreateEditor={(view) => {
              editorRef.current = view;
              if (isFocused) {
                view.focus();
              }
              if (targetLine) {
                jumpToLine(targetLine);
              }
            }}
            style={{
              flex: 1,
              fontSize: 13,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              height: "100%",
              overflow: "auto",
            }}
            indentWithTab={true}
            onKeyDown={(e) => {
              // Intercept Ctrl+S
              if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                const currentEditorValue = editorRef.current?.state?.doc?.toString() || content;
                handleSave(currentEditorValue);
              }
            }}
          />
        )}
      </div>

      <ContextMenu
        isOpen={contextMenuState.isOpen}
        x={contextMenuState.x}
        y={contextMenuState.y}
        onClose={() =>
          setContextMenuState((prev) => ({ ...prev, isOpen: false }))
        }
        actions={contextMenuActions}
      />
    </div>
  );
};

export default EditorView;
