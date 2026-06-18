import { useState, useRef, useEffect, useCallback } from "react";
import { useConfig } from "@/features/settings/useConfigStore";
import SystemMonitorPanel from "./SystemMonitorPanel";
import PortMonitorPanel from "./PortMonitorPanel";
import ScriptRunnerPanel from "./ScriptRunnerPanel";
import SnippetLibraryPanel from "./SnippetLibraryPanel";
import ConnectionsPanel from "@/features/connections/components/ConnectionsPanel";
import WorkspacePanel from "@/features/workspace/components/WorkspacePanel";
import HistoryPanel from "./HistoryPanel";
import ClipboardHistoryPanel from "./ClipboardHistoryPanel";

export default function Sidebar({
  onRunScript,
  onInjectSnippet,
  onViewSession,
  activeTerminalId,
  onViewFile,
  onLaunchConnection,
  width = 250,
}: {
  onRunScript: (cmd: string, cwd: string) => void;
  onInjectSnippet: (snippet: string) => void;
  onViewSession: (sessionId: string) => void;
  activeTerminalId: string | null;
  onViewFile: (filePath: string) => void;
  onLaunchConnection?: (id: string) => void;
  width?: number;
}) {
  const { config, updateConfig } = useConfig();
  const [activeTab, setActiveTab] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        containerRef.current &&
        !containerRef.current.contains(document.activeElement)
      ) {
        document.getElementById(`sidebar-panel-${activeTab}`)?.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Update container width when width prop changes externally
  useEffect(() => {
    if (containerRef.current && !isDraggingRef.current) {
      containerRef.current.style.width = `${width}px`;
    }
  }, [width]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = containerRef.current?.offsetWidth || width;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current || !containerRef.current) return;

        const delta =
          config.sidebarPlacement === "left"
            ? moveEvent.clientX - startXRef.current
            : startXRef.current - moveEvent.clientX;

        const newWidth = Math.max(
          150,
          Math.min(600, startWidthRef.current + delta),
        );
        containerRef.current.style.width = `${newWidth}px`;
      };

      const handleMouseUp = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        if (containerRef.current) {
          const finalWidth = containerRef.current.offsetWidth;
          updateConfig({ sidebarWidth: finalWidth });
        }

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [config.sidebarPlacement, width, updateConfig],
  );

  const panelConfigs = [
    {
      id: 0,
      icon: "📁",
      name: "Workspace",
      render: (isActive: boolean) => (
        <WorkspacePanel
          isActive={isActive}
          activeTerminalId={activeTerminalId}
          onViewFile={onViewFile}
        />
      ),
    },
    {
      id: 1,
      icon: "📊",
      name: "System",
      render: (isActive: boolean) => <SystemMonitorPanel isActive={isActive} />,
    },
    {
      id: 2,
      icon: "🔌",
      name: "Ports",
      render: (isActive: boolean) => <PortMonitorPanel isActive={isActive} />,
    },
    {
      id: 3,
      icon: "⚡",
      name: "Scripts",
      render: (isActive: boolean) => (
        <ScriptRunnerPanel isActive={isActive} onRunScript={onRunScript} />
      ),
    },
    {
      id: 4,
      icon: "📋",
      name: "Snippets",
      render: (isActive: boolean) => (
        <SnippetLibraryPanel
          isActive={isActive}
          onInjectSnippet={onInjectSnippet}
        />
      ),
    },
    {
      id: 5,
      icon: "📑",
      name: "Clipboard",
      render: (isActive: boolean) => (
        <ClipboardHistoryPanel
          isActive={isActive}
          onInjectSnippet={onInjectSnippet}
        />
      ),
    },
    {
      id: 6,
      icon: "🌐",
      name: "Connections",
      render: (isActive: boolean) => (
        <ConnectionsPanel
          isActive={isActive}
          onRunScript={onRunScript}
          onLaunchConnection={onLaunchConnection}
        />
      ),
    },
    {
      id: 7,
      icon: "📜",
      name: "History",
      render: (isActive: boolean) => (
        <HistoryPanel isActive={isActive} onViewSession={onViewSession} />
      ),
    },
  ];

  const isLeftPlacement = config.sidebarPlacement === "left";

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDownCapture={(e) => {
        if (e.key === "Tab" && containerRef.current) {
          const focusableElements = Array.from(
            containerRef.current.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null);

          if (focusableElements.length > 0) {
            const firstElement = focusableElements[0]!;
            const lastElement = focusableElements[focusableElements.length - 1]!;

            if (e.shiftKey) {
              if (
                document.activeElement === firstElement ||
                document.activeElement === containerRef.current
              ) {
                e.preventDefault();
                lastElement.focus();
              }
            } else {
              if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          }
        }
      }}
      onKeyDown={(e) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setActiveTab((prev) => (prev - 1 + panelConfigs.length) % panelConfigs.length);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setActiveTab((prev) => (prev + 1) % panelConfigs.length);
        }
      }}
      style={{
        width: width,
        height: "100%",
        display: "flex",
        background: "color-mix(in srgb, var(--app-bg) 60%, transparent)",
        backdropFilter: "blur(10px)",
        borderLeft:
          "1px solid color-mix(in srgb, var(--app-border) 50%, transparent)",
        borderRight:
          "1px solid color-mix(in srgb, var(--app-border) 50%, transparent)",
        position: "relative",
      }}
    >
      <div
        role="tablist"
        aria-label="Sidebar panels"
        style={{
          width: 48,
          background: "color-mix(in srgb, var(--app-bg) 80%, transparent)",
          borderRight:
            "1px solid color-mix(in srgb, var(--app-border) 50%, transparent)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 12,
        }}
      >
        {panelConfigs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            aria-controls={`sidebar-panel-${t.id}`}
            id={`sidebar-tab-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            title={t.name}
            style={{
              width: 36,
              height: 36,
              marginBottom: 8,
              borderRadius: 8,
              background: activeTab === t.id ? "var(--app-border)" : "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              transition: "background 0.2s",
            }}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {panelConfigs.map((panel) => (
          <div
            key={panel.id}
            role="tabpanel"
            aria-labelledby={`sidebar-tab-${panel.id}`}
            id={`sidebar-panel-${panel.id}`}
            tabIndex={-1}
            style={{
              display: activeTab === panel.id ? "block" : "none",
              height: "100%",
              outline: "none",
            }}
          >
            {panel.render(activeTab === panel.id)}
          </div>
        ))}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        role="separator"
        aria-label="Resize sidebar"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
          }
        }}
        style={{
          position: "absolute",
          top: 0,
          [isLeftPlacement ? "right" : "left"]: -2,
          width: 4,
          height: "100%",
          cursor: "col-resize",
          background: "transparent",
          zIndex: 10,
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background = "var(--app-accent)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background = "transparent";
        }}
      />
    </div>
  );
}
