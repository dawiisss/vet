import React, { useState } from "react";
import { useStatusBarStore } from "../stores/useStatusBarStore";
import { useConfig } from "@/features/settings/useConfigStore";

export const StatusBar: React.FC = () => {
  const { config } = useConfig();
  const activePaneType = useStatusBarStore((s) => s.activePaneType);
  const activePaneId = useStatusBarStore((s) => s.activePaneId);
  const terminalStatus = useStatusBarStore((s) => s.terminalStatus);
  const browserStatus = useStatusBarStore((s) => s.browserStatus);
  const editorStatus = useStatusBarStore((s) => s.editorStatus);

  const [copied, setCopied] = useState(false);

  if (config?.showStatusBar === false) {
    return null;
  }

  const handleCopyCwd = (cwd: string) => {
    if (!cwd) return;
    navigator.clipboard.writeText(cwd)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  const renderContent = () => {
    if (!activePaneType || !activePaneId) {
      return (
        <div className="statusbar-section-left">
          <span className="statusbar-text-muted">Vet Workspace Ready</span>
        </div>
      );
    }

    if (activePaneType === "terminal") {
      const status = terminalStatus[activePaneId] || {
        cwd: "",
        command: "",
        cols: 0,
        rows: 0,
        sshHostId: null,
      };
      const isRemote = !!status.sshHostId;

      return (
        <>
          <div className="statusbar-section-left">
            <span className={`statusbar-tag ${isRemote ? "statusbar-tag-remote" : "statusbar-tag-local"}`}>
              {isRemote ? `SSH: ${status.sshHostId}` : "Local"}
            </span>
            {status.command && (
              <span className="statusbar-item">
                <span className="statusbar-icon">🐚</span>
                <span className="statusbar-text">{status.command}</span>
              </span>
            )}
            {status.cwd && (
              <span 
                className="statusbar-item statusbar-clickable" 
                onClick={() => handleCopyCwd(status.cwd)}
                title="Click to copy CWD"
              >
                <span className="statusbar-icon">📁</span>
                <span className="statusbar-text truncate-path">{status.cwd}</span>
                {copied && <span className="statusbar-copied-alert">Copied!</span>}
              </span>
            )}
          </div>
          <div className="statusbar-section-right">
            {status.cols > 0 && status.rows > 0 && (
              <span className="statusbar-item">
                <span className="statusbar-text-muted">{status.cols} × {status.rows}</span>
              </span>
            )}
          </div>
        </>
      );
    }

    if (activePaneType === "browser") {
      const status = browserStatus[activePaneId] || {
        url: "",
        title: "Web Browser",
        blockedCount: 0,
        isHttps: false,
      };

      return (
        <>
          <div className="statusbar-section-left">
            <span className={`statusbar-tag ${status.isHttps ? "statusbar-tag-secure" : "statusbar-tag-warning"}`}>
              {status.isHttps ? "🔒 Secure" : "⚠️ Insecure"}
            </span>
            {status.title && (
              <span className="statusbar-item" title={status.title}>
                <span className="statusbar-text text-truncate">{status.title}</span>
              </span>
            )}
            {status.url && (
              <span className="statusbar-item statusbar-text-muted text-truncate" title={status.url}>
                {status.url}
              </span>
            )}
          </div>
          <div className="statusbar-section-right">
            <span className="statusbar-item statusbar-tag-adblock">
              <span>🛡️ {status.blockedCount} blocked</span>
            </span>
          </div>
        </>
      );
    }

    if (activePaneType === "editor") {
      const status = editorStatus[activePaneId] || {
        line: 1,
        col: 1,
        language: "Plain Text",
        isDirty: false,
        filePath: "",
        sshHostId: null,
      };
      const isRemote = !!status.sshHostId;

      return (
        <>
          <div className="statusbar-section-left">
            <span className={`statusbar-tag ${isRemote ? "statusbar-tag-remote" : "statusbar-tag-local"}`}>
              {isRemote ? "Remote Editor" : "Local Editor"}
            </span>
            {status.filePath && (
              <span className="statusbar-item" title={status.filePath}>
                <span className="statusbar-text text-truncate">{status.filePath.split("/").pop() || "Untitled"}</span>
              </span>
            )}
            {status.isDirty && (
              <span className="statusbar-tag statusbar-tag-dirty">
                Modified
              </span>
            )}
          </div>
          <div className="statusbar-section-right">
            <span className="statusbar-item">
              <span className="statusbar-text-muted">{status.language}</span>
            </span>
            <span className="statusbar-item font-mono">
              <span className="statusbar-text">Ln {status.line}, Col {status.col}</span>
            </span>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div className="app-statusbar" id="workspace-statusbar">
      {renderContent()}
    </div>
  );
};

export default StatusBar;
