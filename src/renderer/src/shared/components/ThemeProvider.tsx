import React from "react";
import { useConfig } from "@/features/settings/useConfigStore";
import { resolveTheme } from "@/themes";

/**
 * Component to wrap the application and inject theme custom properties as CSS variables.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { config } = useConfig();
  const themeObj = resolveTheme(config.theme, config.customThemes);

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
