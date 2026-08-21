"use client";
import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#08140f" : "#2f7d70");
  };

  return <button type="button" onClick={toggleTheme} className={`theme-toggle ${compact ? "theme-toggle-compact" : ""}`} aria-label="Alternar entre tema claro e escuro" title="Alternar tema"><span className="theme-icon-dark" aria-hidden="true">☀</span><span className="theme-icon-light" aria-hidden="true">☾</span><span className="sr-only">Alternar tema</span></button>;
}
