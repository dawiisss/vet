import React, { useEffect, useState, useRef } from "react";
import { ModalOverlay } from "@/shared/components/ModalOverlay";
import CodeMirror from "@uiw/react-codemirror";
import { languages } from "@codemirror/language-data";
import { acceptCompletion } from "@codemirror/autocomplete";
import { keymap, EditorView as CMEditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { parseDiffLines } from "../../../../../shared/utils/diffUtils";

const tabCompletionExtension = Prec.highest(
  keymap.of([
    {
      key: "Tab",
      run: acceptCompletion,
    },
  ]),
);

interface EditorModalProps {
  filePath: string;
  sshHostId?: string | null | undefined;
  onClose: () => void;
}

export const EditorModal: React.FC<EditorModalProps> = ({
  filePath: rawFilePath,
  sshHostId,
  onClose,
}) => {
  const isGitDiffInitial = rawFilePath.includes("#git-diff");
  const lineMatch = rawFilePath.match(/#L(\d+)/i);
  const targetLine = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
  const filePath = rawFilePath.split("#")[0]!;

  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isDiffMode, setIsDiffMode] = useState<boolean>(isGitDiffInitial);
  const [diffContent, setDiffContent] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);
  const [langExtensions, setLangExtensions] = useState<any[]>([]);

  const editorRef = useRef<any>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // 1. Fetch file content and dynamic language pack
  useEffect(() => {
    let active = true;
    setLoading(true);
    setStatusMsg(null);
    setIsDirty(false);

    // Resolve language based on extension
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
            if (active) setLangExtensions([le]);
          })
          .catch((err) => {
            console.warn("Failed to load language extensions:", err);
          });
      }
    }

    const readPromise = sshHostId
      ? window.sftpApi.readFileHead(sshHostId, filePath)
      : window.workspaceApi.readFileHead(filePath);

    readPromise
      .then((data) => {
        if (active) {
          // If readFileHead failed with error string inside data (e.g. sftp error helper)
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
  }, [filePath, sshHostId]);

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

  // Fetch Git diff content if in diff mode
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

  // Restore focus on close
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    return () => {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

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
      setStatusMsg({ text: "All changes saved", type: "success" });
    } catch (err: any) {
      console.error("Save failed:", err);
      setStatusMsg({ text: `Save failed: ${err.message || err}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseAttempt = () => {
    if (isDirty) {
      const confirmClose = window.confirm("You have unsaved changes. Are you sure you want to close the editor?");
      if (!confirmClose) return;
    }
    onClose();
  };

  return (
    <ModalOverlay
      containerRef={modalRef}
      onClose={handleCloseAttempt}
      role="dialog"
      aria-modal="true"
      aria-label={`Editing ${filePath}`}
      style={{ zIndex: 99999 }}
    >
      <div
        style={{
          width: "80%",
          maxWidth: 950,
          height: "80%",
          backgroundColor: "color-mix(in srgb, var(--app-bg) 95%, transparent)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 12,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          color: "var(--app-fg)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 0, flex: 1, marginRight: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--app-blue)",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Code Editor {sshHostId ? `[SSH: Remote]` : `[Local]`}
              </div>
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
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--app-fg-subtle)",
              }}
            >
              {filePath}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {statusMsg && (
              <span
                style={{
                  fontSize: 12,
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
                  padding: "6px 12px",
                  borderRadius: 4,
                  border: "1px solid var(--app-border)",
                  backgroundColor: isDiffMode ? "var(--app-blue)" : "rgba(255,255,255,0.08)",
                  color: isDiffMode ? "#000" : "var(--app-fg-subtle)",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.2s",
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
                padding: "6px 12px",
                borderRadius: 4,
                border: "none",
                backgroundColor: isDirty ? "var(--app-blue)" : "rgba(255,255,255,0.08)",
                color: isDirty ? "#000" : "var(--app-fg-subtle)",
                fontWeight: 600,
                fontSize: 12,
                cursor: isDirty && !saving ? "pointer" : "default",
                transition: "all 0.2s",
              }}
            >
              Save
            </button>

            <button
              onClick={handleCloseAttempt}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--app-fg-subtle)",
                cursor: "pointer",
                fontSize: 22,
                padding: 0,
                width: 32,
                height: 32,
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

        {/* Editor Body */}
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
                padding: 16,
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
              extensions={[...langExtensions, tabCompletionExtension]}
              onChange={(value) => {
                setContent(value);
                setIsDirty(true);
                if (statusMsg?.type === "success") {
                  setStatusMsg(null);
                }
              }}
              onCreateEditor={(view) => {
                editorRef.current = view;
                view.focus();
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
                // Intercept Ctrl+S / Cmd+S
                if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                  e.preventDefault();
                  // Grab current value from the editor ref if possible to avoid state lag
                  const currentEditorValue = editorRef.current?.state?.doc?.toString() || content;
                  handleSave(currentEditorValue);
                }
              }}
            />
          )}
        </div>
      </div>
    </ModalOverlay>
  );
};
