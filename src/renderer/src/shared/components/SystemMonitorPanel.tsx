import { useEffect, useState } from "react";
import Panel from "./Panel";

export default function SystemMonitorPanel({
  isActive,
}: {
  isActive: boolean;
}) {
  const [data, setData] = useState<{
    cpu: number;
    mem: { total: number; used: number };
  } | null>(null);

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

  const cpuPct = data.cpu.toFixed(1);
  const memPct = ((data.mem.used / data.mem.total) * 100).toFixed(1);
  const memUsedGB = (data.mem.used / 1024 ** 3).toFixed(2);
  const memTotalGB = (data.mem.total / 1024 ** 3).toFixed(2);

  return (
    <Panel title="System Metrics" bodyStyle={{ gap: 16 }}>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span>CPU Usage</span>
          <span>{cpuPct}%</span>
        </div>
        <div
          style={{
            width: "100%",
            height: 8,
            background: "var(--app-border)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${data.cpu}%`,
              height: "100%",
              background: "var(--app-blue)",
              transition: "width 0.5s",
            }}
          />
        </div>
      </div>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span>RAM Usage</span>
          <span>
            {memPct}% ({memUsedGB}GB / {memTotalGB}GB)
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: 8,
            background: "var(--app-border)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${memPct}%`,
              height: "100%",
              background: "var(--app-green)",
              transition: "width 0.5s",
            }}
          />
        </div>
      </div>
    </Panel>
  );
}

