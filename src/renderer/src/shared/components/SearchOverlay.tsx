import React, { useState, useRef, useEffect } from "react";
import { useConfig } from "@/features/settings/useConfigStore";
import { buildShortcutString } from "@/shared/utils/keybindings";

interface SearchOverlayProps {
  onSearch: (
    text: string,
    options: {
      caseSensitive: boolean;
      useRegex: boolean;
      wholeWord: boolean;
      backwards?: boolean;
    },
  ) => void;
  onClose: () => void;
  matchesInfo?: { active: number; total: number };
  hideRegex?: boolean;
  hideWholeWord?: boolean;
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({
  onSearch,
  onClose,
  matchesInfo,
  hideRegex,
  hideWholeWord,
}) => {
  const [searchText, setSearchText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const { config } = useConfig();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const shortcut = buildShortcutString(e);
    if (
      shortcut &&
      config.keybindings &&
      config.keybindings[shortcut] === "terminal:search"
    ) {
      onClose();
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    if (e.key === "Escape") {
      onClose();
      e.stopPropagation();
    } else if (e.key === "Enter") {
      const backwards = e.shiftKey;
      onSearch(searchText, { caseSensitive, useRegex, wholeWord, backwards });
      e.stopPropagation();
    }
  };

  const triggerSearch = (backwards = false) => {
    onSearch(searchText, { caseSensitive, useRegex, wholeWord, backwards });
  };

  const btnStyle = (active: boolean) => ({
    background: active
      ? "color-mix(in srgb, var(--app-accent) 20%, transparent)"
      : "transparent",
    color: active ? "var(--app-accent)" : "var(--app-fg-subtle)",
    border: "none",
    padding: "4px",
    borderRadius: "4px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.1s",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        background: "color-mix(in srgb, var(--app-bg) 95%, transparent)",
        border: "1px solid var(--app-border)",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        padding: "6px 8px",
        gap: 8,
        zIndex: 100,
        backdropFilter: "blur(8px)",
        color: "var(--app-fg)",
        fontFamily: "system-ui, sans-serif",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Find..."
        value={searchText}
        onChange={(e) => {
          setSearchText(e.target.value);
          onSearch(e.target.value, {
            caseSensitive,
            useRegex,
            wholeWord,
            backwards: false,
          });
        }}
        onKeyDown={handleKeyDown}
        style={{
          background: "rgba(0,0,0,0.2)",
          border: "1px solid var(--app-border)",
          color: "var(--app-fg)",
          padding: "4px 8px",
          borderRadius: 4,
          outline: "none",
          width: 180,
          fontSize: 13,
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 2,
          background: "rgba(0,0,0,0.2)",
          borderRadius: 4,
          padding: 2,
        }}
      >
        <button
          title="Match Case"
          style={btnStyle(caseSensitive)}
          onClick={() => {
            setCaseSensitive(!caseSensitive);
            onSearch(searchText, {
              caseSensitive: !caseSensitive,
              useRegex,
              wholeWord,
            });
          }}
        >
          Aa
        </button>
        {!hideWholeWord && (
          <button
            title="Match Whole Word"
            style={btnStyle(wholeWord)}
            onClick={() => {
              setWholeWord(!wholeWord);
              onSearch(searchText, {
                caseSensitive,
                useRegex,
                wholeWord: !wholeWord,
              });
            }}
          >
            _
          </button>
        )}
        {!hideRegex && (
          <button
            title="Use Regular Expression"
            style={btnStyle(useRegex)}
            onClick={() => {
              setUseRegex(!useRegex);
              onSearch(searchText, {
                caseSensitive,
                useRegex: !useRegex,
                wholeWord,
              });
            }}
          >
            .*
          </button>
        )}
      </div>

      {matchesInfo && (
        <span
          style={{
            fontSize: 11,
            color: "var(--app-fg-muted)",
            minWidth: 40,
            textAlign: "center",
            fontFamily: "monospace",
            padding: "0 4px",
          }}
        >
          {matchesInfo.total > 0
            ? `${matchesInfo.active}/${matchesInfo.total}`
            : "0/0"}
        </span>
      )}

      <div
        style={{
          width: 1,
          height: 16,
          background: "var(--app-border)",
          margin: "0 4px",
        }}
      />

      <div style={{ display: "flex", gap: 2 }}>
        <button
          title="Previous Match (Shift+Enter)"
          style={btnStyle(false)}
          onClick={() => triggerSearch(true)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        <button
          title="Next Match (Enter)"
          style={btnStyle(false)}
          onClick={() => triggerSearch(false)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      <button
        title="Close (Escape)"
        style={{ ...btnStyle(false), marginLeft: 4 }}
        onClick={onClose}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
};

export default SearchOverlay;
