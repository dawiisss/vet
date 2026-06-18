import { useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { useClipboardStore } from "@/features/clipboard/useClipboardStore";
import SearchOverlay from "@/shared/components/SearchOverlay";
import ContextMenu, {
  ContextMenuAction,
} from "@/shared/components/ContextMenu";
import { useTerminal } from "../hooks/useTerminal";

interface TerminalViewProps {
  terminalId: string;
  isActive: boolean;
  isFocused?: boolean | undefined;
  onExit?: ((terminalId: string) => void) | undefined;
  onFocus?: (() => void) | undefined;
  onExtract?: (() => void) | undefined;
  onContextMenuAction?: ((action: "split-h" | "split-v" | "close") => void) | undefined;
}

function TerminalView({
  terminalId,
  isActive,
  isFocused,
  onExit,
  onFocus,
  onExtract,
  onContextMenuAction,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { terminal, searchAddon } = useTerminal({
    terminalId,
    isActive,
    isFocused,
    containerRef,
    onExit,
    onFocus,
    isSearchOpen,
    setIsSearchOpen,
  });

  const handleSearch = (
    text: string,
    options: {
      caseSensitive: boolean;
      useRegex: boolean;
      wholeWord: boolean;
      backwards?: boolean;
    },
  ) => {
    if (!searchAddon) return;

    if (options.backwards) {
      searchAddon.findPrevious(text, {
        caseSensitive: options.caseSensitive,
        regex: options.useRegex,
        wholeWord: options.wholeWord,
      });
    } else {
      searchAddon.findNext(text, {
        caseSensitive: options.caseSensitive,
        regex: options.useRegex,
        wholeWord: options.wholeWord,
      });
    }
  };

  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
  }>({ isOpen: false, x: 0, y: 0 });

  const contextMenuActions: ContextMenuAction[] = [
    {
      id: "copy",
      label: "Copy",
      shortcut: "Ctrl+Shift+C",
      onExecute: () => {
        const sel = terminal?.getSelection();
        if (sel) {
          navigator.clipboard.writeText(sel).catch(() => {});
          useClipboardStore.getState().add(sel);
        }
      },
    },
    {
      id: "paste",
      label: "Paste",
      shortcut: "Ctrl+Shift+V",
      onExecute: () => {
        navigator.clipboard
          .readText()
          .then((text) => window.terminalApi?.write(terminalId, text))
          .catch(() => {});
      },
    },
    {
      id: "clear",
      label: "Clear Screen",
      separator: true,
      onExecute: () => {
        terminal?.clear();
      },
    },
    {
      id: "split-h",
      label: "Split Horizontal",
      separator: true,
      onExecute: () => onContextMenuAction?.("split-h"),
    },
    {
      id: "split-v",
      label: "Split Vertical",
      onExecute: () => onContextMenuAction?.("split-v"),
    },
    {
      id: "close",
      label: "Close Pane",
      separator: true,
      onExecute: () => onContextMenuAction?.("close"),
    },
  ];

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenuState({ isOpen: true, x: e.clientX, y: e.clientY });
      }}
    >
      <div
        ref={containerRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          outline: isFocused ? "2px solid var(--app-accent)" : "none",
          outlineOffset: -2,
        }}
      />
      {isActive && isSearchOpen && (
        <SearchOverlay
          onSearch={handleSearch}
          onClose={() => {
            setIsSearchOpen(false);
            terminal?.focus();
          }}
        />
      )}
      {isActive && onExtract && (
        <button
          className="extract-btn"
          onClick={onExtract}
          title="Extract to new tab (Ctrl+Shift+E)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M10 14L21 3" />
            <path d="M15 3h6v6" />
            <path d="M14 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h11" />
          </svg>
        </button>
      )}
      <ContextMenu
        isOpen={contextMenuState.isOpen}
        x={contextMenuState.x}
        y={contextMenuState.y}
        onClose={() =>
          setContextMenuState((prev) => ({ ...prev, isOpen: false }))
        }
        actions={contextMenuActions}
      />
    </div>
  );
}

export default TerminalView;
