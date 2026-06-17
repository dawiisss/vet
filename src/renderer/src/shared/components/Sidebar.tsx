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

  const tabs = [
    { icon: "📁", name: "Workspace" },
    { icon: "📊", name: "System" },
    { icon: "🔌", name: "Ports" },
    { icon: "⚡", name: "Scripts" },
    { icon: "📋", name: "Snippets" },
    { icon: "📑", name: "Clipboard" },
    { icon: "🌐", name: "Connections" },
    { icon: "📜", name: "History" },
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
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

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
          setActiveTab((prev) => (prev - 1 + tabs.length) % tabs.length);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setActiveTab((prev) => (prev + 1) % tabs.length);
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
        {tabs.map((t, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={activeTab === i}
            aria-controls={`sidebar-panel-${i}`}
            id={`sidebar-tab-${i}`}
            onClick={() => setActiveTab(i)}
            title={t.name}
            style={{
              width: 36,
              height: 36,
              marginBottom: 8,
              borderRadius: 8,
              background: activeTab === i ? "var(--app-border)" : "transparent",
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
        <div
          role="tabpanel"
          aria-labelledby="sidebar-tab-0"
          id="sidebar-panel-0"
          tabIndex={-1}
          style={{
            display: activeTab === 0 ? "block" : "none",
            height: "100%",
            outline: "none",
          }}
        >
          <WorkspacePanel
            isActive={activeTab === 0}
            activeTerminalId={activeTerminalId}
            onViewFile={onViewFile}
          />
        </div>
        <div
          role="tabpanel"
          aria-labelledby="sidebar-tab-1"
          id="sidebar-panel-1"
          tabIndex={-1}
          style={{
            display: activeTab === 1 ? "block" : "none",
            height: "100%",
            outline: "none",
          }}
        >
          <SystemMonitorPanel isActive={activeTab === 1} />
        </div>
        <div
          role="tabpanel"
          aria-labelledby="sidebar-tab-2"
          id="sidebar-panel-2"
          tabIndex={-1}
          style={{
            display: activeTab === 2 ? "block" : "none",
            height: "100%",
            outline: "none",
          }}
        >
          <PortMonitorPanel isActive={activeTab === 2} />
        </div>
        <div
          role="tabpanel"
          aria-labelledby="sidebar-tab-3"
          id="sidebar-panel-3"
          tabIndex={-1}
          style={{
            display: activeTab === 3 ? "block" : "none",
            height: "100%",
            outline: "none",
          }}
        >
          <ScriptRunnerPanel
            isActive={activeTab === 3}
            onRunScript={onRunScript}
          />
        </div>
        <div
          role="tabpanel"
          aria-labelledby="sidebar-tab-4"
          id="sidebar-panel-4"
          tabIndex={-1}
          style={{
            display: activeTab === 4 ? "block" : "none",
            height: "100%",
            outline: "none",
          }}
        >
          <SnippetLibraryPanel
            isActive={activeTab === 4}
            onInjectSnippet={onInjectSnippet}
          />
        </div>
        <div
          role="tabpanel"
          aria-labelledby="sidebar-tab-5"
          id="sidebar-panel-5"
          tabIndex={-1}
          style={{
            display: activeTab === 5 ? "block" : "none",
            height: "100%",
            outline: "none",
          }}
        >
          <ClipboardHistoryPanel
            isActive={activeTab === 5}
            onInjectSnippet={onInjectSnippet}
          />
        </div>
        <div
          role="tabpanel"
          aria-labelledby="sidebar-tab-6"
          id="sidebar-panel-6"
          tabIndex={-1}
          style={{
            display: activeTab === 6 ? "block" : "none",
            height: "100%",
            outline: "none",
          }}
        >
          <ConnectionsPanel
            isActive={activeTab === 6}
            onRunScript={onRunScript}
            onLaunchConnection={onLaunchConnection}
          />
        </div>
        <div
          role="tabpanel"
          aria-labelledby="sidebar-tab-7"
          id="sidebar-panel-7"
          tabIndex={-1}
          style={{
            display: activeTab === 7 ? "block" : "none",
            height: "100%",
            outline: "none",
          }}
        >
          <HistoryPanel
            isActive={activeTab === 7}
            onViewSession={onViewSession}
          />
        </div>
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
