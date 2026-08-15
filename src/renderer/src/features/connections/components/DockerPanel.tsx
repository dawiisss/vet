import React, { useState, useEffect, useCallback, useRef } from "react";
import Panel from "@/shared/components/Panel";

export default function DockerPanel({
  isActive,
  onRunScript,
}: {
  isActive: boolean;
  onRunScript: (cmd: string, cwd: string) => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"containers" | "images">("containers");
  const [containers, setContainers] = useState<DockerContainerDetailed[]>([]);
  const [images, setImages] = useState<DockerImageInfo[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [, setLoading] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<{ container: string; logs: string } | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchDockerData = useCallback(async () => {
    if (!window.connectionsApi) return;
    setLoading(true);
    try {
      const [containerList, imageList] = await Promise.all([
        window.connectionsApi.getDockerDetailed(),
        window.connectionsApi.getDockerImages(),
      ]);
      setContainers(containerList || []);
      setImages(imageList || []);
    } catch (err) {
      console.error("Failed to load Docker data:", err);
      setContainers([]);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchDockerData();
      const interval = setInterval(fetchDockerData, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isActive, fetchDockerData]);

  const handleAction = async (target: string, action: "start" | "stop" | "restart" | "rm") => {
    if (action === "rm" && !window.confirm(`Remove container "${target}"?`)) return;
    setActionInProgress(target);
    try {
      const res = await window.connectionsApi.dockerAction(target, action);
      if (!res.success) {
        alert(res.error || `Failed to ${action} container`);
      }
      await fetchDockerData();
    } catch (err: unknown) {
      alert((err as Error).message || "Docker action failed");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleViewLogs = async (name: string) => {
    setLogsLoading(true);
    setSelectedLogs({ container: name, logs: "Loading logs..." });
    try {
      const logs = await window.connectionsApi.dockerLogs(name, 150);
      setSelectedLogs({ container: name, logs: logs || "No log output." });
    } catch (err: unknown) {
      setSelectedLogs({ container: name, logs: (err as Error).message || "Failed to fetch logs" });
    } finally {
      setLogsLoading(false);
    }
  };

  const handleExec = (name: string) => {
    onRunScript(`docker exec -it ${name} /bin/bash`, "");
  };

  const parsePortLinks = (portsStr: string) => {
    if (!portsStr) return [];
    // e.g. "0.0.0.0:8080->80/tcp, :::8080->80/tcp" or "80/tcp"
    const regex = /(?:0\.0\.0\.0|127\.0\.0\.1|:::?):(\d+)->/g;
    const links: Array<{ hostPort: string; url: string }> = [];
    let match;
    const seen = new Set<string>();
    while ((match = regex.exec(portsStr)) !== null) {
      const port = match[1];
      if (port && !seen.has(port)) {
        seen.add(port);
        links.push({
          hostPort: port,
          url: `http://localhost:${port}`,
        });
      }
    }
    return links;
  };

  const filteredContainers = containers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.image.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  const filteredImages = images.filter(
    (img) =>
      img.repository.toLowerCase().includes(searchFilter.toLowerCase()) ||
      img.tag.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  return (
    <Panel
      ref={containerRef}
      tabIndex={0}
      title="Docker Monitor"
      hasScrollableBody={false}
      headerActions={
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={fetchDockerData}
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
      {/* Sub tabs & Search Bar */}
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
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setActiveSubTab("containers")}
            style={{
              flex: 1,
              padding: "4px 0",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 4,
              border: "none",
              background:
                activeSubTab === "containers"
                  ? "var(--app-accent, #89b4fa)"
                  : "var(--app-bg-surface, #1e1e2e)",
              color:
                activeSubTab === "containers" ? "#11111b" : "var(--app-fg-muted, #a6adc8)",
              cursor: "pointer",
            }}
          >
            Containers ({containers.length})
          </button>
          <button
            onClick={() => setActiveSubTab("images")}
            style={{
              flex: 1,
              padding: "4px 0",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 4,
              border: "none",
              background:
                activeSubTab === "images"
                  ? "var(--app-accent, #89b4fa)"
                  : "var(--app-bg-surface, #1e1e2e)",
              color: activeSubTab === "images" ? "#11111b" : "var(--app-fg-muted, #a6adc8)",
              cursor: "pointer",
            }}
          >
            Images ({images.length})
          </button>
        </div>

        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder={`Filter ${activeSubTab}...`}
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
      </div>

      {/* Main Content Area */}
      <div
        className="app-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {activeSubTab === "containers" && (
          <>
            {filteredContainers.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  color: "var(--app-fg-muted, #a6adc8)",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>🐳</span>
                <span style={{ fontSize: 12 }}>
                  {containers.length === 0 ? "No containers found or Docker inactive" : "No matching containers"}
                </span>
              </div>
            ) : (
              filteredContainers.map((c) => {
                const isRunning = c.state === "running";
                const isBusy = actionInProgress === c.name || actionInProgress === c.id;
                const portLinks = parsePortLinks(c.ports);

                return (
                  <div
                    key={c.id || c.name}
                    style={{
                      flexShrink: 0,
                      background: "var(--app-bg-surface, #1e1e2e)",
                      border: "1px solid var(--app-border, #313244)",
                      borderRadius: 6,
                      padding: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {/* Top Row: State Dot, Name, Actions */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: isRunning ? "#a6e3a1" : c.state === "paused" ? "#f9e2af" : "#f38ba8",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: 12,
                            color: "var(--app-fg, #cdd6f4)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.name}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        {isRunning ? (
                          <>
                            <button
                              onClick={() => handleAction(c.name, "stop")}
                              disabled={isBusy}
                              title="Stop Container"
                              style={{
                                background: "var(--app-border, #313244)",
                                border: "none",
                                color: "#f38ba8",
                                borderRadius: 4,
                                padding: "2px 5px",
                                fontSize: 10,
                                cursor: isBusy ? "not-allowed" : "pointer",
                              }}
                            >
                              ⏹
                            </button>
                            <button
                              onClick={() => handleAction(c.name, "restart")}
                              disabled={isBusy}
                              title="Restart Container"
                              style={{
                                background: "var(--app-border, #313244)",
                                border: "none",
                                color: "#f9e2af",
                                borderRadius: 4,
                                padding: "2px 5px",
                                fontSize: 10,
                                cursor: isBusy ? "not-allowed" : "pointer",
                              }}
                            >
                              🔄
                            </button>
                            <button
                              onClick={() => handleExec(c.name)}
                              title="Exec Shell"
                              style={{
                                background: "var(--app-border, #313244)",
                                border: "none",
                                color: "var(--app-accent, #89b4fa)",
                                borderRadius: 4,
                                padding: "2px 5px",
                                fontSize: 10,
                                cursor: "pointer",
                              }}
                            >
                              💻
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleAction(c.name, "start")}
                              disabled={isBusy}
                              title="Start Container"
                              style={{
                                background: "var(--app-border, #313244)",
                                border: "none",
                                color: "#a6e3a1",
                                borderRadius: 4,
                                padding: "2px 5px",
                                fontSize: 10,
                                cursor: isBusy ? "not-allowed" : "pointer",
                              }}
                            >
                              ▶
                            </button>
                            <button
                              onClick={() => handleAction(c.name, "rm")}
                              disabled={isBusy}
                              title="Remove Container"
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--app-fg-subtle, #6c7086)",
                                borderRadius: 4,
                                padding: "2px 4px",
                                fontSize: 10,
                                cursor: isBusy ? "not-allowed" : "pointer",
                              }}
                            >
                              🗑
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleViewLogs(c.name)}
                          title="View Logs"
                          style={{
                            background: "var(--app-border, #313244)",
                            border: "none",
                            color: "var(--app-fg-muted, #a6adc8)",
                            borderRadius: 4,
                            padding: "2px 5px",
                            fontSize: 10,
                            cursor: "pointer",
                          }}
                        >
                          📜
                        </button>
                      </div>
                    </div>

                    {/* Image & Status line */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--app-fg-subtle, #6c7086)" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
                        {c.image}
                      </span>
                      <span>{c.status}</span>
                    </div>

                    {/* Clickable Exposed Ports */}
                    {portLinks.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                        {portLinks.map((p) => (
                          <a
                            key={p.hostPort}
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              e.preventDefault();
                              window.windowApi?.openExternal?.(p.url);
                            }}
                            style={{
                              fontSize: 9,
                              padding: "1px 5px",
                              borderRadius: 3,
                              background: "rgba(137, 180, 250, 0.15)",
                              color: "var(--app-accent, #89b4fa)",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <span>🌐</span>
                            <span>:{p.hostPort}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {activeSubTab === "images" && (
          <>
            {filteredImages.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  color: "var(--app-fg-muted, #a6adc8)",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>🖼</span>
                <span style={{ fontSize: 12 }}>No Docker images found</span>
              </div>
            ) : (
              filteredImages.map((img) => (
                <div
                  key={`${img.id}-${img.repository}-${img.tag}`}
                  style={{
                    background: "var(--app-bg-surface, #1e1e2e)",
                    border: "1px solid var(--app-border, #313244)",
                    borderRadius: 6,
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 11,
                        color: "var(--app-fg, #cdd6f4)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 180,
                      }}
                    >
                      {img.repository}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background: "var(--app-border, #313244)",
                        color: "var(--app-accent, #89b4fa)",
                        fontWeight: 600,
                      }}
                    >
                      {img.tag}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--app-fg-subtle, #6c7086)" }}>
                    <span>{img.size}</span>
                    <span>{img.created}</span>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Logs View Modal / Overlay */}
      {selectedLogs && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(17, 17, 27, 0.95)",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            padding: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
              borderBottom: "1px solid var(--app-border, #313244)",
              paddingBottom: 6,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--app-fg, #cdd6f4)" }}>
              Logs: {selectedLogs.container}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => handleViewLogs(selectedLogs.container)}
                disabled={logsLoading}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--app-accent, #89b4fa)",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                🔄 Refresh
              </button>
              <button
                onClick={() => setSelectedLogs(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--app-fg-muted, #a6adc8)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ✕
              </button>
            </div>
          </div>
          <pre
            className="app-scrollbar"
            style={{
              flex: 1,
              overflowY: "auto",
              fontFamily: "monospace",
              fontSize: 10,
              color: "#a6adc8",
              background: "#11111b",
              padding: 8,
              borderRadius: 4,
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {selectedLogs.logs}
          </pre>
        </div>
      )}
    </Panel>
  );
}
