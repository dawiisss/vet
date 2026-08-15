import React, { useState, useRef, useEffect, useCallback } from "react";
import { useConfig } from "@/features/settings/useConfigStore";
import ContextMenu, { ContextMenuAction } from "./ContextMenu";
import SystemMonitorPanel from "./SystemMonitorPanel";
import PortMonitorPanel from "./PortMonitorPanel";
import ScriptRunnerPanel from "./ScriptRunnerPanel";
import SnippetLibraryPanel from "./SnippetLibraryPanel";
import ConnectionsPanel from "@/features/connections/components/ConnectionsPanel";
import WorkspacePanel from "@/features/workspace/components/WorkspacePanel";
import ProfilesPanel from "@/features/workspace/components/ProfilesPanel";
import HistoryPanel from "./HistoryPanel";
import ClipboardHistoryPanel from "./ClipboardHistoryPanel";
import SearchPanel from "./SearchPanel";
import GitPanel from "./GitPanel";
import DockerPanel from "@/features/connections/components/DockerPanel";

export interface SidebarPanelMetadata {
  key: string;
  name: string;
  icon: string;
}

export const SIDEBAR_PANELS: SidebarPanelMetadata[] = [
  { key: "workspace", name: "Workspace", icon: "📁" },
  { key: "search", name: "Search", icon: "🔍" },
  { key: "git", name: "Source Control", icon: "🔀" },
  { key: "profiles", name: "Profiles", icon: "🔖" },
  { key: "scripts", name: "Scripts", icon: "⚡" },
  { key: "docker", name: "Docker", icon: "🐳" },
  { key: "ports", name: "Ports", icon: "🔌" },
  { key: "system", name: "System", icon: "📊" },
  { key: "snippets", name: "Snippets", icon: "📋" },
  { key: "clipboard", name: "Clipboard", icon: "📑" },
  { key: "connections", name: "Connections", icon: "🌐" },
  { key: "history", name: "History", icon: "📜" },
];

