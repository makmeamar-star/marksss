import { useEffect } from "react";

export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

/** Bind keyboard shortcuts. Keys: "alt+1", "alt+d", "escape", "enter". */
export function useShortcuts(map: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const parts: string[] = [];
      if (e.altKey) parts.push("alt");
      if (e.ctrlKey) parts.push("ctrl");
      if (e.shiftKey) parts.push("shift");
      const key = e.key.toLowerCase();
      parts.push(key);
      const combo = parts.join("+");
      const fn = map[combo] ?? map[key];
      if (fn) fn(e);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map, enabled]);
}
