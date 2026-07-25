import React, { useEffect, useRef, useState, useMemo } from "react";
import { ModalOverlay } from "@/shared/components/ModalOverlay";
import { useUIStore } from "@/shared/stores/useUIStore";

export interface CommandAction {
  id: string;
  label: string;
  onExecute: () => void;
  category?: string;
}

export interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  type: "command" | "file";
  onExecute: () => void;
  filePath?: string;
  line?: number;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
  initialMode?: "files" | "commands";
}

const RECENT_KEY = "vet_recent_command_palette_v1";

function fuzzyMatchScore(text: string, query: string): number {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;
  let qIdx = 0;
  let consecutive = 0;

  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      score += 10 + consecutive * 5;
      if (i === 0 || t[i - 1] === "/" || t[i - 1] === "_" || t[i - 1] === "-") {
        score += 15;
      }
      consecutive++;
      qIdx++;
    } else {
      consecutive = 0;
    }
  }

  return qIdx === q.length ? score : 0;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  actions,
  initialMode,
}) => {
  const storeMode = useUIStore((s) => s.commandPaletteInitialMode);
  const [mode, setMode] = useState<"files" | "commands">(initialMode || storeMode || "files");
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<Array<{ relativePath: string; absolutePath: string }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Synchronize mode when palette opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || storeMode || "files");
      setQuery("");
      setSelectedIndex(0);
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }
  }, [isOpen, initialMode, storeMode]);

  // Load files from workspace when opening or in files mode
  useEffect(() => {
    let active = true;
    if (isOpen && window.workspaceApi?.searchFiles) {
      window.workspaceApi
        .searchFiles("", "")
        .then((res) => {
          if (active) setFiles(res || []);
        })
        .catch(() => {
          if (active) setFiles([]);
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Auto-switch mode based on query prefix
  const activeMode = useMemo(() => {
    if (query.startsWith(">")) return "commands";
    return mode;
  }, [query, mode]);

  // Parse line number if typed like "filename.ts:42" or ":42"
  const { cleanQuery, targetLine } = useMemo(() => {
    let q = query;
    if (q.startsWith(">")) q = q.slice(1).trim();

    const match = q.match(/^(.*?)(?::(\d+))?$/);
    if (match && match[2]) {
      return {
        cleanQuery: (match[1] ?? "").trim(),
        targetLine: parseInt(match[2], 10),
      };
    }
    return { cleanQuery: q.trim(), targetLine: undefined };
  }, [query]);

  // Generate combined filtered items
  const filteredItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];

    const recordRecent = (id: string) => {
      try {
        const next = [id, ...recentIds.filter((x) => x !== id)].slice(0, 15);
        setRecentIds(next);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch { /* intentional ignore */ }
    };

    if (activeMode === "commands") {
      const scored = actions
        .map((action) => {
          const score = fuzzyMatchScore(action.label, cleanQuery);
          return { action, score };
        })
        .filter((x) => x.score > 0);

      scored.sort((a, b) => {
        const aRecent = recentIds.indexOf(a.action.id);
        const bRecent = recentIds.indexOf(b.action.id);
        if (!cleanQuery && aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;
        if (!cleanQuery && aRecent !== -1) return -1;
        if (!cleanQuery && bRecent !== -1) return 1;
        return b.score - a.score;
      });

      for (const { action } of scored) {
        items.push({
          id: action.id,
          label: action.label,
          type: "command",
          onExecute: () => {
            recordRecent(action.id);
            action.onExecute();
          },
        });
      }
    } else {
      // Files mode
      const scored = files
        .map((file) => {
          const score = fuzzyMatchScore(file.relativePath, cleanQuery);
          return { file, score };
        })
        .filter((x) => x.score > 0);

      scored.sort((a, b) => {
        const aRecent = recentIds.indexOf(a.file.absolutePath);
        const bRecent = recentIds.indexOf(b.file.absolutePath);
        if (!cleanQuery && aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;
        if (!cleanQuery && aRecent !== -1) return -1;
        if (!cleanQuery && bRecent !== -1) return 1;
        return b.score - a.score;
      });

      for (const { file } of scored) {
        const fileName = file.relativePath.split("/").pop() || file.relativePath;
        const dir = file.relativePath.substring(0, file.relativePath.length - fileName.length);
        const fileId = file.absolutePath;

        items.push({
          id: fileId,
          label: fileName + (targetLine ? `:${targetLine}` : ""),
          sublabel: dir || "./",
          type: "file",
          filePath: file.absolutePath,
          ...(targetLine !== undefined && { line: targetLine }),
          onExecute: () => {
            recordRecent(fileId);
            window.dispatchEvent(
              new CustomEvent("vet:open-editor", {
                detail: {
                  filePath: file.absolutePath,
                  line: targetLine,
                },
              })
            );
          },
        });
      }
    }

    return items.slice(0, 50);
  }, [activeMode, actions, files, cleanQuery, targetLine, recentIds]);

  // Keep selection within bounds when query or mode changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeMode]);

  // Scroll selected item into view automatically when navigating with keys
  useEffect(() => {
    if (listRef.current && filteredItems.length > 0) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl && typeof selectedEl.scrollIntoView === "function") {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, filteredItems.length]);

  if (!isOpen) return null;

  const handleSelectItem = (item: PaletteItem) => {
    item.onExecute();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      e.stopPropagation();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        handleSelectItem(selected);
      }
    }
  };

  return (
    <ModalOverlay
      containerRef={containerRef}
      onClose={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      style={{
        alignItems: "flex-start",
        paddingTop: "10vh",
        zIndex: 10000,
      }}
    >
      <div
        style={{
          width: 620,
          backgroundColor: "color-mix(in srgb, var(--app-bg) 95%, transparent)",
          border: "1px solid var(--app-border)",
          borderRadius: 8,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          backdropFilter: "blur(12px)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Mode Toggle Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 12px 0 12px",
            gap: 8,
            borderBottom: "1px solid var(--app-border)",
          }}
        >
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button
              onClick={() => {
                setMode("files");
                setQuery((q) => (q.startsWith(">") ? q.slice(1) : q));
              }}
              style={{
                background: activeMode === "files" ? "var(--app-accent)" : "transparent",
                color: activeMode === "files" ? "#fff" : "var(--app-fg-muted)",
                border: "none",
                borderRadius: 4,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📄 Files (Ctrl+P)
            </button>
            <button
              onClick={() => {
                setMode("commands");
                if (!query.startsWith(">")) setQuery(">" + query);
              }}
              style={{
                background: activeMode === "commands" ? "var(--app-accent)" : "transparent",
                color: activeMode === "commands" ? "#fff" : "var(--app-fg-muted)",
                border: "none",
                borderRadius: 4,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ⚡ Commands (&gt;)
            </button>
          </div>
        </div>

        {/* Input Bar */}
        <input
          ref={inputRef}
          type="text"
          placeholder={
            activeMode === "commands"
              ? "Type a command or action..."
              : "Search files by name (e.g. App.tsx:42)..."
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--app-border)",
            color: "var(--app-fg)",
            padding: "14px 18px",
            fontSize: 15,
            outline: "none",
            width: "100%",
          }}
        />

        {/* Search Results List */}
        <div
          ref={listRef}
          className="no-scrollbar"
          style={{ maxHeight: 340, overflowY: "auto" }}
        >
          {filteredItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={item.id}
                onClick={() => handleSelectItem(item)}
                onMouseMove={(e) => {
                  if (e.movementX !== 0 || e.movementY !== 0) {
                    setSelectedIndex(index);
                  }
                }}
                style={{
                  padding: "10px 18px",
                  color: isSelected ? "var(--app-fg)" : "var(--app-fg-subtle)",
                  background: isSelected
                    ? "color-mix(in srgb, var(--app-accent) 15%, transparent)"
                    : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderLeft: isSelected
                    ? "3px solid var(--app-accent)"
                    : "3px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 14, opacity: 0.8 }}>
                    {item.type === "file" ? "📄" : "⚡"}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400 }}>
                      {item.label}
                    </span>
                    {item.sublabel && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--app-fg-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                </div>

                {recentIds.includes(item.id) && !query && (
                  <span
                    style={{
                      fontSize: 10,
                      background: "rgba(255, 255, 255, 0.08)",
                      color: "var(--app-fg-muted)",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    Recent
                  </span>
                )}
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div
              style={{
                padding: "24px",
                color: "var(--app-fg-muted)",
                textAlign: "center",
                fontSize: 13,
              }}
            >
              {activeMode === "commands"
                ? "No matching commands found."
                : "No matching workspace files found."}
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
};

export default CommandPalette;