export interface SidebarPanelDef extends SidebarPanelMetadata {
  id: number;
  render: (isActive: boolean) => React.ReactNode;
}

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
  onViewFile: (filePath: string, sshHostId?: string) => void;
  onLaunchConnection?: (id: string) => void;
  width?: number;
}) {
  const { config, updateConfig } = useConfig();
  const [activeTab, setActiveTab] = useState(0);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetKey?: string | undefined;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  const panelConfigs: SidebarPanelDef[] = [
    {
      id: 0,
      key: "workspace",
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
      key: "search",
      icon: "🔍",
      name: "Search",
      render: (isActive: boolean) => (
        <SearchPanel
          isActive={isActive}
          activeTerminalId={activeTerminalId}
          onViewFile={onViewFile}
        />
      ),
    },
    {
      id: 2,
      key: "git",
      icon: "🔀",
      name: "Source Control",
      render: (isActive: boolean) => (
        <GitPanel
          isActive={isActive}
          activeTerminalId={activeTerminalId}
          onViewFile={onViewFile}
        />
      ),
    },
    {
      id: 3,
      key: "profiles",
      icon: "🔖",
      name: "Profiles",
      render: (isActive: boolean) => <ProfilesPanel isActive={isActive} />,
    },
    {
      id: 4,
      key: "scripts",
      icon: "⚡",
      name: "Scripts",
      render: (isActive: boolean) => (
        <ScriptRunnerPanel isActive={isActive} onRunScript={onRunScript} />
      ),
    },
    {
      id: 5,
      key: "docker",
      icon: "🐳",
      name: "Docker",
      render: (isActive: boolean) => (
        <DockerPanel isActive={isActive} onRunScript={onRunScript} />
      ),
    },
    {
      id: 6,
      key: "ports",
      icon: "🔌",
      name: "Ports",
      render: (isActive: boolean) => <PortMonitorPanel isActive={isActive} />,
    },
    {
      id: 7,
      key: "system",
      icon: "📊",
      name: "System",
      render: (isActive: boolean) => <SystemMonitorPanel isActive={isActive} />,
    },
    {
      id: 8,
      key: "snippets",
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
      id: 9,
      key: "clipboard",
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
      id: 10,
      key: "connections",
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
      id: 11,
      key: "history",
      icon: "📜",
      name: "History",
      render: (isActive: boolean) => (
        <HistoryPanel isActive={isActive} onViewSession={onViewSession} />
      ),
    },
  ];

  const disabledPanels = config.disabledSidebarPanels || [];
  const panelOrder = config.sidebarPanelsOrder || SIDEBAR_PANELS.map((p) => p.key);

  // Sort panels according to configured order
  const sortedPanels = [...panelConfigs].sort((a, b) => {
    const indexA = panelOrder.indexOf(a.key);
    const indexB = panelOrder.indexOf(b.key);
    const posA = indexA === -1 ? 999 : indexA;
    const posB = indexB === -1 ? 999 : indexB;
    return posA - posB;
  });

  const visiblePanels = sortedPanels.filter((p) => !disabledPanels.includes(p.key));
  const activePanels = visiblePanels.length > 0 ? visiblePanels : [panelConfigs[0]!];

  // If activeTab is no longer among enabled panels, switch to the first enabled panel
  useEffect(() => {
    if (!activePanels.some((p) => p.id === activeTab)) {
      setActiveTab(activePanels[0]!.id);
    }
  }, [activePanels, activeTab]);

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

  const handleTabContextMenu = (e: React.MouseEvent, panelKey?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetKey: panelKey,
    });
  };

  const movePanel = (panelKey: string, direction: number | "top" | "bottom") => {
    const currentOrder = [...panelOrder];
    const fromIdx = currentOrder.indexOf(panelKey);
    if (fromIdx === -1) return;

    if (direction === "top") {
      currentOrder.splice(fromIdx, 1);
      currentOrder.unshift(panelKey);
    } else if (direction === "bottom") {
      currentOrder.splice(fromIdx, 1);
      currentOrder.push(panelKey);
    } else {
      const toIdx = fromIdx + direction;
      if (toIdx >= 0 && toIdx < currentOrder.length) {
        const [removed] = currentOrder.splice(fromIdx, 1);
        if (removed) {
          currentOrder.splice(toIdx, 0, removed);
        }
      }
    }
    updateConfig({ sidebarPanelsOrder: currentOrder });
  };

  const handleDrop = (targetKey: string) => {
    if (!draggedKey || draggedKey === targetKey) return;
    const currentOrder = [...panelOrder];
    const fromIdx = currentOrder.indexOf(draggedKey);
    const toIdx = currentOrder.indexOf(targetKey);
    if (fromIdx !== -1 && toIdx !== -1) {
      currentOrder.splice(fromIdx, 1);
      currentOrder.splice(toIdx, 0, draggedKey);
      updateConfig({ sidebarPanelsOrder: currentOrder });
    }
    setDraggedKey(null);
    setDragOverKey(null);
  };

  const contextMenuActions: ContextMenuAction[] = (() => {
    if (!contextMenu) return [];
    const actions: ContextMenuAction[] = [];

    if (contextMenu.targetKey) {
      const targetPanel = panelConfigs.find((p) => p.key === contextMenu.targetKey);
      if (targetPanel) {
        const isCurrentlyEnabled = !disabledPanels.includes(targetPanel.key);
        const currentActiveIdx = activePanels.findIndex((p) => p.key === targetPanel.key);

        actions.push({
          id: "toggle-target",
          label: isCurrentlyEnabled ? `Hide "${targetPanel.name}"` : `Show "${targetPanel.name}"`,
          onExecute: () => {
            if (isCurrentlyEnabled) {
              if (activePanels.length <= 1) return;
              updateConfig({ disabledSidebarPanels: [...disabledPanels, targetPanel.key] });
            } else {
              updateConfig({
                disabledSidebarPanels: disabledPanels.filter((k) => k !== targetPanel.key),
              });
            }
          },
        });

        if (isCurrentlyEnabled) {
          if (currentActiveIdx > 0) {
            actions.push({
              id: "move-up",
              label: "↑ Move Up",
              onExecute: () => movePanel(targetPanel.key, -1),
            });
            actions.push({
              id: "move-top",
              label: "⤒ Move to Top",
              onExecute: () => movePanel(targetPanel.key, "top"),
            });
          }
          if (currentActiveIdx < activePanels.length - 1) {
            actions.push({
              id: "move-down",
              label: "↓ Move Down",
              onExecute: () => movePanel(targetPanel.key, 1),
            });
            actions.push({
              id: "move-bottom",
              label: "⤓ Move to Bottom",
              onExecute: () => movePanel(targetPanel.key, "bottom"),
            });
          }
        }
      }
    }

    // List of all panel toggles (in current ordered sequence)
    sortedPanels.forEach((p, idx) => {
      const isEnabled = !disabledPanels.includes(p.key);
      actions.push({
        id: `panel-${p.key}`,
        label: `${isEnabled ? "✓ " : "    "}${p.icon}  ${p.name}`,
        separator: idx === 0 && Boolean(contextMenu.targetKey),
        onExecute: () => {
          if (isEnabled) {
            if (activePanels.length <= 1) return;
            updateConfig({ disabledSidebarPanels: [...disabledPanels, p.key] });
          } else {
            updateConfig({
              disabledSidebarPanels: disabledPanels.filter((k) => k !== p.key),
            });
          }
        },
      });
    });

    actions.push({
      id: "enable-all",
      label: "Show All Panels",
      separator: true,
      onExecute: () => updateConfig({ disabledSidebarPanels: [] }),
    });

    actions.push({
      id: "reset-order",
      label: "Reset Default Order",
      onExecute: () => updateConfig({ sidebarPanelsOrder: SIDEBAR_PANELS.map((p) => p.key) }),
    });

    return actions;
  })();

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

        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          const currentIndex = activePanels.findIndex((p) => p.id === activeTab);
          const nextIndex =
            currentIndex <= 0 ? activePanels.length - 1 : currentIndex - 1;
          setActiveTab(activePanels[nextIndex]!.id);
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          const currentIndex = activePanels.findIndex((p) => p.id === activeTab);
          const nextIndex =
            currentIndex === -1 || currentIndex >= activePanels.length - 1
              ? 0
              : currentIndex + 1;
          setActiveTab(activePanels[nextIndex]!.id);
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
        onContextMenu={(e) => handleTabContextMenu(e)}
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
        {activePanels.map((t) => {
          const isOver = dragOverKey === t.key;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              aria-controls={`sidebar-panel-${t.id}`}
              id={`sidebar-tab-${t.id}`}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", t.key);
                e.dataTransfer.effectAllowed = "move";
                setDraggedKey(t.key);
              }}
              onDragEnd={() => {
                setDraggedKey(null);
                setDragOverKey(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverKey !== t.key) {
                  setDragOverKey(t.key);
                }
              }}
              onDragLeave={() => {
                if (dragOverKey === t.key) {
                  setDragOverKey(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(t.key);
              }}
              onClick={() => setActiveTab(t.id)}
              onContextMenu={(e) => handleTabContextMenu(e, t.key)}
              title={`${t.name} (Drag to reorder, right-click to configure)`}
              style={{
                width: 36,
                height: 36,
                marginBottom: 8,
                borderRadius: 8,
                background:
                  activeTab === t.id
                    ? "var(--app-border)"
                    : isOver
                    ? "color-mix(in srgb, var(--app-accent, #89b4fa) 30%, transparent)"
                    : "transparent",
                border: isOver
                  ? "2px dashed var(--app-accent, #89b4fa)"
                  : "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                opacity: draggedKey === t.key ? 0.4 : 1,
                transition: "background 0.2s, border 0.15s, opacity 0.2s",
              }}
            >
              {t.icon}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {activePanels.map((panel) => (
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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={Boolean(contextMenu)}
          onClose={() => setContextMenu(null)}
          actions={contextMenuActions}
        />
      )}
    </div>
  );
}
