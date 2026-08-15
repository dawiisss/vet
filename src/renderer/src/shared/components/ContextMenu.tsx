import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuAction {
  id: string;
  label: string;
  shortcut?: string;
  onExecute: () => void;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  actions: ContextMenuAction[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isOpen,
  onClose,
  actions,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const menuInstanceId = useRef(`ctx-${Math.random().toString(36).slice(2)}`);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: y,
    left: x,
  });

  useLayoutEffect(() => {
    if (!isOpen) return;

    const el = menuRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let posX = x;
    let posY = y;

    // Check horizontal overflow: flip to the left if overflowing right edge
    if (x + rect.width + margin > viewportWidth) {
      posX = Math.max(margin, x - rect.width);
      if (posX + rect.width + margin > viewportWidth) {
        posX = Math.max(margin, viewportWidth - rect.width - margin);
      }
    }

    // Check vertical overflow: flip upwards if overflowing bottom edge
    if (y + rect.height + margin > viewportHeight) {
      posY = Math.max(margin, y - rect.height);
      if (posY + rect.height + margin > viewportHeight) {
        posY = Math.max(margin, viewportHeight - rect.height - margin);
      }
    }

    setCoords({
      top: Math.max(margin, posY),
      left: Math.max(margin, posX),
    });
  }, [isOpen, x, y, actions]);

  useEffect(() => {
    if (!isOpen) return;

    const currentId = menuInstanceId.current;

    // Broadcast mutual exclusion event to close any other existing context menu
    window.dispatchEvent(
      new CustomEvent("vet:close-context-menus", {
        detail: { senderId: currentId },
      }),
    );

    const handleCloseOthers = (e: Event) => {
      const customEvent = e as CustomEvent<{ senderId?: string }>;
      if (customEvent.detail && customEvent.detail.senderId !== currentId) {
        onClose();
      }
    };

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleResize = () => onClose();

    window.addEventListener("vet:close-context-menus", handleCloseOthers);
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("mousedown", handlePointerDown, true);
    window.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("vet:close-context-menus", handleCloseOthers);
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("mousedown", handlePointerDown, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="app-scrollbar"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        minWidth: 220,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "calc(100vh - 16px)",
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: "color-mix(in srgb, var(--app-bg, #1e1e2e) 95%, transparent)",
        border: "1px solid var(--app-border, #313244)",
        borderRadius: 8,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        padding: "6px 0",
        zIndex: 99999,
        backdropFilter: "blur(12px)",
        color: "var(--app-fg, #cdd6f4)",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((action, index) => (
        <React.Fragment key={action.id}>
          {action.separator && index !== 0 && (
            <div
              style={{
                height: 1,
                background: "var(--app-border, #313244)",
                margin: "4px 0",
              }}
            />
          )}
          <div
            onClick={() => {
              action.onExecute();
              onClose();
            }}
            style={{
              padding: "6px 16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              transition: "background 0.1s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "color-mix(in srgb, var(--app-accent, #89b4fa) 15%, transparent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {action.label}
            </span>
            {action.shortcut && (
              <span
                style={{
                  color: "var(--app-fg-muted, #a6adc8)",
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                {action.shortcut}
              </span>
            )}
          </div>
        </React.Fragment>
      ))}
    </div>,
    document.body,
  );
};

export default ContextMenu;
