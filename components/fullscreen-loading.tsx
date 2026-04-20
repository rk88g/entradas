"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export function FullscreenLoading({
  active,
  label = "Loading..."
}: {
  active: boolean;
  label?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !active) {
    return null;
  }

  return createPortal(
    <div className="fullscreen-loading" role="alert" aria-live="polite" aria-busy="true">
      <div className="fullscreen-loading-card">
        <span className="loading-spinner fullscreen-spinner" />
        <strong>{label}</strong>
      </div>
    </div>,
    document.body
  );
}
