"use client";

export default function SistemaError({
  reset
}: {
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
