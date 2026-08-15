import React, { useState, useEffect, useCallback, useRef } from "react";
import Panel from "./Panel";

export default function GitPanel({
  isActive,
  activeTerminalId,
  onViewFile,
}: {
  isActive: boolean;
  activeTerminalId?: string | null | undefined;
  onViewFile?: ((filePath: string) => void) | undefined;
}) {
  const [cwd, setCwd] = useState<string>("");
  const [gitStatus, setGitStatus] = useState<GitDetailedStatus | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [recentCommits, setRecentCommits] = useState<GitCommitInfo[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);
  const [showLog, setShowLog] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showStatus = (text: string, type: "info" | "success" | "error" = "info") => {
    setStatusMessage({ text, type });
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // 1. Fetch terminal CWD
  useEffect(() => {
    if (!isActive || !activeTerminalId) return;
    window.terminalApi
      ?.getTerminalInfo(activeTerminalId)
      .then((info) => {
        if (info?.cwd) setCwd(info.cwd);
      })
      .catch(() => {});
  }, [isActive, activeTerminalId]);

  // 2. Fetch Git Data
  const refreshGit = useCallback(async () => {
    if (!cwd) return;
    setLoading(true);
    try {
      const status = await window.workspaceApi.getGitDetailedStatus(cwd);
      setGitStatus(status);
      if (status.isGit) {
        const [branchData, logData] = await Promise.all([
          window.workspaceApi.getGitBranches(cwd),
          window.workspaceApi.getGitLog(cwd, 15),
        ]);
        setBranches(branchData.all || []);
        setRecentCommits(logData || []);
      } else {
        setBranches([]);
        setRecentCommits([]);
      }
    } catch (err) {
      console.error("Failed to load git status:", err);
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    if (isActive && cwd) {
      refreshGit();
      const interval = setInterval(refreshGit, 4000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isActive, cwd, refreshGit]);

  const handleStage = async (files?: string[]) => {
    if (!cwd) return;
    const res = await window.workspaceApi.gitStage(cwd, files);
    if (!res.success) {
      showStatus(res.error || "Failed to stage files", "error");
    }
    refreshGit();
  };

  const handleUnstage = async (files?: string[]) => {
    if (!cwd) return;
    const res = await window.workspaceApi.gitUnstage(cwd, files);
    if (!res.success) {
      showStatus(res.error || "Failed to unstage files", "error");
    }
    refreshGit();
  };

  const handleDiscard = async (files: string[]) => {
    if (!cwd) return;
    if (!window.confirm(`Discard changes to ${files.join(", ")}? This cannot be undone.`)) return;
    const res = await window.workspaceApi.gitDiscard(cwd, files);
    if (!res.success) {
      showStatus(res.error || "Failed to discard changes", "error");
    }
    refreshGit();
  };

  const handleCommit = async () => {
    if (!cwd || !commitMessage.trim()) return;
    setLoading(true);
    const res = await window.workspaceApi.gitCommit(cwd, commitMessage.trim());
    setLoading(false);
    if (res.success) {
      setCommitMessage("");
      showStatus("Committed successfully!", "success");
      refreshGit();
    } else {
      showStatus(res.error || "Commit failed", "error");
    }
  };

  const handlePush = async () => {
    if (!cwd) return;
    setLoading(true);
    const res = await window.workspaceApi.gitPush(cwd);
    setLoading(false);
    if (res.success) {
      showStatus("Pushed commits successfully!", "success");
      refreshGit();
    } else {
      showStatus(res.error || "Push failed", "error");
    }
  };

  const handlePull = async () => {
    if (!cwd) return;
    setLoading(true);
    const res = await window.workspaceApi.gitPull(cwd);
    setLoading(false);
    if (res.success) {
      showStatus("Pulled changes successfully!", "success");
      refreshGit();
    } else {
      showStatus(res.error || "Pull failed", "error");
    }
  };

  const handleCheckoutBranch = async (branch: string) => {
    if (!cwd || !branch || branch === gitStatus?.branch) return;
    const res = await window.workspaceApi.gitCheckout(cwd, branch);
    if (res.success) {
      showStatus(`Switched to branch ${branch}`, "success");
      refreshGit();
    } else {
      showStatus(res.error || "Failed to switch branch", "error");
    }
  };

  const handleOpenDiff = (filePath: string) => {
    const fullPath = gitStatus?.repoRoot ? `${gitStatus.repoRoot}/${filePath}` : filePath;
    const diffPath = `${fullPath}#git-diff`;
    if (onViewFile) {
      onViewFile(diffPath);
    } else {
      window.dispatchEvent(
        new CustomEvent("vet:open-editor", {
          detail: { filePath: diffPath, sshHostId: null },
        }),
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "A":
        return "#a6e3a1"; // green
      case "M":
        return "#fab387"; // orange
      case "D":
        return "#f38ba8"; // red
      case "U":
      case "?":
        return "#89dceb"; // teal
      default:
        return "var(--app-fg-muted, #a6adc8)";
    }
  };

  if (!gitStatus || !gitStatus.isGit) {
    return (
      <Panel ref={containerRef} tabIndex={0} title="Source Control" hasScrollableBody={false}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "var(--app-fg-muted, #a6adc8)",
            textAlign: "center",
            padding: 20,
          }}
        >
          <span style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>🔀</span>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>No Git Repository</div>
          <div style={{ fontSize: 11, color: "var(--app-fg-subtle, #6c7086)" }}>
            The active workspace directory is not a Git repository.
          </div>
        </div>
      </Panel>
    );
  }

  const stagedCount = gitStatus.staged.length;
  const unstagedCount = gitStatus.unstaged.length + gitStatus.untracked.length;

  return (
    <Panel
      ref={containerRef}
      tabIndex={0}
      title="Source Control"
      hasScrollableBody={false}
      headerActions={
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={refreshGit}
            title="Refresh"
            style={{
              background: "none",
              border: "none",
              color: "var(--app-fg-muted, #a6adc8)",
              cursor: "pointer",
              fontSize: 12,
              padding: "2px 4px",
            }}
          >
            🔄
          </button>
        </div>
      }
    >
      {/* Branch & Sync Action Bar */}
      <div
        style={{
          borderBottom: "1px solid var(--app-border, #313244)",
          paddingBottom: 8,
          marginBottom: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {/* Branch Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, overflow: "hidden" }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>🌿</span>
            <select
              value={branches.includes(gitStatus.branch) ? gitStatus.branch : ""}
              onChange={(e) => handleCheckoutBranch(e.target.value)}
              disabled={loading || branches.length === 0}
              style={{
                background: "var(--app-bg-surface, #1e1e2e)",
                border: "1px solid var(--app-border, #313244)",
                borderRadius: 4,
                color: "var(--app-fg, #cdd6f4)",
                fontSize: 11,
                padding: "2px 4px",
                outline: "none",
                cursor: "pointer",
                maxWidth: 140,
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}
            >
              {branches.length === 0 ? (
                <option value="">{gitStatus.branch || "main"}</option>
              ) : (
                branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Ahead / Behind & Sync */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {(gitStatus.behind > 0 || gitStatus.ahead > 0) && (
              <span style={{ fontSize: 10, color: "var(--app-fg-muted, #a6adc8)", marginRight: 2 }}>
                {gitStatus.behind > 0 && `↓${gitStatus.behind}`}
                {gitStatus.ahead > 0 && ` ↑${gitStatus.ahead}`}
              </span>
            )}
            <button
              onClick={handlePull}
              disabled={loading}
              title="Pull from remote"
              style={{
                background: "var(--app-bg-surface, #1e1e2e)",
                border: "1px solid var(--app-border, #313244)",
                color: "var(--app-fg, #cdd6f4)",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 10,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              ↓ Pull
            </button>
            <button
              onClick={handlePush}
              disabled={loading}
              title="Push to remote"
              style={{
                background: "var(--app-bg-surface, #1e1e2e)",
                border: "1px solid var(--app-border, #313244)",
                color: "var(--app-fg, #cdd6f4)",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 10,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              ↑ Push
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 10,
              background:
                statusMessage.type === "error"
                  ? "rgba(243, 139, 168, 0.15)"
                  : statusMessage.type === "success"
                    ? "rgba(166, 227, 161, 0.15)"
                    : "rgba(137, 180, 250, 0.15)",
              color:
                statusMessage.type === "error"
                  ? "#f38ba8"
                  : statusMessage.type === "success"
                    ? "#a6e3a1"
                    : "#89b4fa",
              border: `1px solid ${
                statusMessage.type === "error"
                  ? "rgba(243, 139, 168, 0.3)"
                  : statusMessage.type === "success"
                    ? "rgba(166, 227, 161, 0.3)"
                    : "rgba(137, 180, 250, 0.3)"
              }`,
            }}
          >
            {statusMessage.text}
          </div>
        )}
      </div>

      {/* Commit Box */}
      <div
        style={{
          borderBottom: "1px solid var(--app-border, #313244)",
          paddingBottom: 8,
          marginBottom: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleCommit();
            }
          }}
          placeholder="Message (Ctrl+Enter to commit)"
          rows={2}
          style={{
            width: "100%",
            background: "var(--app-bg-surface, #1e1e2e)",
            border: "1px solid var(--app-border, #313244)",
            borderRadius: 6,
            color: "var(--app-fg, #cdd6f4)",
            fontSize: 11,
            padding: 6,
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={handleCommit}
          disabled={loading || !commitMessage.trim() || stagedCount === 0}
          style={{
            width: "100%",
            background: stagedCount > 0 && commitMessage.trim() ? "var(--app-accent, #89b4fa)" : "var(--app-border, #313244)",
            color: stagedCount > 0 && commitMessage.trim() ? "#11111b" : "var(--app-fg-muted, #a6adc8)",
            border: "none",
            borderRadius: 6,
            padding: "5px 0",
            fontSize: 11,
            fontWeight: 600,
            cursor: stagedCount > 0 && commitMessage.trim() ? "pointer" : "not-allowed",
          }}
        >
          ✓ Commit ({stagedCount} staged)
        </button>
      </div>

      {/* Scrollable Changes Area */}
      <div
        className="app-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "0 12px 8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Staged Changes Section */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--app-fg-muted, #a6adc8)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            <span>Staged Changes ({stagedCount})</span>
            {stagedCount > 0 && (
              <button
                onClick={() => handleUnstage()}
                title="Unstage All"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--app-fg-subtle, #6c7086)",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "0 4px",
                }}
              >
                − Unstage All
              </button>
            )}
          </div>

          {stagedCount === 0 ? (
            <div style={{ fontSize: 10, color: "var(--app-fg-subtle, #6c7086)", fontStyle: "italic", padding: "4px 0" }}>
              No staged changes
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {gitStatus.staged.map((f) => (
                <div
                  key={`staged-${f.path}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "3px 6px",
                    borderRadius: 4,
                    background: "var(--app-bg-surface, #1e1e2e)",
                    fontSize: 11,
                  }}
                >
                  <div
                    onClick={() => handleOpenDiff(f.path)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    <span style={{ fontWeight: "bold", fontSize: 10, color: getStatusColor(f.status) }}>
                      {f.status}
                    </span>
                    <span style={{ color: "var(--app-fg, #cdd6f4)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {f.path}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnstage([f.path])}
                    title="Unstage file"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--app-fg-subtle, #6c7086)",
                      cursor: "pointer",
                      fontSize: 12,
                      padding: "0 4px",
                    }}
                  >
                    −
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unstaged Changes Section */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--app-fg-muted, #a6adc8)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            <span>Changes ({unstagedCount})</span>
            {unstagedCount > 0 && (
              <button
                onClick={() => handleStage()}
                title="Stage All"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--app-fg-subtle, #6c7086)",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "0 4px",
                }}
              >
                + Stage All
              </button>
            )}
          </div>

          {unstagedCount === 0 ? (
            <div style={{ fontSize: 10, color: "var(--app-fg-subtle, #6c7086)", fontStyle: "italic", padding: "4px 0" }}>
              Working directory clean
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {/* Unstaged files */}
              {gitStatus.unstaged.map((f) => (
                <div
                  key={`unstaged-${f.path}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "3px 6px",
                    borderRadius: 4,
                    background: "var(--app-bg-surface, #1e1e2e)",
                    fontSize: 11,
                  }}
                >
                  <div
                    onClick={() => handleOpenDiff(f.path)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    <span style={{ fontWeight: "bold", fontSize: 10, color: getStatusColor(f.status) }}>
                      {f.status}
                    </span>
                    <span style={{ color: "var(--app-fg, #cdd6f4)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {f.path}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <button
                      onClick={() => handleDiscard([f.path])}
                      title="Discard changes"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--app-fg-subtle, #6c7086)",
                        cursor: "pointer",
                        fontSize: 11,
                        padding: "0 3px",
                      }}
                    >
                      ↩
                    </button>
                    <button
                      onClick={() => handleStage([f.path])}
                      title="Stage file"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--app-fg-subtle, #6c7086)",
                        cursor: "pointer",
                        fontSize: 12,
                        padding: "0 3px",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              {/* Untracked files */}
              {gitStatus.untracked.map((f) => (
                <div
                  key={`untracked-${f.path}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "3px 6px",
                    borderRadius: 4,
                    background: "var(--app-bg-surface, #1e1e2e)",
                    fontSize: 11,
                  }}
                >
                  <div
                    onClick={() => handleOpenDiff(f.path)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    <span style={{ fontWeight: "bold", fontSize: 10, color: "#89dceb" }}>
                      U
                    </span>
                    <span style={{ color: "var(--app-fg, #cdd6f4)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {f.path}
                    </span>
                  </div>
                  <button
                    onClick={() => handleStage([f.path])}
                    title="Track file"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--app-fg-subtle, #6c7086)",
                      cursor: "pointer",
                      fontSize: 12,
                      padding: "0 3px",
                    }}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Commits Accordion */}
        <div style={{ marginTop: 4 }}>
          <div
            onClick={() => setShowLog(!showLog)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--app-fg-muted, #a6adc8)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              padding: "4px 0",
              userSelect: "none",
            }}
          >
            <span>Recent Commits ({recentCommits.length})</span>
            <span>{showLog ? "▾" : "▸"}</span>
          </div>

          {showLog && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {recentCommits.map((c) => (
                <div
                  key={c.hash}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 4,
                    background: "var(--app-bg-surface, #1e1e2e)",
                    border: "1px solid var(--app-border, #313244)",
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        color: "var(--app-accent, #89b4fa)",
                        fontWeight: 600,
                        fontSize: 10,
                      }}
                    >
                      {c.hash.substring(0, 7)}
                    </span>
                    <span style={{ fontSize: 9, color: "var(--app-fg-subtle, #6c7086)" }}>
                      {c.date}
                    </span>
                  </div>
                  <div
                    style={{
                      color: "var(--app-fg, #cdd6f4)",
                      fontSize: 11,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.message}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--app-fg-muted, #a6adc8)", marginTop: 2 }}>
                    by {c.author}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
