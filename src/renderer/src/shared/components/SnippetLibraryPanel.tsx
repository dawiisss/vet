import { useState, useEffect } from "react";
import Panel from "./Panel";

export default function SnippetLibraryPanel({
  isActive,
  onInjectSnippet,
}: {
  isActive: boolean;
  onInjectSnippet: (snippet: string) => void;
}) {
  const [snippets, setSnippets] = useState<
    { id: string; name: string; code: string }[]
  >([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("vet:snippets");
    if (saved) {
      try {
        setSnippets(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveSnippets = (list: any[]) => {
    setSnippets(list);
    localStorage.setItem("vet:snippets", JSON.stringify(list));
  };

  const handleAdd = () => {
    if (!newName.trim() || !newCode.trim()) {
      setErrorMsg("Both Name and Command are required.");
      return;
    }
    const s = { id: Date.now().toString(), name: newName, code: newCode };
    saveSnippets([...snippets, s]);
    setNewName("");
    setNewCode("");
    setErrorMsg("");
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    saveSnippets(snippets.filter((s) => s.id !== id));
  };

  const headerActions = (
    <button
      onClick={() => setIsAdding(!isAdding)}
      aria-label={isAdding ? "Cancel adding snippet" : "Add new snippet"}
      style={{
        background: "none",
        border: "none",
        color: "var(--app-green)",
        cursor: "pointer",
        fontSize: 16,
        fontWeight: "bold",
        outlineColor: "var(--app-green)",
      }}
    >
      {isAdding ? "×" : "+"}
    </button>
  );

  return (
    <Panel
      title="Snippets"
      headerActions={headerActions}
      hasScrollableBody={false}
    >


      {isAdding && (
        <div
          style={{
            background: "var(--app-panel-bg)",
            padding: 8,
            borderRadius: 6,
            marginBottom: 12,
            border: "1px solid var(--app-border)",
          }}
        >
          <input
            placeholder="Snippet Name"
            aria-label="Snippet Name"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setErrorMsg("");
            }}
            style={{
              width: "100%",
              background: "var(--app-modal-bg)",
              border: "1px solid var(--app-border)",
              color: "var(--app-fg)",
              marginBottom: 8,
              borderRadius: 4,
              padding: "6px 8px",
              fontWeight: "bold",
              boxSizing: "border-box",
              outlineColor: "var(--app-blue)",
            }}
          />
          <textarea
            placeholder="Command..."
            aria-label="Snippet Command"
            value={newCode}
            onChange={(e) => {
              setNewCode(e.target.value);
              setErrorMsg("");
            }}
            style={{
              width: "100%",
              background: "var(--app-modal-bg)",
              border: "1px solid var(--app-border)",
              color: "var(--app-fg-subtle)",
              borderRadius: 4,
              padding: 6,
              minHeight: 60,
              resize: "vertical",
              fontFamily: "monospace",
              boxSizing: "border-box",
              outlineColor: "var(--app-blue)",
            }}
          />
          {errorMsg && (
            <div
              style={{ color: "var(--app-red)", fontSize: 11, marginTop: 4 }}
            >
              {errorMsg}
            </div>
          )}
          <button
            onClick={handleAdd}
            style={{
              width: "100%",
              background: "var(--app-blue)",
              color: "var(--app-modal-bg)",
              border: "none",
              borderRadius: 4,
              padding: "4px 0",
              marginTop: 8,
              cursor: "pointer",
              fontWeight: "bold",
              outlineColor: "var(--app-blue)",
            }}
          >
            Save Snippet
          </button>
        </div>
      )}

      <div className="app-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
        {snippets.length === 0 && !isAdding && (
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <p
              style={{
                margin: "0 0 4px 0",
                fontSize: 14,
                color: "var(--app-fg)",
              }}
            >
              No snippets yet
            </p>
            <p style={{ margin: 0, fontSize: 12 }}>
              Click + to save commands you use often
            </p>
          </div>
        )}
        {snippets.map((s) => (
          <div
            key={s.id}
            style={{
              background: "var(--app-border)",
              border: "1px solid #45475a",
              borderRadius: 6,
              marginBottom: 8,
              overflow: "hidden",
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
              <span style={{ fontWeight: "bold", color: "var(--app-yellow)" }}>
                {s.name}
              </span>
              <div>
                <button
                  onClick={() => onInjectSnippet(s.code)}
                  aria-label={`Inject snippet ${s.name}`}
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
                  Inject
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  aria-label={`Delete snippet ${s.name}`}
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
              }}
            >
              {s.code}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
