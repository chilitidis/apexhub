import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";

/**
 * Compact theme switcher rendered in the topbar. Shows a Sun icon when
 * currently dark (click → flip to light) and a Moon icon when currently
 * light (click → flip to dark). Falls back to a no-op button when the
 * provider is mounted in non-switchable mode so callers don't have to
 * guard the render.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme, switchable } = useTheme();

  if (!switchable || !toggleTheme) {
    return null;
  }

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      className={[
        "inline-flex items-center justify-center",
        "w-9 h-9 rounded-lg border transition-all",
        "border-[var(--utj-border)] text-[var(--utj-text-muted)]",
        "hover:border-[var(--utj-border-strong)] hover:text-[var(--utj-text)]",
        "hover:bg-[var(--utj-surface)]",
        className,
      ].join(" ")}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
