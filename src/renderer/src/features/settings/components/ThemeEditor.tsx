import React, { useState } from "react";
import { useConfig } from "@/features/settings/useConfigStore";
import { builtinThemes } from "@/themes";

const ANSI_COLORS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite",
];

export const ThemeEditor: React.FC = () => {
  const { config, updateConfig } = useConfig();

  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [draftTheme, setDraftTheme] = useState<any>(null);
  const [newThemeName, setNewThemeName] = useState("");

  const allThemes = { ...builtinThemes, ...(config.customThemes || {}) };

  const startNewTheme = () => {
    const base = builtinThemes["catppuccin-mocha"];
    setDraftTheme({ ...base });
    setEditingThemeId("new");
    setNewThemeName("My Custom Theme");
  };

  const startEditTheme = (id: string) => {
    if (builtinThemes[id]) return; // Can't edit builtins directly, could clone them though
    setDraftTheme({
      ...(config.customThemes?.[id] || builtinThemes["catppuccin-mocha"]),
    });
    setEditingThemeId(id);
    setNewThemeName(
      id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    );
  };

  const saveTheme = () => {
    if (!newThemeName.trim()) {
      alert("Theme name is required.");
      return;
    }
    const themeId = newThemeName.trim().toLowerCase().replace(/\s+/g, "-");

    if (builtinThemes[themeId]) {
      alert(
        "A built-in theme already uses this name. Please choose a different name.",
      );
      return;
    }

    const updatedCustom = { ...(config.customThemes || {}) };

    if (
      editingThemeId &&
      editingThemeId !== "new" &&
      themeId !== editingThemeId
    ) {
      delete updatedCustom[editingThemeId];
    }

    updatedCustom[themeId] = draftTheme;

    updateConfig({
      customThemes: updatedCustom,
      theme: themeId,
    });

    setEditingThemeId(null);
    setDraftTheme(null);
  };

  const deleteTheme = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this custom theme?")) {
      const updatedCustom = { ...(config.customThemes || {}) };
      delete updatedCustom[id];
      updateConfig({
        customThemes: updatedCustom,
        theme: config.theme === id ? "catppuccin-mocha" : config.theme,
      });
    }
  };

  if (editingThemeId && draftTheme) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          height: 350,
          overflowY: "auto",
          paddingRight: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>
            {editingThemeId === "new" ? "Create Custom Theme" : "Edit Theme"}
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                setEditingThemeId(null);
                setDraftTheme(null);
              }}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "6px 12px",
                borderRadius: 6,
                color: "var(--app-fg)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveTheme}
              style={{
                background:
                  "color-mix(in srgb, var(--app-green) 15%, transparent)",
                border: "1px solid var(--app-green)",
                padding: "6px 12px",
                borderRadius: 6,
                color: "var(--app-green)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Save Theme
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "#bac2de" }}>Theme Name</label>
          <input
            type="text"
            value={newThemeName}
            onChange={(e) => setNewThemeName(e.target.value)}
            style={{
              background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "6px 10px",
              borderRadius: 6,
              color: "var(--app-fg)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {/* Core colors */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <h4
              style={{ margin: 0, fontSize: 13, color: "var(--app-fg-subtle)" }}
            >
              Core Colors
            </h4>
            {[
              "background",
              "foreground",
              "cursor",
              "cursorAccent",
              "selection",
            ].map((key) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--app-fg)",
                    textTransform: "capitalize",
                  }}
                >
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="color"
                    value={draftTheme[key]}
                    onChange={(e) =>
                      setDraftTheme({ ...draftTheme, [key]: e.target.value })
                    }
                    style={{
                      width: 24,
                      height: 24,
                      padding: 0,
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      background: "transparent",
                    }}
                  />
                  <input
                    type="text"
                    value={draftTheme[key]}
                    onChange={(e) =>
                      setDraftTheme({ ...draftTheme, [key]: e.target.value })
                    }
                    style={{
                      width: 70,
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "4px 6px",
                      borderRadius: 4,
                      color: "var(--app-fg)",
                      fontSize: 12,
                      outline: "none",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Terminal Preview */}
          <div
            style={{
              flex: 1,
              background: draftTheme.background,
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: 12,
              fontFamily: "monospace",
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ color: draftTheme.green }}>
              ➜ <span style={{ color: draftTheme.cyan }}>~</span>{" "}
              <span style={{ color: draftTheme.foreground }}>ls -la</span>
            </div>
            <div style={{ color: draftTheme.blue, fontWeight: "bold" }}>
              Desktop/
            </div>
            <div style={{ color: draftTheme.blue, fontWeight: "bold" }}>
              Downloads/
            </div>
            <div style={{ color: draftTheme.foreground }}>file.txt</div>
            <div style={{ color: draftTheme.green }}>
              ➜ <span style={{ color: draftTheme.cyan }}>~</span>{" "}
              <span style={{ color: draftTheme.foreground }}>
                echo &apos;Hello&apos;
              </span>
            </div>
            <div
              style={{ color: draftTheme.foreground, display: "inline-block" }}
            >
              Hello
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 14,
                  background: draftTheme.cursor,
                  verticalAlign: "middle",
                  marginLeft: 2,
                }}
              />
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 2 }}>
              {ANSI_COLORS.slice(0, 8).map((c) => (
                <div
                  key={c}
                  style={{
                    width: 12,
                    height: 12,
                    background: draftTheme[c],
                    borderRadius: 2,
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              {ANSI_COLORS.slice(8, 16).map((c) => (
                <div
                  key={c}
                  style={{
                    width: 12,
                    height: 12,
                    background: draftTheme[c],
                    borderRadius: 2,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <h4
            style={{
              margin: "0 0 8px 0",
              fontSize: 13,
              color: "var(--app-fg-subtle)",
            }}
          >
            ANSI Colors
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "8px 16px",
            }}
          >
            {ANSI_COLORS.map((key) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--app-fg)" }}>
                  {key.replace("bright", "Br.")}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="color"
                    value={draftTheme[key]}
                    onChange={(e) =>
                      setDraftTheme({ ...draftTheme, [key]: e.target.value })
                    }
                    style={{
                      width: 20,
                      height: 20,
                      padding: 0,
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      background: "transparent",
                    }}
                  />
                  <input
                    type="text"
                    value={draftTheme[key]}
                    onChange={(e) =>
                      setDraftTheme({ ...draftTheme, [key]: e.target.value })
                    }
                    style={{
                      width: 60,
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "2px 4px",
                      borderRadius: 4,
                      color: "var(--app-fg)",
                      fontSize: 11,
                      outline: "none",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: 350,
        overflowY: "auto",
        paddingRight: 8,
      }}
    >
      <button
        onClick={startNewTheme}
        style={{
          background: "color-mix(in srgb, var(--app-green) 15%, transparent)",
          border: "1px solid var(--app-green)",
          padding: "8px 12px",
          borderRadius: 6,
          color: "var(--app-green)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          alignSelf: "flex-start",
        }}
      >
        + Create Custom Theme
      </button>

      {Object.keys(allThemes).map((themeName) => {
        const isActive = config.theme === themeName;
        const isCustom = !!config.customThemes?.[themeName];
        const t = allThemes[themeName]!;

        return (
          <div
            key={themeName}
            onClick={() => updateConfig({ theme: themeName })}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: isActive
                ? "color-mix(in srgb, var(--app-blue) 15%, transparent)"
                : "rgba(0,0,0,0.2)",
              border: `1px solid ${isActive ? "var(--app-blue)" : "rgba(255,255,255,0.05)"}`,
              borderRadius: 8,
              color: "var(--app-fg)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontWeight: isActive ? 600 : 400,
                  textTransform: "capitalize",
                }}
              >
                {themeName.replace("-", " ")}
              </span>
              {isCustom && (
                <span
                  style={{
                    fontSize: 10,
                    background: "rgba(255,255,255,0.1)",
                    padding: "2px 6px",
                    borderRadius: 10,
                  }}
                >
                  Custom
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 4 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: t.background,
                  }}
                />
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: t.foreground,
                  }}
                />
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: t.blue,
                  }}
                />
              </div>
              {isCustom && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditTheme(themeName);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--app-blue)",
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => deleteTheme(themeName, e)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--app-red)",
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
