"use client";

import { useEffect } from "react";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("ui-theme", theme);
}

export function UiRuntime() {
  useEffect(() => {
    const stored = window.localStorage.getItem("ui-theme");
    applyTheme(stored === "dark" ? "dark" : "light");

    const handleToggle = () => {
      const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      applyTheme(current === "dark" ? "light" : "dark");
    };

    const handleEscapeClear = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        if (target instanceof HTMLInputElement) {
          if (target.type === "checkbox" || target.type === "radio") {
            target.checked = false;
          } else {
            target.value = "";
          }
        } else if (target instanceof HTMLSelectElement) {
          target.selectedIndex = 0;
        } else {
          target.value = "";
        }

        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("codex-theme-toggle", handleToggle as EventListener);
    window.addEventListener("keydown", handleEscapeClear, true);

    return () => {
      window.removeEventListener("codex-theme-toggle", handleToggle as EventListener);
      window.removeEventListener("keydown", handleEscapeClear, true);
    };
  }, []);

  return null;
}
