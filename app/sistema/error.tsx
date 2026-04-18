"use client";

export default function SistemaError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-bg">
      <div
        className="page-shell"
        style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}
      >
        <section className="login-card glass-panel" style={{ width: "min(100%, 460px)" }}>
          <div className="alert-box">
            <p className="mini-copy">No se pudo cargar esta vista.</p>
            {error?.message ? (
              <p className="mini-copy" style={{ marginTop: "0.5rem" }}>
                {error.message}
              </p>
            ) : null}
          </div>
          <div className="actions-row" style={{ marginTop: "1rem" }}>
            <button type="button" className="button" onClick={() => reset()}>
              Recargar
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
