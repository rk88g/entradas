"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MutationState } from "@/lib/types";

export function MutationBanner({
  state,
  resetKey,
  stateKey
}: {
  state: MutationState;
  resetKey?: string | number;
  stateKey?: string | number;
}) {
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState<"error" | "success">("success");
  const [mounted, setMounted] = useState(false);
  const [suppressedSignature, setSuppressedSignature] = useState<string | null>(null);

  const signature = `${stateKey ?? "default"}::${state.error ?? ""}::${state.success ?? ""}`;

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    setVisibleMessage(null);
    setSuppressedSignature(signature);
  }, [resetKey, signature]);

  useEffect(() => {
    if (signature === suppressedSignature) {
      return;
    }

    if (state.error) {
      setVisibleMessage(state.error);
      setVariant("error");
      return;
    }

    if (state.success) {
      setVisibleMessage(state.success);
      setVariant("success");
      return;
    }

    setVisibleMessage(null);
  }, [state.error, state.success, signature, suppressedSignature]);

  useEffect(() => {
    if (!visibleMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setVisibleMessage(null);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [visibleMessage]);

  if (!visibleMessage) {
    return null;
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={`floating-alert ${variant === "error" ? "is-error" : "is-success"}`}
      role="alert"
      aria-live="polite"
    >
      <div className="floating-alert-accent" />
      <div className="floating-alert-body">
        <strong className="floating-alert-title">
          {variant === "error" ? "Alerta" : "Guardado"}
        </strong>
        <p className="mini-copy">{visibleMessage}</p>
      </div>
    </div>
    ,
    document.body
  );
}
