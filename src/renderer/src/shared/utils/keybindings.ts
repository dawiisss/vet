import React from "react";

/**
 * Normalizes a keyboard event into a standardized shortcut string (e.g. 'ctrl+shift+t')
 */
export function buildShortcutString(
  e: KeyboardEvent | React.KeyboardEvent,
): string | null {
  let key = e.key.toLowerCase();
  if (key === "control") key = "ctrl";

  if (["ctrl", "alt", "shift", "meta"].includes(key)) return null;

  const parts = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.metaKey) parts.push("meta");
  parts.push(key);

  return parts.join("+");
}
