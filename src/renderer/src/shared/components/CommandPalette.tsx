import React, { useEffect, useRef } from "react";
import { ModalOverlay } from "@/shared/components/ModalOverlay";
import { useSearchableList } from "@/shared/hooks/useSearchableList";

export interface CommandAction {
  id: string;
  label: string;
  onExecute: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  actions,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    filteredItems: filteredActions,
    handleKeyDown: handleHookKeyDown,
    listRef,
  } = useSearchableList<CommandAction>({
    items: actions,
    filterFn: (action, q) =>
      action.label.toLowerCase().includes(q.toLowerCase()),
    onSelect: (action) => {
      action.onExecute();
      onClose();
    },
    isOpen,
  });

  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      e.stopPropagation();
    } else {
      handleHookKeyDown(e);
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
          width: 600,
          backgroundColor: "color-mix(in srgb, var(--app-bg) 95%, transparent)",
          border: "1px solid var(--app-border)",
          borderRadius: 8,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          backdropFilter: "blur(12px)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a command..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--app-border)",
            color: "var(--app-fg)",
            padding: "16px 20px",
            fontSize: 16,
            outline: "none",
            width: "100%",
          }}
        />
        <div
          ref={listRef}
          className="no-scrollbar"
          style={{ maxHeight: 300, overflowY: "auto" }}
        >
          {filteredActions.map((action, index) => (
            <div
              key={action.id}
              onClick={() => {
                action.onExecute();
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                padding: "12px 20px",
                color:
                  index === selectedIndex
                    ? "var(--app-fg)"
                    : "var(--app-fg-subtle)",
                background:
                  index === selectedIndex
                    ? "color-mix(in srgb, var(--app-accent) 15%, transparent)"
                    : "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                borderLeft:
                  index === selectedIndex
                    ? "3px solid var(--app-accent)"
                    : "3px solid transparent",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.7 }}
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              {action.label}
            </div>
          ))}
          {filteredActions.length === 0 && (
            <div
              style={{
                padding: "20px",
                color: "var(--app-fg-muted)",
                textAlign: "center",
              }}
            >
              No commands found.
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
};

export default CommandPalette;
