"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const updateTheme = () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    };

    updateTheme();
    window.addEventListener("codex-theme-toggle", updateTheme as EventListener);
    return () => window.removeEventListener("codex-theme-toggle", updateTheme as EventListener);
  }, []);

  return (
    <button
      type="button"
      className="theme-toggle hide-print"
      aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
      onClick={() => {
        window.dispatchEvent(new Event("codex-theme-toggle"));
        requestAnimationFrame(() => {
          setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
        });
      }}
    >
      <span aria-hidden="true" className="theme-toggle-icon">{theme === "dark" ? "☾" : "☀"}</span>
    </button>
  );
}
