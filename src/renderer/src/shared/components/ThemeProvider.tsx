import React, { useEffect } from "react";
import { useConfig } from "@/features/settings/useConfigStore";
import { resolveTheme } from "@/themes";

/**
 * Component to wrap the application and inject theme custom properties as CSS variables.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { config } = useConfig();
  const themeObj = resolveTheme(config.theme, config.customThemes);

  useEffect(() => {
    const body = document.body;
    body.style.setProperty("--app-bg", themeObj.background || "");
    body.style.setProperty("--app-fg", themeObj.foreground || "");
    body.style.setProperty(
      "--app-border",
      themeObj.selection || "rgba(255,255,255,0.1)",
    );
    body.style.setProperty(
      "--app-accent",
      themeObj.accent ||
        themeObj.magenta ||
        themeObj.cursor ||
        "var(--app-accent)",
    );
    body.style.setProperty("--app-red", themeObj.red || "");
    body.style.setProperty("--app-green", themeObj.green || "");
    body.style.setProperty("--app-yellow", themeObj.yellow || "");
    body.style.setProperty("--app-blue", themeObj.blue || "");
    body.style.setProperty(
      "--app-fg-subtle",
      "color-mix(in srgb, var(--app-fg) 70%, transparent)",
    );
    body.style.setProperty(
      "--app-fg-muted",
      "color-mix(in srgb, var(--app-fg) 40%, transparent)",
    );
    body.style.setProperty("--app-panel-bg", "rgba(0,0,0,0.15)");
    body.style.setProperty("--app-modal-bg", "rgba(0,0,0,0.25)");
  }, [themeObj]);

  let appBg = "transparent";
  if (themeObj.background && typeof config.opacity === "number") {
    const hex = themeObj.background.replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      appBg = `rgba(${r}, ${g}, ${b}, ${config.opacity})`;
    }
  }

  const containerStyle: React.CSSProperties = {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: appBg,
    ["--app-bg" as any]: themeObj.background,
    ["--app-fg" as any]: themeObj.foreground,
    ["--app-border" as any]: themeObj.selection || "rgba(255,255,255,0.1)",
    ["--app-accent" as any]:
      themeObj.accent ||
      themeObj.magenta ||
      themeObj.cursor ||
      "var(--app-accent)",
    ["--app-red" as any]: themeObj.red || "var(--app-red)",
    ["--app-green" as any]: themeObj.green || "var(--app-green)",
    ["--app-yellow" as any]: themeObj.yellow || "var(--app-yellow)",
    ["--app-blue" as any]: themeObj.blue || "var(--app-blue)",
    ["--app-fg-subtle" as any]:
      "color-mix(in srgb, var(--app-fg) 70%, transparent)",
    ["--app-fg-muted" as any]:
      "color-mix(in srgb, var(--app-fg) 40%, transparent)",
    ["--app-panel-bg" as any]: "rgba(0,0,0,0.15)",
    ["--app-modal-bg" as any]: "rgba(0,0,0,0.25)",
  };

  return <div style={containerStyle}>{children}</div>;
}
