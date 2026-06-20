import { useEffect, useState } from "react";
import Panel from "./Panel";

interface SystemMetricsData {
  cpu: number;
  mem: {
    total: number;
    used: number;
  };
  disk: {
    total: number;
    used: number;
    use: number;
  } | null;
  disks: Array<{
    mount: string;
    total: number;
    used: number;
    use: number;
  }>;
  uptime?: number;
  load?: number[];
  temp: number | null;
  network?: {
    rx_sec: number;
    tx_sec: number;
  } | null;
  battery?: {
    hasBattery: boolean;
    percent: number;
    isCharging: boolean;
    acConnected: boolean;
  } | null;
  graphics?: {
    controllers: Array<{
      model: string;
      vram: number;
      memoryTotal?: number;
      memoryUsed?: number;
      temperatureGpu?: number;
      utilizationGpu?: number;
    }>;
  } | null;
  diskIo?: {
    rx_sec: number;
    wx_sec: number;
  } | null;
  appResources?: {
    cpu: number;
    mem: number;
  };
}

export default function SystemMonitorPanel({
  isActive,
}: {
  isActive: boolean;
}) {
  const [data, setData] = useState<SystemMetricsData | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const api = (window as any).sysinfoApi;
    if (!api) return;

    api.start();

    const unsub = api.onUpdate((newData: any) => {
      setData(newData);
    });

    return () => {
      unsub();
      api.stop();
    };
  }, [isActive]);

  if (!data) {
    return (
      <Panel title="System Metrics">
        <div style={{ color: "var(--app-fg-subtle)", fontSize: 13 }}>
          Loading system metrics...
        </div>
      </Panel>
    );
  }

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const sizeSymbol = sizes[i] ?? "B";
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizeSymbol;
  };

  const formatSpeed = (bytesPerSec: number) => {
    return formatBytes(bytesPerSec, 1) + "/s";
  };

  const formatUptime = (seconds?: number) => {
    if (seconds === undefined) return "";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || parts.length === 0) parts.push(`${m}m`);
    return parts.join(" ");
  };

  const cpuPct = data.cpu.toFixed(1);
  const memPct = ((data.mem.used / data.mem.total) * 100).toFixed(1);
  const memUsedGB = (data.mem.used / 1024 ** 3).toFixed(2);
  const memTotalGB = (data.mem.total / 1024 ** 3).toFixed(2);

  // Group styles
  const cardStyle: React.CSSProperties = {
    border: "1px solid var(--app-border)",
    borderRadius: 6,
    padding: 12,
    background: "rgba(255, 255, 255, 0.015)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const cardTitleStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: "bold",
    color: "#bac2de",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid var(--app-border)",
    paddingBottom: 6,
    marginBottom: 4,
  };

  const gridStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
  };

  const progressBgStyle: React.CSSProperties = {
    width: "100%",
    height: 6,
    background: "var(--app-border)",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 4,
  };

  return (
    <Panel title="System Metrics" bodyStyle={{ gap: 14 }}>
      <div style={gridStyle}>
        
        {/* Core Resources Card */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Core Resources</div>
          
          {/* CPU */}
          <div>
            <div style={rowStyle}>
              <span>CPU Usage</span>
              <span>
                {cpuPct}%
                {data.temp !== undefined && data.temp !== null && ` (${data.temp.toFixed(0)}°C)`}
              </span>
            </div>
            <div style={progressBgStyle}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, data.cpu))}%`,
                  height: "100%",
                  background: "var(--app-blue)",
                  transition: "width 1.8s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>
          </div>

          {/* RAM */}
          <div>
            <div style={rowStyle}>
              <span>RAM Usage</span>
              <span>
                {memPct}% ({memUsedGB}GB / {memTotalGB}GB)
              </span>
            </div>
            <div style={progressBgStyle}>
              <div
                style={{
                  width: `${memPct}%`,
                  height: "100%",
                  background: "var(--app-green)",
                  transition: "width 1.8s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>
          </div>

          {/* Load average and Uptime */}
          <div
            style={{
              fontSize: 11,
              color: "var(--app-fg-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              marginTop: 4,
            }}
          >
            {data.load && data.load.length > 0 && (
              <div style={rowStyle}>
                <span>Load Averages</span>
                <span>{data.load.map((v) => v.toFixed(2)).join(", ")}</span>
              </div>
            )}
            {data.uptime !== undefined && (
              <div style={rowStyle}>
                <span>System Uptime</span>
                <span>{formatUptime(data.uptime)}</span>
              </div>
            )}
            {data.appResources && (
              <div style={{ ...rowStyle, borderTop: "1px dashed var(--app-border)", paddingTop: 4, marginTop: 4 }}>
                <span>Vet Process</span>
                <span>
                  {data.appResources.cpu.toFixed(1)}% CPU | {formatBytes(data.appResources.mem)} RAM
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Graphics Card */}
        {data.graphics && data.graphics.controllers.length > 0 && (
          <div style={cardStyle}>
            <div style={cardTitleStyle}>Graphics (GPU)</div>
            {data.graphics.controllers.map((gpu, idx) => {
              const totalVram = gpu.memoryTotal || gpu.vram || 0;
              const usedVram = gpu.memoryUsed || 0;
              const vramPct = totalVram > 0 ? ((usedVram / totalVram) * 100).toFixed(1) : "0.0";
              const gpuUtil = gpu.utilizationGpu ?? 0;
              return (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ ...rowStyle, fontWeight: "500", color: "var(--app-fg)" }}>
                    <span>{gpu.model}</span>
                    {gpu.temperatureGpu !== null && gpu.temperatureGpu !== undefined && (
                      <span>{gpu.temperatureGpu}°C</span>
                    )}
                  </div>
                  
                  <div>
                    <div style={rowStyle}>
                      <span style={{ fontSize: 11, color: "var(--app-fg-subtle)" }}>GPU Utilization</span>
                      <span>{gpuUtil}%</span>
                    </div>
                    <div style={progressBgStyle}>
                      <div
                        style={{
                          width: `${gpuUtil}%`,
                          height: "100%",
                          background: "var(--app-accent)",
                          transition: "width 1.8s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={rowStyle}>
                      <span style={{ fontSize: 11, color: "var(--app-fg-subtle)" }}>VRAM Usage</span>
                      <span>
                        {vramPct}% ({usedVram}MB / {totalVram}MB)
                      </span>
                    </div>
                    <div style={progressBgStyle}>
                      <div
                        style={{
                          width: `${vramPct}%`,
                          height: "100%",
                          background: "var(--app-yellow, #f9e2af)",
                          transition: "width 1.8s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Storage Card */}
        {data.disks && data.disks.length > 0 && (
          <div style={cardStyle}>
            <div style={cardTitleStyle}>Storage & Disk</div>
            
            {data.disks.map((disk, idx) => {
              const diskPct = disk.use.toFixed(1);
              const diskUsedGB = (disk.used / 1024 ** 3).toFixed(1);
              const diskTotalGB = (disk.total / 1024 ** 3).toFixed(1);
              return (
                <div key={idx} style={{ marginBottom: idx < data.disks.length - 1 ? 6 : 0 }}>
                  <div style={rowStyle}>
                    <span>{disk.mount}</span>
                    <span>
                      {diskPct}% ({diskUsedGB}GB / {diskTotalGB}GB)
                    </span>
                  </div>
                  <div style={progressBgStyle}>
                    <div
                      style={{
                        width: `${diskPct}%`,
                        height: "100%",
                        background: "var(--app-accent)",
                        transition: "width 1.8s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {data.diskIo && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--app-fg-subtle)",
                  borderTop: "1px dashed var(--app-border)",
                  paddingTop: 8,
                  marginTop: 4,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Disk Read Speed</span>
                <span>{formatSpeed(data.diskIo.rx_sec)}</span>
              </div>
            )}
            {data.diskIo && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--app-fg-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Disk Write Speed</span>
                <span>{formatSpeed(data.diskIo.wx_sec)}</span>
              </div>
            )}
          </div>
        )}

        {/* Network & Power Card */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Network & Power</div>
          
          {data.network && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={rowStyle}>
                <span style={{ color: "var(--app-fg-subtle)" }}>Download</span>
                <span style={{ color: "var(--app-blue)" }}>↓ {formatSpeed(data.network.rx_sec)}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ color: "var(--app-fg-subtle)" }}>Upload</span>
                <span style={{ color: "var(--app-green)" }}>↑ {formatSpeed(data.network.tx_sec)}</span>
              </div>
            </div>
          )}

          {data.battery && data.battery.hasBattery && (
            <div
              style={{
                borderTop: "1px dashed var(--app-border)",
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <div style={rowStyle}>
                <span>Battery Level</span>
                <span>
                  {data.battery.isCharging ? "⚡ Charging" : data.battery.acConnected ? "Connected" : "Discharging"} ({data.battery.percent}%)
                </span>
              </div>
              <div style={progressBgStyle}>
                <div
                  style={{
                    width: `${data.battery.percent}%`,
                    height: "100%",
                    background: data.battery.percent < 20 ? "#f38ba8" : "var(--app-green)",
                    transition: "width 1.8s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </Panel>
  );
}

