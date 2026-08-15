import React, { useState, useRef, useEffect, useCallback } from "react";
import Panel from "./Panel";

export default function SearchPanel({
  isActive,
  activeTerminalId,
  onViewFile,
}: {
  isActive: boolean;
  activeTerminalId?: string | null | undefined;
  onViewFile?: ((filePath: string) => void) | undefined;
}) {
  const [query, setQuery] = useState("");
  const [filePattern, setFilePattern] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [showPatternInput, setShowPatternInput] = useState(false);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FileContentMatch[]>([]);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const [cwd, setCwd] = useState<string>("");
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch CWD from active terminal
  useEffect(() => {
    if (!isActive || !activeTerminalId) return;
    window.terminalApi
      ?.getTerminalInfo(activeTerminalId)
      .then((info) => {
        if (info?.cwd) setCwd(info.cwd);
      })
      .catch(() => {});
  }, [isActive, activeTerminalId]);

  // Focus input when tab activates
  useEffect(() => {
    if (isActive) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isActive]);

  const executeSearch = useCallback(
    async (q: string, pat: string, cs: boolean, ww: boolean, rx: boolean) => {
      if (!q || q.trim() === "") {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const matches = await window.workspaceApi.searchFileContents(
          cwd,
          q,
          {
            caseSensitive: cs,
            wholeWord: ww,
            isRegex: rx,
            filePattern: pat || undefined,
            maxResults: 300,
          },
        );
        setResults(matches || []);
        setSelectedIdx(matches && matches.length > 0 ? 0 : -1);
      } catch (err) {
        console.error("Search failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [cwd],
  );

  const triggerSearch = useCallback(
    (newQuery?: string) => {
      const q = newQuery !== undefined ? newQuery : query;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        executeSearch(q, filePattern, caseSensitive, wholeWord, isRegex);
      }, 250);
    },
    [query, filePattern, caseSensitive, wholeWord, isRegex, executeSearch],
  );

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    triggerSearch(val);
  };

  const handleOpenMatch = (match: FileContentMatch) => {
    const targetPath = `${match.filePath}#L${match.line}`;
    if (onViewFile) {
      onViewFile(targetPath);
    } else {
      window.dispatchEvent(
        new CustomEvent("vet:open-editor", {
          detail: {
            filePath: targetPath,
            line: match.line,
            col: match.column,
            sshHostId: null,
          },
        }),
      );
    }
  };

  const toggleFileCollapse = (filePath: string) => {
    setCollapsedFiles((prev) => ({
      ...prev,
      [filePath]: !prev[filePath],
    }));
  };

  // Group results by file
  const groupedResults = results.reduce<Record<string, { relativePath: string; matches: FileContentMatch[] }>>(
    (acc, m) => {
      if (!acc[m.filePath]) {
        acc[m.filePath] = { relativePath: m.relativePath, matches: [] };
      }
      acc[m.filePath]!.matches.push(m);
      return acc;
    },
    {},
  );

  const fileEntries = Object.entries(groupedResults);
  const totalMatches = results.length;
  const totalFiles = fileEntries.length;

  const allCollapsed = fileEntries.length > 0 && fileEntries.every(([p]) => !!collapsedFiles[p]);

  const toggleCollapseAll = () => {
    if (allCollapsed) {
      setCollapsedFiles({});
    } else {
      const next: Record<string, boolean> = {};
      fileEntries.forEach(([p]) => {
        next[p] = true;
      });
      setCollapsedFiles(next);
    }
  };

  // Flatten matches for keyboard navigation
  const flatMatches: FileContentMatch[] = [];
  fileEntries.forEach(([filePath, group]) => {
    if (!collapsedFiles[filePath]) {
      flatMatches.push(...group.matches);
    }
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flatMatches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, flatMatches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIdx >= 0 && selectedIdx < flatMatches.length) {
      e.preventDefault();
      handleOpenMatch(flatMatches[selectedIdx]!);
    }
  };

  return (
    <Panel
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      title="Find in Files"
      hasScrollableBody={false}
      headerActions={
        totalFiles > 0 ? (
          <button
            onClick={toggleCollapseAll}
            title={allCollapsed ? "Expand All" : "Collapse All"}
            style={{
              background: "none",
              border: "none",
              color: "var(--app-fg-subtle, #6c7086)",
              cursor: "pointer",
              fontSize: 11,
              padding: "2px 4px",
            }}
          >
            {allCollapsed ? "⊞ Expand" : "⊟ Collapse"}
          </button>
        ) : undefined
      }
    >
      {/* Top Search Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8, flexShrink: 0 }}>
        {/* Search Bar + Toggle Options */}
        <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search files..."
            style={{
              width: "100%",
              padding: "6px 75px 6px 10px",
              background: "var(--app-bg-surface, #1e1e2e)",
              border: "1px solid var(--app-border, #313244)",
              borderRadius: 6,
              color: "var(--app-fg, #cdd6f4)",
              fontSize: 12,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 6,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <button
              onClick={() => {
                const next = !caseSensitive;
                setCaseSensitive(next);
                executeSearch(query, filePattern, next, wholeWord, isRegex);
              }}
              title="Match Case (Aa)"
              style={{
                background: caseSensitive ? "var(--app-accent, #89b4fa)" : "transparent",
                color: caseSensitive ? "#11111b" : "var(--app-fg-muted, #a6adc8)",
                border: "none",
                borderRadius: 3,
                fontSize: 11,
                fontWeight: "bold",
                padding: "2px 4px",
                cursor: "pointer",
              }}
            >
              Aa
            </button>
            <button
              onClick={() => {
                const next = !wholeWord;
                setWholeWord(next);
                executeSearch(query, filePattern, caseSensitive, next, isRegex);
              }}
              title="Match Whole Word (ab)"
              style={{
                background: wholeWord ? "var(--app-accent, #89b4fa)" : "transparent",
                color: wholeWord ? "#11111b" : "var(--app-fg-muted, #a6adc8)",
                border: "none",
                borderRadius: 3,
                fontSize: 11,
                fontWeight: "bold",
                padding: "2px 4px",
                cursor: "pointer",
              }}
            >
              \b
            </button>
            <button
              onClick={() => {
                const next = !isRegex;
                setIsRegex(next);
                executeSearch(query, filePattern, caseSensitive, wholeWord, next);
              }}
              title="Use Regular Expression (.*)"
              style={{
                background: isRegex ? "var(--app-accent, #89b4fa)" : "transparent",
                color: isRegex ? "#11111b" : "var(--app-fg-muted, #a6adc8)",
                border: "none",
                borderRadius: 3,
                fontSize: 11,
                fontWeight: "bold",
                padding: "2px 4px",
                cursor: "pointer",
              }}
            >
              .*
            </button>
          </div>
        </div>

        {/* Toggle File Filter Pattern */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => setShowPatternInput(!showPatternInput)}
            style={{
              background: "none",
              border: "none",
              color: "var(--app-fg-subtle, #6c7086)",
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>{showPatternInput ? "▾" : "▸"}</span>
            <span>files to include / filter</span>
          </button>
          {loading && (
            <span style={{ fontSize: 11, color: "var(--app-accent, #89b4fa)" }}>
              Searching...
            </span>
          )}
        </div>

        {showPatternInput && (
          <input
            type="text"
            value={filePattern}
            onChange={(e) => {
              const pat = e.target.value;
              setFilePattern(pat);
              if (query) executeSearch(query, pat, caseSensitive, wholeWord, isRegex);
            }}
            placeholder="e.g. *.ts, src/components"
            style={{
              width: "100%",
              padding: "4px 8px",
              background: "var(--app-bg-surface, #1e1e2e)",
              border: "1px solid var(--app-border, #313244)",
              borderRadius: 4,
              color: "var(--app-fg, #cdd6f4)",
              fontSize: 11,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        )}

        {/* Results summary */}
        {query.trim() !== "" && !loading && (
          <div
            style={{
              fontSize: 11,
              color: "var(--app-fg-muted, #a6adc8)",
              borderBottom: "1px solid var(--app-border, #313244)",
              paddingBottom: 6,
            }}
          >
            {totalMatches > 0
              ? `${totalMatches} ${totalMatches === 1 ? "match" : "matches"} in ${totalFiles} ${totalFiles === 1 ? "file" : "files"}`
              : "No results found."}
          </div>
        )}
      </div>

      {/* Results List */}
      <div
        className="app-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {fileEntries.map(([filePath, group]) => {
          const isExpanded = !collapsedFiles[filePath];
          const fileName = filePath.split("/").pop() || filePath;
          const parentDir = group.relativePath.split("/").slice(0, -1).join("/");

          return (
            <div
              key={filePath}
              style={{
                flexShrink: 0,
                background: "var(--app-bg-surface, #1e1e2e)",
                borderRadius: 6,
                border: "1px solid var(--app-border, #313244)",
                overflow: "hidden",
              }}
            >
              {/* File Header */}
              <div
                onClick={() => toggleFileCollapse(filePath)}
                style={{
                  padding: "6px 8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  background: "rgba(255, 255, 255, 0.03)",
                  userSelect: "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  <span style={{ fontSize: 10, color: "var(--app-fg-subtle, #6c7086)", flexShrink: 0 }}>
                    {isExpanded ? "▼" : "▶"}
                  </span>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>📄</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--app-fg, #cdd6f4)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fileName}
                  </span>
                  {parentDir && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--app-fg-subtle, #6c7086)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {parentDir}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: "var(--app-border, #313244)",
                    color: "var(--app-fg-muted, #a6adc8)",
                    fontWeight: 600,
                    flexShrink: 0,
                    marginLeft: 6,
                  }}
                >
                  {group.matches.length}
                </span>
              </div>

              {/* Matches in File */}
              {isExpanded && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {group.matches.map((m) => {
                    const matchIndexInFlat = flatMatches.indexOf(m);
                    const isSelected = matchIndexInFlat === selectedIdx;

                    return (
                      <div
                        key={`${m.filePath}-${m.line}-${m.column}`}
                        onClick={() => {
                          setSelectedIdx(matchIndexInFlat);
                          handleOpenMatch(m);
                        }}
                        style={{
                          flexShrink: 0,
                          padding: "4px 8px 4px 24px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "baseline",
                          gap: 8,
                          fontSize: 11,
                          fontFamily: "monospace",
                          background: isSelected
                            ? "var(--app-surface-selected, rgba(137, 180, 250, 0.15))"
                            : "transparent",
                          borderLeft: isSelected
                            ? "2px solid var(--app-accent, #89b4fa)"
                            : "2px solid transparent",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--app-accent, #89b4fa)",
                            fontSize: 10,
                            minWidth: 28,
                            textAlign: "right",
                            flexShrink: 0,
                            userSelect: "none",
                          }}
                        >
                          {m.line}
                        </span>
                        <span
                          style={{
                            color: "var(--app-fg, #cdd6f4)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.lineContent}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
