import { useEffect, useState, useCallback } from "react";
import Panel from "@/shared/components/Panel";

export interface ConnectionInfo {
  id?: string;
  name: string;
  command: string;
  source: "docker" | "ssh_global" | "ssh_app";
}

export default function ConnectionsPanel({
  isActive,
  onRunScript,
  onLaunchConnection,
}: {
  isActive: boolean;
  onRunScript: (cmd: string, cwd: string) => void;
  onLaunchConnection?: ((id: string) => void) | undefined;
}) {
  const [sshHosts, setSshHosts] = useState<ConnectionInfo[]>([]);
  const [dockerContainers, setDockerContainers] = useState<ConnectionInfo[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  const fetchConnections = useCallback(async () => {
    const api = (window as any).connectionsApi;
    if (!api) return;
    setLoading(true);
    const [ssh, docker] = await Promise.all([
      api.getSshHosts(),
      api.getDockerContainers(),
    ]);
    setSshHosts(ssh);
    setDockerContainers(docker);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isActive) fetchConnections();
  }, [isActive, fetchConnections]);

  const renderItem = (item: ConnectionInfo, icon: string, color: string) => (
    <div key={`${item.source}-${item.name}`} style={{ marginBottom: 8 }}>
      <button
        onClick={() => {
          if (item.source === "ssh_app" && item.id && onLaunchConnection) {
            onLaunchConnection(item.id);
          } else {
            onRunScript(item.command, "");
          }
        }}
        title={item.command}
        style={{
          width: "100%",
          textAlign: "left",
          background: "var(--app-border)",
          border: "1px solid #45475a",
          color: "var(--app-fg)",
          padding: "6px 10px",
          borderRadius: 6,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontWeight: "bold",
            color,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>{icon}</span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 150,
            }}
          >
            {item.name}
          </span>
        </span>
        <span style={{ fontSize: 16, color: "var(--app-fg-subtle)" }}>▶</span>
      </button>
    </div>
  );

  const headerActions = (
    <button
      onClick={fetchConnections}
      style={{
        background: "none",
        border: "none",
        color: "var(--app-blue)",
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      {loading ? "Refreshing..." : "Refresh"}
    </button>
  );

  return (
    <Panel
      title="Connections"
      headerActions={headerActions}
      hasScrollableBody={false}
    >

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--app-fg-muted)",
              marginBottom: 8,
              textTransform: "uppercase",
              fontWeight: "bold",
            }}
          >
            Docker Containers
          </div>
          {dockerContainers.length === 0 && (
            <div
              style={{ color: "#585b70", fontStyle: "italic", fontSize: 12 }}
            >
              No running containers
            </div>
          )}
          {dockerContainers.map((d) => renderItem(d, "🐳", "var(--app-blue)"))}
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--app-fg-muted)",
              marginBottom: 8,
              textTransform: "uppercase",
              fontWeight: "bold",
            }}
          >
            SSH Hosts
          </div>
          {sshHosts.length === 0 && (
            <div
              style={{ color: "#585b70", fontStyle: "italic", fontSize: 12 }}
            >
              No SSH hosts found
            </div>
          )}
          {sshHosts.map((s) => renderItem(s, "🌐", "var(--app-green)"))}
        </div>
      </div>
    </Panel>
  );
}
