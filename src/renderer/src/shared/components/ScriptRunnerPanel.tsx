import { useEffect, useState, useRef, useMemo } from "react";
import Panel from "./Panel";

export default function ScriptRunnerPanel({
  isActive,
  onRunScript,
}: {
  isActive: boolean;
  onRunScript: (cmd: string, cwd: string) => void;
}) {
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [workspaceDir, setWorkspaceDir] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [keyboardIndex, setKeyboardIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;
    if (containerRef.current) containerRef.current.focus();
    const api = window.workspaceApi;
    if (!api) return;

    api
      .getScripts("")
      .then((res: WorkspaceScriptsResult | null) => {
        if (res) {
          setWorkspaceDir(res.cwd || "");
          if (res.tasks && Array.isArray(res.tasks) && res.tasks.length > 0) {
            setTasks(res.tasks);
          } else if (res.scripts) {
            const fallbackTasks: WorkspaceTask[] = Object.entries(res.scripts).map(([name, cmd]) => ({
              name,
              command: `npm run ${name}`,
              source: "npm",
              description: typeof cmd === "string" ? cmd : undefined,
            }));
            setTasks(fallbackTasks);
          } else {
            setTasks([]);
          }
        } else {
          setTasks([]);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch scripts:", err);
        setTasks([]);
      });
  }, [isActive]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => s.add(t.source));
    return Array.from(s);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSource = selectedSource === "all" || t.source === selectedSource;
      const matchQuery =
        !searchFilter ||
        t.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        t.command.toLowerCase().includes(searchFilter.toLowerCase());
      return matchSource && matchQuery;
    });
  }, [tasks, selectedSource, searchFilter]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredTasks.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setKeyboardIndex((prev) => Math.min(prev + 1, filteredTasks.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setKeyboardIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredTasks[keyboardIndex];
      if (selected) {
        onRunScript(selected.command, workspaceDir);
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

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "npm":
        return { bg: "rgba(243, 139, 168, 0.15)", text: "#f38ba8" };
      case "make":
        return { bg: "rgba(250, 179, 135, 0.15)", text: "#fab387" };
      case "cargo":
        return { bg: "rgba(249, 226, 175, 0.15)", text: "#f9e2af" };
      case "python":
        return { bg: "rgba(137, 180, 250, 0.15)", text: "#89b4fa" };
      case "docker":
        return { bg: "rgba(137, 220, 235, 0.15)", text: "#89dceb" };
      case "deno":
        return { bg: "rgba(166, 227, 161, 0.15)", text: "#a6e3a1" };
      case "task":
        return { bg: "rgba(203, 166, 247, 0.15)", text: "#cba6f7" };
      default:
        return { bg: "var(--app-border)", text: "var(--app-fg-muted)" };
    }
  };

  return (
    <Panel
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      title="Project Scripts"
      hasScrollableBody={false}
    >
      {tasks.length === 0 ? (
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
          <span style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>⚡</span>
          <p style={{ margin: "0 0 4px 0", fontSize: 14, color: "var(--app-fg)" }}>
            No scripts found
          </p>
          <p style={{ margin: 0, fontSize: 12 }}>
            Add package.json to the workspace
          </p>
        </div>
      ) : (
        <>
          {/* Workspace & Search / Source Filters */}
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
            {workspaceDir && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--app-fg-muted)",
                  wordBreak: "break-all",
                }}
              >
                Workspace: {workspaceDir}
              </div>
            )}
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter tasks..."
              style={{
                width: "100%",
                padding: "5px 8px",
                background: "var(--app-bg-surface, #1e1e2e)",
                border: "1px solid var(--app-border, #313244)",
                borderRadius: 4,
                color: "var(--app-fg, #cdd6f4)",
                fontSize: 11,
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {sources.length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                <button
                  onClick={() => setSelectedSource("all")}
                  style={{
                    border: "none",
                    borderRadius: 3,
                    padding: "2px 6px",
                    fontSize: 10,
                    fontWeight: 600,
                    background:
                      selectedSource === "all"
                        ? "var(--app-accent, #89b4fa)"
                        : "var(--app-bg-surface, #1e1e2e)",
                    color:
                      selectedSource === "all" ? "#11111b" : "var(--app-fg-muted, #a6adc8)",
                    cursor: "pointer",
                  }}
                >
                  All ({tasks.length})
                </button>
                {sources.map((src) => {
                  const count = tasks.filter((t) => t.source === src).length;
                  return (
                    <button
                      key={src}
                      onClick={() => setSelectedSource(src)}
                      style={{
                        border: "none",
                        borderRadius: 3,
                        padding: "2px 6px",
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        background:
                          selectedSource === src
                            ? "var(--app-accent, #89b4fa)"
                            : "var(--app-bg-surface, #1e1e2e)",
                        color:
                          selectedSource === src ? "#11111b" : "var(--app-fg-muted, #a6adc8)",
                        cursor: "pointer",
                      }}
                    >
                      {src} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tasks List */}
          <div
            className="app-scrollbar"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {filteredTasks.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--app-fg-subtle, #6c7086)",
                  textAlign: "center",
                  padding: 16,
                }}
              >
                No matching tasks found.
              </div>
            ) : (
              filteredTasks.map((task, index) => {
                const isSel = keyboardIndex === index;
                const badge = getSourceBadgeColor(task.source);

                return (
                  <div key={`${task.source}-${task.name}`} style={{ marginBottom: 4, flexShrink: 0 }}>
                    <button
                      data-active={isSel}
                      aria-label={`Run script ${task.name}`}
                      onMouseEnter={() => setKeyboardIndex(index)}
                      onClick={() => onRunScript(task.command, workspaceDir)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: isSel
                          ? "var(--app-surface-selected, rgba(137, 180, 250, 0.15))"
                          : "var(--app-bg-surface, #1e1e2e)",
                        border: "1px solid",
                        borderColor: isSel ? "var(--app-accent, #89b4fa)" : "var(--app-border, #313244)",
                        borderRadius: 6,
                        padding: "6px 8px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                          overflow: "hidden",
                          flex: 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "1px 4px",
                              borderRadius: 3,
                              background: badge.bg,
                              color: badge.text,
                              flexShrink: 0,
                            }}
                          >
                            {task.source}
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: 12,
                              color: "var(--app-fg, #cdd6f4)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {task.name}
                          </span>
                        </div>
                        {task.description && (
                          <div
                            style={{
                              fontSize: 10,
                              fontFamily: "monospace",
                              color: "var(--app-fg-subtle, #6c7086)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {task.description}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          color: isSel ? "var(--app-accent, #89b4fa)" : "var(--app-fg-subtle, #6c7086)",
                          flexShrink: 0,
                        }}
                      >
                        ▶
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </Panel>
  );
}


