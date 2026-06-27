import { useEffect, useState, useRef } from "react";
import Panel from "./Panel";

export default function ScriptRunnerPanel({
  isActive,
  onRunScript,
}: {
  isActive: boolean;
  onRunScript: (cmd: string, cwd: string) => void;
}) {
  const [scripts, setScripts] = useState<Record<string, string> | null>(null);
  const [workspaceDir, setWorkspaceDir] = useState<string>("");
  const [keyboardIndex, setKeyboardIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;
    if (containerRef.current) containerRef.current.focus();
    const api = (window as any).workspaceApi;
    if (!api) return;

    api
      .getScripts()
      .then((res: any) => {
        if (res) {
          setScripts(res.scripts);
          setWorkspaceDir(res.cwd);
        } else {
          setScripts(null);
        }
      })
      .catch((err: any) => {
        console.error("Failed to fetch scripts:", err);
        setScripts(null);
      });
  }, [isActive]);

  const scriptEntries = scripts ? Object.entries(scripts) : [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (scriptEntries.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setKeyboardIndex((prev) => Math.min(prev + 1, scriptEntries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setKeyboardIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = scriptEntries[keyboardIndex];
      if (selected) {
        onRunScript(`npm run ${selected[0]}`, workspaceDir);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (keyboardIndex >= 0 && containerRef.current) {
      const activeEl = containerRef.current.querySelector(
        '[data-active="true"]',
      );
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [keyboardIndex]);

  return (
    <Panel
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      title="Project Scripts"
      hasScrollableBody={false}
    >
      {!scripts && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "var(--app-fg-muted)",
            textAlign: "center",
            padding: 20,
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.3, marginBottom: 16 }}
          >
            <path d="M12 2v20"></path>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <p
            style={{
              margin: "0 0 4px 0",
              fontSize: 14,
              color: "var(--app-fg)",
            }}
          >
            No scripts found
          </p>
          <p style={{ margin: 0, fontSize: 12 }}>
            Add package.json to the workspace
          </p>
        </div>
      )}

      {scripts && (
        <div className="app-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--app-fg-muted)",
              marginBottom: 8,
              wordBreak: "break-all",
            }}
          >
            Workspace: {workspaceDir}
          </div>
          {scriptEntries.map(([name, cmd], index) => {
            const isSel = keyboardIndex === index;
            return (
              <div key={name} style={{ marginBottom: 8 }}>
                <button
                  data-active={isSel}
                  onMouseEnter={() => setKeyboardIndex(index)}
                  onClick={() => onRunScript(`npm run ${name}`, workspaceDir)}
                  aria-label={`Run script ${name}`}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: isSel
                      ? "color-mix(in srgb, var(--app-blue) 20%, transparent)"
                      : "var(--app-border)",
                    border: "1px solid",
                    borderColor: isSel ? "var(--app-blue)" : "#45475a",
                    color: "var(--app-fg)",
                    padding: "6px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "background 0.2s, border-color 0.2s",
                  }}
                >
                  <span
                    style={{ fontWeight: "bold", color: "var(--app-blue)" }}
                  >
                    {name}
                  </span>
                  <span style={{ fontSize: 16 }}>▶</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

