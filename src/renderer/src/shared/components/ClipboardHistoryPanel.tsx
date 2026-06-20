import { useEffect, useRef } from "react";
import { useClipboardStore } from "@/features/clipboard/useClipboardStore";
import { useUIStore } from "@/shared/stores/useUIStore";
import Panel from "./Panel";
import { useSearchableList } from "@/shared/hooks/useSearchableList";

export default function ClipboardHistoryPanel({
  isActive,
  onInjectSnippet,
}: {
  isActive: boolean;
  onInjectSnippet: (snippet: string) => void;
}) {
  const { history, remove, clear } = useClipboardStore();
  const setPreviewClipboardItem = useUIStore(
    (state) => state.setPreviewClipboardItem,
  );

  const containerRef = useRef<HTMLDivElement>(null);

  const {
    selectedIndex: keyboardIndex,
    setSelectedIndex: setKeyboardIndex,
    handleKeyDown: handleHookKeyDown,
    listRef,
  } = useSearchableList({
    items: history,
    filterFn: () => true, // Clipboard doesn't have a search bar currently
    onSelect: (item) => setPreviewClipboardItem(item),
    isOpen: isActive,
  });

  // Focus container when tab becomes active
  useEffect(() => {
    if (isActive && containerRef.current) {
      containerRef.current.focus();
      setKeyboardIndex(0);
    }
  }, [isActive]);

  // Format timestamp nicely
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (history.length === 0) return;

    if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
      // Only intercept when panel is focused and not inside an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      e.preventDefault();
      const item = history[keyboardIndex];
      if (item) {
        navigator.clipboard.writeText(item.text).catch(() => {});
      }
    } else {
      handleHookKeyDown(e);
    }
  };

  const headerActions = history.length > 0 ? (
    <button
      onClick={clear}
      aria-label="Clear all clipboard history"
      style={{
        background: "none",
        border: "none",
        color: "var(--app-red)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: "bold",
        outlineColor: "var(--app-red)",
      }}
      title="Clear All"
    >
      Clear All
    </button>
  ) : undefined;

  return (
    <Panel
      id="clipboard-panel"
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      title="Clipboard"
      headerActions={headerActions}
      hasScrollableBody={false}
    >

      <div ref={listRef} className="app-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
        {history.length === 0 && (
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
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            <p
              style={{
                margin: "0 0 4px 0",
                fontSize: 14,
                color: "var(--app-fg)",
              }}
            >
              Clipboard is empty
            </p>
            <p style={{ margin: 0, fontSize: 12 }}>
              Copied text will appear here
            </p>
          </div>
        )}
        {history.map((item, index) => {
          const isSel = keyboardIndex === index;
          return (
            <div
              key={item.id}
              data-active={isSel}
              onMouseEnter={() => setKeyboardIndex(index)}
              onClick={() => setKeyboardIndex(index)}
              style={{
                background: isSel
                  ? "color-mix(in srgb, var(--app-blue) 20%, transparent)"
                  : "var(--app-border)",
                border: "1px solid #45475a",
                borderRadius: 6,
                marginBottom: 8,
                overflow: "hidden",
                borderLeft: isSel
                  ? "2px solid var(--app-blue)"
                  : "2px solid transparent",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  padding: "6px 10px",
                  background: "var(--app-panel-bg)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 11, color: "var(--app-fg-muted)" }}>
                  {formatTime(item.timestamp)}
                </span>
                <div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onInjectSnippet(item.text);
                    }}
                    aria-label="Paste clipboard entry"
                    style={{
                      background: "var(--app-green)",
                      color: "var(--app-modal-bg)",
                      border: "none",
                      borderRadius: 4,
                      padding: "2px 8px",
                      cursor: "pointer",
                      fontSize: 11,
                      marginRight: 6,
                      fontWeight: "bold",
                      outlineColor: "var(--app-green)",
                    }}
                  >
                    Paste
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewClipboardItem(item);
                    }}
                    aria-label="Preview clipboard entry"
                    style={{
                      background:
                        "color-mix(in srgb, var(--app-blue) 15%, transparent)",
                      color: "var(--app-blue)",
                      border: "1px solid var(--app-blue)",
                      borderRadius: 4,
                      padding: "2px 8px",
                      cursor: "pointer",
                      fontSize: 11,
                      marginRight: 6,
                      fontWeight: "bold",
                      outlineColor: "var(--app-blue)",
                    }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(item.id);
                    }}
                    aria-label="Delete clipboard entry"
                    style={{
                      background: "none",
                      color: "var(--app-red)",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      outlineColor: "var(--app-red)",
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div
                className="app-scrollbar"
                style={{
                  padding: "6px 10px",
                  fontSize: 11,
                  color: "var(--app-fg-subtle)",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  maxHeight: 80,
                  overflowY: "auto",
                  wordBreak: "break-all",
                }}
              >
                {item.text}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
